import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import App from './App';

describe('App', () => {
	beforeEach(() => {
		// The app persists games to localStorage; isolate each test.
		localStorage.clear();
	});

	test('visual: idle app layout', async () => {
		document.documentElement.dataset.theme = 'classic';
		render(<App />);

		await expect.element(page.getByText('Mines Lab')).toBeVisible();
		const app = page.elementLocator(document.querySelector('.app')!);

		await expect(app).toMatchScreenshot('app-idle');
	});

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

	test('undo reverts the last move, redo restores it', async () => {
		render(<App />);
		await expect.element(page.getByText('Mines Lab')).toBeVisible();

		const undoButton = page.getByTitle('Undo');
		const redoButton = page.getByTitle('Redo');
		await expect.element(undoButton).toBeDisabled();

		const firstCell = document.querySelector(
			'[data-cell="4,4"]',
		) as HTMLElement;
		firstCell.click();
		await expect.element(undoButton).toBeEnabled();
		expect(document.querySelector('.cell-revealed')).not.toBeNull();

		await undoButton.click();
		expect(document.querySelector('.cell-revealed')).toBeNull();
		await expect.element(undoButton).toBeDisabled();

		await redoButton.click();
		expect(document.querySelector('.cell-revealed')).not.toBeNull();
	});

	test('replay plays the move log back, then returns to the game', async () => {
		render(<App />);
		await expect.element(page.getByText('Mines Lab')).toBeVisible();

		// Two moves: a reveal and a flag.
		(document.querySelector('[data-cell="4,4"]') as HTMLElement).click();
		await expect.element(page.getByTitle('Undo')).toBeEnabled();
		const hidden = document.querySelector('.cell-hidden') as HTMLElement;
		hidden.dispatchEvent(
			new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
		);
		await expect
			.element(page.getByTitle('Mines minus flags'))
			.toHaveTextContent('009');

		await page.getByRole('button', { name: /Replay$/ }).click();

		// The replayed board is read-only while it plays.
		expect(
			(document.querySelector('.cell') as HTMLButtonElement).disabled,
		).toBe(true);

		// Both moves play back evenly spaced (default 2 actions/second).
		await expect
			.element(page.getByText('move 2/2'), { timeout: 5000 })
			.toBeVisible();

		await page.getByRole('button', { name: 'Back to game' }).click();
		await expect
			.element(page.getByTitle('Mines minus flags'))
			.toHaveTextContent('009');
		expect(
			(document.querySelector('.cell') as HTMLButtonElement).disabled,
		).toBe(false);
	});

	test('restores the saved game after a remount', async () => {
		const first = await render(<App />);
		await expect.element(page.getByText('Mines Lab')).toBeVisible();

		const firstCell = document.querySelector(
			'[data-cell="4,4"]',
		) as HTMLElement;
		firstCell.click();
		await expect.element(page.getByTitle('Undo')).toBeEnabled();
		const revealedCount =
			document.querySelectorAll('.cell-revealed').length;
		expect(revealedCount).toBeGreaterThan(0);

		await first.unmount();
		render(<App />);
		await expect.element(page.getByText('Mines Lab')).toBeVisible();

		// The reload resumed the same game, not a fresh board.
		expect(document.querySelectorAll('.cell-revealed').length).toBe(
			revealedCount,
		);
	});
});
