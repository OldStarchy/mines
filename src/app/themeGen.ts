import Anthropic from '@anthropic-ai/sdk';
import { validateTheme, type CustomTheme } from './customTheme';

/**
 * Generates a theme with Claude, straight from the browser using the
 * player's own API key. The response is constrained to THEME_SCHEMA
 * via structured outputs, then still fully validated/sanitized by
 * validateTheme — the schema shapes the JSON, the validator guards
 * colors and SVG safety.
 */

const KEY_STORAGE = 'mines.anthropicKey';

export function loadApiKey(): string {
	try {
		return localStorage.getItem(KEY_STORAGE) ?? '';
	} catch {
		return '';
	}
}

export function saveApiKey(key: string) {
	try {
		if (key) localStorage.setItem(KEY_STORAGE, key);
		else localStorage.removeItem(KEY_STORAGE);
	} catch {
		// best-effort
	}
}

const color = { type: 'string' } as const;

const THEME_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	required: [
		'name',
		'colorScheme',
		'palette',
		'glyphs',
		'flourish',
		'watermark',
	],
	properties: {
		name: { type: 'string', description: 'Short theme name, 1-2 words' },
		colorScheme: { type: 'string', enum: ['light', 'dark'] },
		palette: {
			type: 'object',
			additionalProperties: false,
			required: [
				'bg',
				'surface',
				'text',
				'muted',
				'border',
				'bevelLight',
				'bevelDark',
				'cellHidden',
				'cellHiddenHover',
				'cellRevealed',
				'cellHit',
				'accent',
				'warningBg',
				'warningText',
				'hlTarget',
				'hlGroup',
				'hlSource',
				'numbers',
			],
			properties: {
				bg: color,
				surface: color,
				text: color,
				muted: color,
				border: color,
				bevelLight: color,
				bevelDark: color,
				cellHidden: color,
				cellHiddenHover: color,
				cellRevealed: color,
				cellHit: color,
				accent: color,
				warningBg: color,
				warningText: color,
				hlTarget: color,
				hlGroup: color,
				hlSource: color,
				numbers: { type: 'array', items: color },
			},
		},
		glyphs: {
			type: 'object',
			additionalProperties: false,
			required: ['flag', 'mine', 'boom', 'wrong'],
			properties: {
				flag: { type: 'string' },
				mine: { type: 'string' },
				boom: { type: 'string' },
				wrong: { type: 'string' },
			},
		},
		flourish: { type: 'string' },
		watermark: { type: 'string' },
	},
} as const;

const DESIGNER_PROMPT = `You design visual themes for Mines Lab, a minesweeper game. From the player's request, produce one cohesive theme as JSON.

Colors — hex only (#rrggbb; #rrggbbaa allowed for hlGroup, which is a translucent overlay). The board: hidden cells (cellHidden, with bevelLight/bevelDark as the raised 3D edges — lighter and darker shades of it) sit on surface; revealed cells (cellRevealed) must be clearly distinct from hidden ones; cellHit is the mine you stepped on. text must be readable on bg, surface, and cellRevealed. numbers is exactly 8 colors for the digits 1-8, each readable on cellRevealed and distinguishable from the others; follow the tradition of 1 blue-ish and 2 green-ish and 3 red-ish unless the theme demands otherwise.

Glyphs — flag marks a suspected mine; mine is shown on the remaining mines when the game is lost; boom is the fatal cell itself; wrong marks a flag that turned out to be wrong. Each glyph is EITHER a single emoji OR an inline SVG icon: <svg viewBox="0 0 24 24"> using only path/circle/ellipse/rect/polygon/polyline/line/g elements with fill/stroke attributes (no scripts, hrefs, text, or style tags). Prefer hand-drawn SVG icons — that is what makes the theme feel custom. They render at ~18px, so keep shapes bold and simple.

watermark — a large decorative silhouette SVG in 1-2 theme colors (same element restrictions, viewBox around 0 0 440 440), shown at 8% opacity in the corner behind the board. Give it real character; it is the theme's signature. Use "" only if nothing fits.

flourish — one emoji shown either side of the game title, or "".`;

/** One retry for transient failures; auth and bad requests surface. */
export async function generateTheme(options: {
	apiKey: string;
	prompt: string;
}): Promise<CustomTheme> {
	const client = new Anthropic({
		apiKey: options.apiKey,
		dangerouslyAllowBrowser: true,
	});

	const response = await client.messages.create({
		model: 'claude-opus-4-8',
		max_tokens: 16000,
		thinking: { type: 'adaptive' },
		output_config: {
			format: {
				type: 'json_schema',
				schema: THEME_SCHEMA,
			},
		},
		system: DESIGNER_PROMPT,
		messages: [{ role: 'user', content: options.prompt }],
	});

	if (response.stop_reason === 'refusal') {
		throw new Error('The model declined this request — try rewording.');
	}
	if (response.stop_reason === 'max_tokens') {
		throw new Error('The design ran too long — try a simpler prompt.');
	}

	const text = response.content
		.filter((block) => block.type === 'text')
		.map((block) => block.text)
		.join('');
	return validateTheme(JSON.parse(text), options.prompt);
}

/** Human-readable message for anything generateTheme can throw. */
export function describeError(error: unknown): string {
	if (error instanceof Anthropic.AuthenticationError) {
		return 'Anthropic rejected the API key.';
	}
	if (error instanceof Anthropic.RateLimitError) {
		return 'Rate limited — wait a moment and try again.';
	}
	if (error instanceof Anthropic.APIConnectionError) {
		return 'Could not reach the Anthropic API — check your connection.';
	}
	if (error instanceof Anthropic.APIError) {
		return `Anthropic API error: ${error.message}`;
	}
	if (error instanceof SyntaxError) {
		return 'The model returned malformed JSON — try again.';
	}
	return error instanceof Error ? error.message : String(error);
}
