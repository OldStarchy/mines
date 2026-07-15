/**
 * The player-generated "custom" theme: a palette, a glyph set, and
 * optional decorations designed by an LLM (see themeGen.ts), stored in
 * localStorage and applied as a stylesheet scoped to
 * [data-theme='custom']. Everything arriving from the model is
 * untrusted — colors and SVGs are validated here before any of it
 * reaches the DOM.
 */

/** CSS variable names in themes.css, in palette order. */
const PALETTE_VARS = {
	bg: '--bg',
	surface: '--surface',
	text: '--text',
	muted: '--muted',
	border: '--border',
	bevelLight: '--bevel-light',
	bevelDark: '--bevel-dark',
	cellHidden: '--cell-hidden',
	cellHiddenHover: '--cell-hidden-hover',
	cellRevealed: '--cell-revealed',
	cellHit: '--cell-hit',
	accent: '--accent',
	warningBg: '--warning-bg',
	warningText: '--warning-text',
	hlTarget: '--hl-target',
	hlGroup: '--hl-group',
	hlSource: '--hl-source',
} as const;

export type PaletteKey = keyof typeof PALETTE_VARS;
export const PALETTE_KEYS = Object.keys(PALETTE_VARS) as PaletteKey[];

const GLYPH_KEYS = ['flag', 'mine', 'boom', 'wrong'] as const;
export type GlyphKey = (typeof GLYPH_KEYS)[number];

export interface CustomTheme {
	/** Short display name, shown in the theme dropdown. */
	readonly name: string;
	/** The request that produced it, kept for tweak-and-regenerate. */
	readonly prompt: string;
	readonly colorScheme: 'light' | 'dark';
	readonly palette: Record<PaletteKey, string>;
	/** Number colors 1–8. */
	readonly numbers: readonly string[];
	/** Each glyph is an emoji/short text, or an inline `<svg>` icon. */
	readonly glyphs: Record<GlyphKey, string>;
	/** Emoji flanking the title; empty for none. */
	readonly flourish: string;
	/** Large silhouette SVG behind the board; empty for none. */
	readonly watermark: string;
}

const STORAGE_KEY = 'mines.customTheme';
const STYLE_ID = 'custom-theme-css';

const COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * SVG straight from a model is untrusted: only inert drawing markup
 * survives. Anything scriptable or that can reach the network —
 * event handlers, hrefs, foreignObject, style/script tags — fails
 * validation rather than being stripped.
 */
export function isSafeSvg(svg: string): boolean {
	if (!/^<svg[\s>]/.test(svg.trim())) return false;
	const allowed = new Set([
		'svg',
		'g',
		'path',
		'circle',
		'ellipse',
		'rect',
		'polygon',
		'polyline',
		'line',
		'defs',
		'linearGradient',
		'radialGradient',
		'stop',
		'title',
	]);
	for (const [, name] of svg.matchAll(/<\s*\/?\s*([a-zA-Z:-]+)/g)) {
		if (!allowed.has(name)) return false;
	}
	return !/on[a-z]+\s*=|href|javascript:|<!/i.test(svg);
}

function isColor(value: unknown): value is string {
	return typeof value === 'string' && COLOR.test(value);
}

