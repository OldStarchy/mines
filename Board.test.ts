import { describe, expect, test } from 'vitest';
import Board from './Board';
import Cell from './Cell';
import CellGroupConstraint from './CellGroupConstraint';
import CellState from './CellState';
import dump from './dump';

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

	describe('generateConstraints', () => {
		test('creates neighbor count constraints', () => {
			const board = Board.fromStringNotation(['!__', '_  ', '_  ']);

			const constraints = board.generateConstraints();

			console.log(constraints.map(dump).join('\n'));
			expect(constraints).toEqual([
				new CellGroupConstraint(
					new Cell(1, 1, CellState.hidden, true),
					[
						new Cell(0, 0, CellState.hidden, true),
						new Cell(1, 0, CellState.hidden, false),
						new Cell(2, 0, CellState.hidden, false),
						new Cell(0, 1, CellState.hidden, false),
						new Cell(2, 1, CellState.revealed(0), false),
						new Cell(0, 2, CellState.hidden, false),
						new Cell(1, 2, CellState.revealed(0), false),
						new Cell(2, 2, CellState.revealed(0), false),
					],
					1,
					1,
				),
			]);
		});
	});
});
