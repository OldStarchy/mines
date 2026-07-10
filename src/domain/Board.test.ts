import { describe, expect, test } from 'vitest';
import Action from './Action';
import Board from './Board';
import Cell from './Cell';
import CellState from './CellState';

describe('Board', () => {
	describe('fromStringNotation', () => {
		test('all things', () => {
			const board = Board.fromStringNotation([' _f_', '*!F_', '    ']);
			const cells = board.cells.toArray();

			expect(cells).toEqual([
				new Cell(0, 0, CellState.revealed(2), false),
				new Cell(1, 0, CellState.hidden, false),
				new Cell(2, 0, CellState.flagged, false),
				new Cell(3, 0, CellState.hidden, false),

				new Cell(0, 1, CellState.revealed(1), true),
				new Cell(1, 1, CellState.hidden, true),
				new Cell(2, 1, CellState.flagged, true),
				new Cell(3, 1, CellState.hidden, false),

				new Cell(0, 2, CellState.revealed(2), false),
				new Cell(1, 2, CellState.revealed(3), false),
				new Cell(2, 2, CellState.revealed(2), false),
				new Cell(3, 2, CellState.revealed(1), false),
			]);
		});
	});

	describe('applyAction', () => {
		test('reveal flood-fills through zero cells', () => {
			const board = Board.fromStringNotation([
				'____',
				'____',
				'____',
				'___!',
			]).applyAction(Action.reveal({ x: 0, y: 0 }));

			expect(board.cells.at({ x: 3, y: 3 }).state.type).toBe('hidden');
			expect(board.cells.at({ x: 0, y: 0 }).state).toEqual(
				CellState.revealed(0),
			);
			expect(board.cells.at({ x: 2, y: 2 }).state).toEqual(
				CellState.revealed(1),
			);
		});

		test('revealing a bomb does not flood-fill its neighbors', () => {
			const board = Board.fromStringNotation(['!__', '___']).applyAction(
				Action.reveal({ x: 0, y: 0 }),
			);

			expect(board.cells.at({ x: 0, y: 0 }).state.type).toBe('revealed');
			expect(board.cells.at({ x: 1, y: 0 }).state.type).toBe('hidden');
			expect(board.isLost).toBe(true);
		});

		test('flag and unflag toggle a hidden cell', () => {
			const index = { x: 1, y: 0 };
			let board = Board.fromStringNotation(['!__', '___']);

			board = board.applyAction(Action.flag(index));
			expect(board.cells.at(index).state.type).toBe('flagged');

			// Flagged cells cannot be revealed.
			board = board.applyAction(Action.reveal(index));
			expect(board.cells.at(index).state.type).toBe('flagged');

			board = board.applyAction(Action.unflag(index));
			expect(board.cells.at(index).state.type).toBe('hidden');
		});

		test('placeBombsAndReveal keeps the first click safe', () => {
			const board = Board.ofSize(9, 9).applyAction(
				Action.placeBombsAndReveal({ x: 4, y: 4 }, 10),
			);

			expect(board.bombCount).toBe(10);
			expect(board.cells.at({ x: 4, y: 4 }).state.type).toBe('revealed');
			expect(board.isLost).toBe(false);
		});
	});

	describe('win/loss detection', () => {
		test('isWon when all non-bomb cells revealed', () => {
			let board = Board.fromStringNotation(['!_', '__']);
			expect(board.isWon).toBe(false);

			board = board
				.applyAction(Action.reveal({ x: 1, y: 0 }))
				.applyAction(Action.reveal({ x: 0, y: 1 }))
				.applyAction(Action.reveal({ x: 1, y: 1 }));

			expect(board.isWon).toBe(true);
			expect(board.isLost).toBe(false);
		});
	});

	describe('chord', () => {
		test('reveals non-flagged neighbors when the number is satisfied', () => {
			// The 1 at (0,0) sees one bomb, flagged at (1,1).
			const board = Board.fromStringNotation([
				' __',
				'_F_',
				'___',
			]).applyAction(Action.chord({ x: 0, y: 0 }));

			// (1,0) and (0,1) revealed; the flagged bomb is untouched.
			expect(board.cells.at({ x: 1, y: 0 }).state.type).toBe('revealed');
			expect(board.cells.at({ x: 0, y: 1 }).state.type).toBe('revealed');
			expect(board.cells.at({ x: 1, y: 1 }).state.type).toBe('flagged');
		});

		test('flags hidden neighbors when they must all be mines', () => {
			// The 1 at (0,0) has a single hidden neighbor: the mine.
			const board = Board.fromStringNotation([' !']).applyAction(
				Action.chord({ x: 0, y: 0 }),
			);

			expect(board.cells.at({ x: 1, y: 0 }).state.type).toBe('flagged');
		});

		test('auto-flagging counts flags already placed', () => {
			// The 2 at (0,1) touches one flag and one hidden cell — the
			// hidden cell must hold the remaining mine.
			const board = Board.fromStringNotation(['F!', '  ']).applyAction(
				Action.chord({ x: 0, y: 1 }),
			);

			expect(board.cells.at({ x: 1, y: 0 }).state.type).toBe('flagged');
			expect(board.isLost).toBe(false);
		});

		test('does nothing when the number is neither satisfied nor forced', () => {
			// The 1 at (0,0) has three hidden neighbors and no flags:
			// nothing to reveal, nothing that must be a mine.
			const before = Board.fromStringNotation([' __', '_!_', '___']);
			const after = before.applyAction(Action.chord({ x: 0, y: 0 }));

			expect(after.cells.at({ x: 1, y: 0 }).state.type).toBe('hidden');
		});

		test('detonates a mis-flagged chord', () => {
			// The 1 is satisfied by a wrong flag, so chording hits the mine.
			const board = Board.fromStringNotation([
				' f_',
				'_!_',
				'___',
			]).applyAction(Action.chord({ x: 0, y: 0 }));

			expect(board.isLost).toBe(true);
		});
	});

	describe('create', () => {
		test('places bombs deterministically at the given keys', () => {
			const board = Board.create({ width: 3, height: 2 }, ['1,0', '2,1']);

			expect(board.mineKeys().sort()).toEqual(['1,0', '2,1']);
			expect(board.bombCount).toBe(2);
			expect(
				board.cells.toArray().every((c) => c.state.type === 'hidden'),
			).toBe(true);
		});
	});
});
