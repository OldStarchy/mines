import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { serializeRecord } from '../domain/game/GameRecord';
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
			.toHaveTextContent('009');

		// Right-click flags a hidden cell and decrements the counter.
		// Pick one with no revealed neighbors: a flag deep in unknown
		// territory can never be *provably* wrong, so the contradiction
		// assertion below stays deterministic on a random board.
		const isHidden = (x: number, y: number) =>
			document
				.querySelector(`[data-cell="${x},${y}"]`)
				?.classList.contains('cell-hidden') ?? true;
		const hidden = [...document.querySelectorAll('.cell-hidden')].find(
			(cell) => {
				const [x, y] = (cell as HTMLElement).dataset
					.cell!.split(',')
					.map(Number);
				for (let dx = -1; dx <= 1; dx++)
					for (let dy = -1; dy <= 1; dy++)
						if (!isHidden(x + dx, y + dy)) return false;
				return true;
			},
		) as HTMLElement | undefined ??
			(document.querySelector('.cell-hidden') as HTMLElement);
		hidden.dispatchEvent(
			new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
		);

		await expect
			.element(page.getByTitle('Mines minus flags'))
			.toHaveTextContent('008');

		// The assistant is off by default and explains itself.
		await expect
			.element(page.getByText('Turn the assistant on', { exact: false }))
			.toBeVisible();

		await page.getByLabelText('Enable assistant').click();

		await expect
			.element(page.getByText('provable move', { exact: false }))
			.toBeVisible();

		// A consistent board must never trip the contradiction warning.
		await expect
			.element(page.getByText('flags are inconsistent', { exact: false }))
			.not.toBeInTheDocument();
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
			.toHaveTextContent('008');

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
			.toHaveTextContent('008');
		expect(
			(document.querySelector('.cell') as HTMLButtonElement).disabled,
		).toBe(false);
	});

	test('flag mode swaps the primary click to flagging', async () => {
		render(<App />);
		await expect.element(page.getByText('Mines Lab')).toBeVisible();

		(document.querySelector('[data-cell="4,4"]') as HTMLElement).click();
		await expect
			.element(page.getByTitle('Mines minus flags'))
			.toHaveTextContent('009');

		await page.getByRole('button', { name: 'Flag mode' }).click();

		const key = (document.querySelector('.cell-hidden') as HTMLElement)
			.dataset.cell!;
		const cell = () =>
			document.querySelector(`[data-cell="${key}"]`) as HTMLElement;

		cell().click(); // left click now flags…
		await expect
			.element(page.getByTitle('Mines minus flags'))
			.toHaveTextContent('008');

		cell().click(); // …and toggles the flag back off
		await expect
			.element(page.getByTitle('Mines minus flags'))
			.toHaveTextContent('009');
	});

	test('zoom controls rescale the board canvas', async () => {
		render(<App />);
		await expect.element(page.getByText('Mines Lab')).toBeVisible();

		const canvas = () =>
			document.querySelector('.board-canvas') as HTMLElement;
		expect(canvas().style.transform).toContain('scale(1)');

		await page.getByTitle('Zoom in').click();
		expect(canvas().style.transform).toContain('scale(1.25)');

		await page.getByTitle('Fit board to view').click();
		expect(canvas().style.transform).toContain('scale(1)');
	});

	test('dragging from a cell pans the board instead of revealing', async () => {
		render(<App />);
		await expect.element(page.getByText('Mines Lab')).toBeVisible();

		// Zoom in so the board overflows and has somewhere to pan to.
		await page.getByTitle('Zoom in').click();
		const canvas = () =>
			document.querySelector('.board-canvas') as HTMLElement;
		const before = canvas().style.transform;

		const cell = document.querySelector('.cell-hidden') as HTMLElement;
		const pointer = { pointerId: 1, bubbles: true, cancelable: true };
		cell.dispatchEvent(
			new PointerEvent('pointerdown', {
				...pointer,
				button: 0,
				buttons: 1,
				clientX: 120,
				clientY: 120,
			}),
		);
		cell.dispatchEvent(
			new PointerEvent('pointermove', {
				...pointer,
				buttons: 1,
				clientX: 80,
				clientY: 90,
			}),
		);
		cell.dispatchEvent(new PointerEvent('pointerup', pointer));

		// The drag panned the canvas…
		await expect.poll(() => canvas().style.transform).not.toBe(before);

		// …and swallowed the click that trails it: nothing is revealed.
		cell.dispatchEvent(
			new MouseEvent('click', { bubbles: true, cancelable: true }),
		);
		expect(document.querySelector('.cell-revealed')).toBeNull();
	});

	test('settings persist and hide the floating controls', async () => {
		render(<App />);
		await expect.element(page.getByText('Mines Lab')).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Flag mode' }))
			.toBeVisible();

		await page.getByRole('button', { name: 'Settings' }).click();
		await page.getByLabelText('Floating board controls').click();
		await page.getByRole('button', { name: 'Done' }).click();

		await expect
			.element(page.getByRole('button', { name: 'Flag mode' }))
			.not.toBeInTheDocument();
		expect(
			JSON.parse(localStorage.getItem('mines.settings')!)
				.showBoardControls,
		).toBe(false);
	});

	test('winning a game puts it on the scoreboard', async () => {
		// Resume a deterministic 5x5 one click away from winning: three
		// mines pocket the (0,0) corner, everything else is revealed.
		const config = { width: 5, height: 5, bombs: 3 };
		localStorage.setItem('mines.lastConfig', JSON.stringify(config));
		localStorage.setItem(
			'mines.save.5x5x3',
			serializeRecord({
				config,
				mines: ['1,0', '0,1', '1,1'],
				moves: [{ type: 'reveal', index: { x: 4, y: 4 } }],
			}),
		);

		render(<App />);
		await expect.element(page.getByText('Mines Lab')).toBeVisible();

		(document.querySelector('[data-cell="0,0"]') as HTMLElement).click();
		await expect.element(page.getByText('Cleared!', { exact: false })).toBeVisible();

		// Auto-flag on win dressed the three mines with flags.
		await expect
			.element(page.getByTitle('Mines minus flags'))
			.toHaveTextContent('000');

		await page.getByRole('button', { name: 'Statistics' }).click();
		await expect.element(page.getByText('Best times')).toBeVisible();

		// One win, unassisted, at a 1-click / 3-mine ratio of 0.33.
		const stats = JSON.parse(localStorage.getItem('mines.stats')!)['5x5x3'];
		expect(stats.won).toBe(1);
		expect(stats.board).toHaveLength(1);
		expect(stats.board[0].assisted).toBe(false);
		await expect.element(page.getByText('0.33')).toBeVisible();
	});

	test('a saved custom board is listed in the difficulty menu', async () => {
		// A custom 5x5 game sits saved while the app opens on beginner:
		// without a menu entry it would be impossible to resume.
		const config = { width: 5, height: 5, bombs: 3 };
		localStorage.setItem(
			'mines.save.5x5x3',
			serializeRecord({
				config,
				mines: ['1,0', '0,1', '1,1'],
				moves: [{ type: 'reveal', index: { x: 4, y: 4 } }],
			}),
		);

		render(<App />);
		await expect.element(page.getByText('Mines Lab')).toBeVisible();
		expect(document.querySelectorAll('.cell')).toHaveLength(81);

		await page.getByLabelText('Difficulty').click();
		await page.getByText('Custom (3/5×5)', { exact: false }).click();
		await page.getByRole('button', { name: 'Resume' }).click();

		// The saved game is back: 5x5, all but the mine pocket revealed.
		await expect
			.element(page.getByTitle('Mines minus flags'))
			.toHaveTextContent('003');
		expect(document.querySelectorAll('.cell')).toHaveLength(25);
		expect(document.querySelectorAll('.cell-revealed')).toHaveLength(21);
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
