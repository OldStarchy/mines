import { page } from 'vitest/browser';
import { describe, expect, test } from 'vitest';
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

	for (const theme of ['classic', 'midnight', 'mint']) {
		test(`visual: ${theme} theme`, async () => {
			renderBoard(theme);
			await expect.element(page.getByText('3')).toBeVisible();
			const board = page.elementLocator(
				document.querySelector('.board')!,
			);

			await expect(board).toMatchScreenshot(`board-${theme}`);
		});
	}

	test('visual: assistant highlight roles', async () => {
		renderBoard('classic', true);
		await expect.element(page.getByText('3')).toBeVisible();
		const board = page.elementLocator(document.querySelector('.board')!);

		await expect(board).toMatchScreenshot('board-highlights');
	});
});