/** An emoji or word for CSS `content`, or a small inline SVG icon. */
function isGlyph(value: unknown): value is string {
	if (typeof value !== 'string' || value.length === 0) return false;
	if (value.trimStart().startsWith('<')) {
		return value.length <= 4000 && isSafeSvg(value);
	}
	return value.length <= 8 && !/['"\\<>]/.test(value);
}

/**
 * Checks a parsed model response field by field; throws a message
 * naming the first offending field so the player sees what to retry.
 */
export function validateTheme(raw: unknown, prompt: string): CustomTheme {
	const fail = (what: string): never => {
		throw new Error(`The generated theme is invalid: ${what}.`);
	};
	if (typeof raw !== 'object' || raw === null) fail('not an object');
	const data = raw as Record<string, unknown>;

	const name =
		typeof data.name === 'string' && data.name.trim().length > 0
			? data.name.trim().slice(0, 24)
			: fail('missing name');
	const colorScheme =
		data.colorScheme === 'light' || data.colorScheme === 'dark'
			? data.colorScheme
			: fail('colorScheme must be light or dark');

	const rawPalette = (data.palette ?? {}) as Record<string, unknown>;
	const palette = {} as Record<PaletteKey, string>;
	for (const key of PALETTE_KEYS) {
		const value = rawPalette[key];
		if (!isColor(value)) fail(`palette.${key} is not a hex color`);
		palette[key] = (value as string).toLowerCase();
	}

	// Fresh generations carry numbers inside palette; persisted themes
	// at the top level. Accept both — storage is re-validated on load.
	const rawNumbers = rawPalette.numbers ?? data.numbers;
	const numbers = Array.isArray(rawNumbers)
		? rawNumbers
		: fail('palette.numbers missing');
	if (numbers.length !== 8 || !numbers.every(isColor)) {
		fail('palette.numbers must be 8 hex colors');
	}

	const rawGlyphs = (data.glyphs ?? {}) as Record<string, unknown>;
	const glyphs = {} as Record<GlyphKey, string>;
	for (const key of GLYPH_KEYS) {
		const value = rawGlyphs[key];
		if (!isGlyph(value)) fail(`glyphs.${key} is not an emoji or safe SVG`);
		glyphs[key] = value as string;
	}

	const flourish =
		typeof data.flourish === 'string' && isGlyph(data.flourish)
			? data.flourish
			: '';
	const watermark =
		typeof data.watermark === 'string' &&
		data.watermark.length > 0 &&
		data.watermark.length <= 20000 &&
		isSafeSvg(data.watermark)
			? data.watermark
			: '';

	return {
		name,
		prompt,
		colorScheme,
		palette,
		numbers: numbers.map((c) => (c as string).toLowerCase()),
		glyphs,
		flourish,
		watermark,
	};
}

const svgUrl = (svg: string) =>
	`url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

function glyphRule(selector: string, glyph: string): string {
	if (glyph.trimStart().startsWith('<')) {
		// SVG icons render as a sized background; emoji as text content.
		return (
			`${selector} { content: ''; display: inline-block;` +
			` width: 1.2em; height: 1.2em; vertical-align: -0.2em;` +
			` background: ${svgUrl(glyph)} center / contain no-repeat; }`
		);
	}
	return `${selector} { content: '${glyph}'; }`;
}

/** The whole theme as CSS, scoped under [data-theme='custom']. */
export function buildThemeCss(theme: CustomTheme): string {
	const root = ":root[data-theme='custom']";
	const vars = PALETTE_KEYS.map(
		(key) => `\t${PALETTE_VARS[key]}: ${theme.palette[key]};`,
	);
	theme.numbers.forEach((color, i) => vars.push(`\t--n${i + 1}: ${color};`));

	const rules = [
		`${root} {\n\tcolor-scheme: ${theme.colorScheme};\n${vars.join('\n')}\n}`,
		glyphRule(`${root} .glyph-flag::before`, theme.glyphs.flag),
		glyphRule(`${root} .glyph-mine::before`, theme.glyphs.mine),
		glyphRule(`${root} .glyph-boom::before`, theme.glyphs.boom),
		glyphRule(`${root} .glyph-wrong::before`, theme.glyphs.wrong),
	];
	if (theme.flourish) {
		rules.push(
			`${root} .title::before { content: '${theme.flourish}'; margin-right: 10px; font-size: 0.85em; }`,
			`${root} .title::after { content: '${theme.flourish}'; margin-left: 10px; font-size: 0.85em; }`,
		);
	}
	if (theme.watermark) {
		rules.push(
			`${root} .app::before { content: ''; position: fixed; inset: 0;` +
				` z-index: -1; pointer-events: none;` +
				` background: ${svgUrl(theme.watermark)} right -40px bottom -40px / 440px auto no-repeat;` +
				` opacity: 0.08; }`,
		);
	}
	return rules.join('\n');
}

export function loadCustomTheme(): CustomTheme | null {
	try {
		const json = localStorage.getItem(STORAGE_KEY);
		if (!json) return null;
		// Re-validated on load: storage is as untrusted as the network.
		const stored = JSON.parse(json) as { prompt?: unknown };
		const prompt = typeof stored.prompt === 'string' ? stored.prompt : '';
		return validateTheme(stored, prompt);
	} catch {
		return null;
	}
}

export function hasCustomTheme(): boolean {
	return loadCustomTheme() !== null;
}

/** Persists the theme and (re)mounts its stylesheet. */
export function saveCustomTheme(theme: CustomTheme) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
	} catch {
		// best-effort — the theme still applies for this session
	}
	mountCustomTheme(theme);
}

export function clearCustomTheme() {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// ignore
	}
	document.getElementById(STYLE_ID)?.remove();
}

function mountCustomTheme(theme: CustomTheme) {
	let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
	if (!style) {
		style = document.createElement('style');
		style.id = STYLE_ID;
		document.head.appendChild(style);
	}
	style.textContent = buildThemeCss(theme);
}

/** Mounts the saved theme's stylesheet on startup, if there is one. */
export function initCustomTheme() {
	const theme = loadCustomTheme();
	if (theme) mountCustomTheme(theme);
}
