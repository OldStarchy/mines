import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import App from '../App';
import { clearCustomTheme, validateTheme } from '../customTheme';
import { oceanTheme } from '../customThemeFixture';
import ThemeStudioDialog from './ThemeStudioDialog';
import '../styles.css';

/** What the Messages API returns, with the theme JSON as its text. */
function anthropicResponse(theme: unknown): Response {
	return new Response(
		JSON.stringify({
			id: 'msg_test',
			type: 'message',
			role: 'assistant',
			model: 'claude-opus-4-8',
			content: [{ type: 'text', text: JSON.stringify(theme) }],
			stop_reason: 'end_turn',
			stop_sequence: null,
			usage: { input_tokens: 1, output_tokens: 1 },
		}),
		{ status: 200, headers: { 'content-type': 'application/json' } },
	);
}

describe('ThemeStudioDialog', () => {
	beforeEach(() => {
		localStorage.clear();
		clearCustomTheme();
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	test('generates, saves and applies a theme from a prompt', async () => {
		const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
			void args;
			return anthropicResponse(oceanTheme());
		});
		vi.stubGlobal('fetch', fetchMock);

		const onTheme = vi.fn();
		render(<ThemeStudioDialog onTheme={onTheme} />);

		await page.getByRole('button', { name: 'Theme studio' }).click();
		await page.getByLabelText('Theme prompt').fill('under the sea');
		await page
			.getByLabelText('Anthropic API key', { exact: false })
			.fill('sk-ant-test');
		await page.getByRole('button', { name: 'Generate' }).click();

		// The request went to the Messages API…
		await expect.poll(() => fetchMock.mock.calls.length).toBe(1);
		expect(String(fetchMock.mock.calls[0][0])).toContain('/v1/messages');

		// …and the theme was applied, persisted, and the key remembered.
		expect(onTheme).toHaveBeenCalledWith('custom');
		expect(
			document.getElementById('custom-theme-css')?.textContent,
		).toContain('--accent: #3fd0c9;');
		expect(
			JSON.parse(localStorage.getItem('mines.customTheme')!).name,
		).toBe('Ocean');
		expect(localStorage.getItem('mines.anthropicKey')).toBe('sk-ant-test');
	});

	test('surfaces an invalid generation instead of applying it', async () => {
		const broken = oceanTheme();
		broken.glyphs.flag = '<svg onload="x()"></svg>';
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => anthropicResponse(broken)),
		);

		render(<ThemeStudioDialog onTheme={vi.fn()} />);
		await page.getByRole('button', { name: 'Theme studio' }).click();
		await page.getByLabelText('Theme prompt').fill('anything');
		await page
			.getByLabelText('Anthropic API key', { exact: false })
			.fill('sk-ant-test');
		await page.getByRole('button', { name: 'Generate' }).click();

		await expect
			.element(page.getByText('glyphs.flag', { exact: false }))
			.toBeVisible();
		expect(localStorage.getItem('mines.customTheme')).toBeNull();
	});

	test('a saved custom theme is live from startup', async () => {
		// Seeded as if generated in an earlier session and selected.
		const theme = validateTheme(oceanTheme(), 'under the sea');
		localStorage.setItem('mines.customTheme', JSON.stringify(theme));
		localStorage.setItem('mines.theme', 'custom');

		render(<App />);
		await expect.element(page.getByText('Mines Lab')).toBeVisible();

		expect(document.documentElement.dataset.theme).toBe('custom');
		expect(document.getElementById('custom-theme-css')).not.toBeNull();
		// The dropdown lists it under its generated name.
		await expect
			.element(page.getByLabelText('Theme', { exact: true }))
			.toHaveTextContent('Ocean');
	});
});
