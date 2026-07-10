import { page } from 'vitest/browser';
import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import App from './App';

describe('App', () => {
	test('plays a game: reveal, flag, assistant toggle', async () => {
		render(<App />);

		await expect.element(page.getByText('Mines Lab')).toBeVisible();

		// First click starts the game and is always safe.
		const firstCell = document.querySelector(
			'[data-cell="4,4"]',
		) as HTMLElement;
		firstCell.click();

		await expect
			.element(page.getByTitle('Mines minus flags'))
			.toHaveTextContent('010');

		// Right-click flags a hidden cell and decrements the counter.
		const hidden = document.querySelector('.cell-hidden') as HTMLElement;
		hidden.dispatchEvent(
			new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
		);

		await expect
			.element(page.getByTitle('Mines minus flags'))
			.toHaveTextContent('009');

		// The assistant is off by default and explains itself.
		await expect
			.element(page.getByText('Turn the assistant on', { exact: false }))
			.toBeVisible();

		await page.getByLabelText('Enable assistant').click();

		await expect
			.element(page.getByText('provable move', { exact: false }))
			.toBeVisible();
	});
});
