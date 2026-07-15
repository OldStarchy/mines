import { beforeEach, describe, expect, test } from 'vitest';
import {
	buildThemeCss,
	clearCustomTheme,
	initCustomTheme,
	isSafeSvg,
	loadCustomTheme,
	saveCustomTheme,
	validateTheme,
} from './customTheme';
import { oceanTheme } from './customThemeFixture';

describe('customTheme', () => {
	beforeEach(() => {
		localStorage.clear();
		clearCustomTheme();
	});

	test('accepts a well-formed theme and normalizes colors', () => {
		const theme = validateTheme(oceanTheme(), 'under the sea');
		expect(theme.name).toBe('Ocean');
		expect(theme.prompt).toBe('under the sea');
		expect(theme.palette.bg).toBe('#04222e'); // lowercased
		expect(theme.numbers).toHaveLength(8);
		expect(theme.glyphs.mine).toBe('🐡');
	});

	test('rejects scriptable SVG instead of stripping it', () => {
		expect(isSafeSvg('<svg><script>alert(1)</script></svg>')).toBe(false);
		expect(isSafeSvg('<svg onload="x()"><path d="M0 0"/></svg>')).toBe(
			false,
		);
		expect(isSafeSvg('<svg><a href="http://x"><path/></a></svg>')).toBe(
			false,
		);
		expect(isSafeSvg('<svg><foreignObject/></svg>')).toBe(false);
		expect(isSafeSvg('<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>')).toBe(
			true,
		);

		const raw = oceanTheme();
		raw.glyphs.flag = '<svg onclick="steal()"><path d="M0 0"/></svg>';
		expect(() => validateTheme(raw, '')).toThrow(/glyphs\.flag/);
	});

	test('rejects non-hex colors and wrong number counts', () => {
		const badColor = oceanTheme();
		badColor.palette.bg = 'url(javascript:alert(1))';
		expect(() => validateTheme(badColor, '')).toThrow(/palette\.bg/);

		const shortNumbers = oceanTheme();
		shortNumbers.palette.numbers = ['#123456'];
		expect(() => validateTheme(shortNumbers, '')).toThrow(/numbers/);
	});

	test('builds CSS scoped to the custom theme', () => {
		const css = buildThemeCss(validateTheme(oceanTheme(), ''));
		expect(css).toContain(":root[data-theme='custom'] {");
		expect(css).toContain('--cell-hidden: #0e4256;');
		expect(css).toContain('--n8: #8b949e;');
		// Emoji glyphs become content; SVG glyphs become backgrounds.
		expect(css).toContain(".glyph-mine::before { content: '🐡'; }");
		expect(css).toContain('.glyph-flag::before');
		expect(css).toContain('data:image/svg+xml');
		expect(css).toContain('.title::before');
		expect(css).toContain('.app::before');
	});

	test('persists, mounts on init, and clears', () => {
		const theme = validateTheme(oceanTheme(), 'the sea');
		saveCustomTheme(theme);

		expect(loadCustomTheme()?.name).toBe('Ocean');
		expect(
			document.getElementById('custom-theme-css')?.textContent,
		).toContain('--bg: #04222e;');

		// A fresh page load re-mounts from storage.
		document.getElementById('custom-theme-css')?.remove();
		initCustomTheme();
		expect(document.getElementById('custom-theme-css')).not.toBeNull();

		clearCustomTheme();
		expect(loadCustomTheme()).toBeNull();
		expect(document.getElementById('custom-theme-css')).toBeNull();
	});

	test('tampered storage is discarded, not applied', () => {
		const raw = oceanTheme();
		raw.glyphs.boom = '<svg onload="x()"></svg>';
		localStorage.setItem(
			'mines.customTheme',
			JSON.stringify({ ...raw, prompt: '' }),
		);
		expect(loadCustomTheme()).toBeNull();
	});
});
