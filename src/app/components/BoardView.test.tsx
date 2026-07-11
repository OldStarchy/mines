import { page } from 'vitest/browser';
import { describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import Board from '../../domain/Board';
import Index2D from '../../domain/Index2D';
import type { HighlightRole } from '../highlight';
import BoardView from './BoardView';
import '../styles.css';

// A deterministic mid-game board: numbers, flags, hidden cells.
const FIXTURE = Board.fromStringNotation([
	'_!_!',
	'F  F',
	'    ',
]);

function renderBoard(theme: string, highlight = false) {
	document.documentElement.dataset.theme = theme;
	render(
		<BoardView
			board={FIXTURE}
			status="playing"
			lastReveal={null}
			highlight={
				highlight
					? new Map<string, HighlightRole>([
							[Index2D.key({ x: 3, y: 0 }), 'target'],
							[Index2D.key({ x: 1, y: 0 }), 'group'],
							[Index2D.key({ x: 2, y: 0 }), 'group'],
							[Index2D.key({ x: 2, y: 1 }), 'source'],
						])
					: null
			}
			onReveal={() => {}}
			onToggleFlag={() => {}}
		/>,
	);
}

describe('BoardView', () => {
	test('renders numbers and flags', async () => {
		renderBoard('classic');

		await expect.element(page.getByText('3')).toBeVisible();
		expect(document.querySelectorAll('.cell')).toHaveLength(12);
		expect(document.querySelectorAll('.cell-hidden')).toHaveLength(6);
	});

	for (const theme of ['classic', 'midnight', 'mint', 'dragon']) {
		test(`visual: ${theme} theme`, async () => {
			renderBoard(theme);
			await expect.element(page.getByText('3')).toBeVisible();
			const board = page.elementLocator(
				document.querySelector('.board')!,
			);

			await expect(board).toMatchScreenshot(`board-${theme}`);
		});
	}

	test('dragging across numbers chords each one in passing', async () => {
		document.documentElement.dataset.theme = 'classic';
		const onChord = vi.fn();
		// Bottom row of the classic 1-2-1: three revealed numbers.
		render(
			<BoardView
				board={Board.fromStringNotation(['!_!', '   '])}
				status="playing"
				lastReveal={null}
				highlight={null}
				onChord={onChord}
			/>,
		);
		await expect.element(page.getByText('2')).toBeVisible();

		const cellAt = (key: string) =>
			document.querySelector(`[data-cell="${key}"]`)!;

		// Press on the first number, sweep over the next two.
		cellAt('0,1').dispatchEvent(
			new PointerEvent('pointerdown', {
				button: 0,
				buttons: 1,
				bubbles: true,
			}),
		);
		for (const key of ['1,1', '2,1']) {
			cellAt(key).dispatchEvent(
				new PointerEvent('pointerover', { buttons: 1, bubbles: true }),
			);
		}

		expect(
			onChord.mock.calls.map(([cell]) => `${cell.x},${cell.y}`),
		).toEqual(['0,1', '1,1', '2,1']);

		// Sweeping with no button held chords nothing.
		onChord.mockClear();
		cellAt('1,1').dispatchEvent(
			new PointerEvent('pointerover', { buttons: 0, bubbles: true }),
		);
		expect(onChord).not.toHaveBeenCalled();
	});

	test('visual: assistant highlight roles', async () => {
		renderBoard('classic', true);
		await expect.element(page.getByText('3')).toBeVisible();
		const board = page.elementLocator(document.querySelector('.board')!);

		await expect(board).toMatchScreenshot('board-highlights');
	});
});
