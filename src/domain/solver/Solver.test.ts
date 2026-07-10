import { describe, expect, test } from 'vitest';
import Board from '../Board';
import { explainInference } from './explain';
import solve from './Solver';

function inferenceSummaries(board: Board) {
	return solve(board)
		.inferences.map((i) => `${i.type} ${i.cell.x},${i.cell.y}`)
		.sort();
}

describe('solve', () => {
	test('finds nothing on a board with no revealed numbers', () => {
		const board = Board.fromStringNotation(['__', '_!']);
		expect(solve(board).inferences).toEqual([]);
	});

	test('basic rule: number equals hidden neighbors, flag them all', () => {
		// (0,0) shows 1 and has a single hidden neighbor.
		const board = Board.fromStringNotation([' !']);
		expect(inferenceSummaries(board)).toEqual(['flag 1,0']);
	});

	test('basic rule: number satisfied by flags, reveal the rest', () => {
		// Both revealed cells show 1, already accounted for by the flag.
		const board = Board.fromStringNotation(['F_', '  ']);
		expect(inferenceSummaries(board)).toEqual(['reveal 1,0']);
	});

	test('subset rule: the classic 1-2-1 pattern', () => {
		// Hidden row over 1-2-1: bombs sit under the 1s, the middle is safe.
		const board = Board.fromStringNotation(['!_!', '   ']);
		expect(inferenceSummaries(board)).toEqual([
			'flag 0,0',
			'flag 2,0',
			'reveal 1,0',
		]);
	});

	test('overlap rule: a 3 borrowing an at-most bound from a nearby group', () => {
		// The 3 at (2,1) touches flag (3,1) and hidden (1,0),(2,0),(3,0):
		// two mines remain among those three. The effective 1 at (1,1)
		// says (0,0),(1,0),(2,0) hold exactly one mine, so the overlap
		// (1,0),(2,0) holds at most one. The 3 can then place its second
		// mine only on (3,0) — and the 1's leftover (0,0) must be safe.
		const board = Board.fromStringNotation(['_!_!', 'F  F', '    ']);

		expect(inferenceSummaries(board)).toEqual(['flag 3,0', 'reveal 0,0']);

		const flagT3 = solve(board).inferences.find((i) => i.type === 'flag')!;
		expect(flagT3.constraint.origin.type).toBe('subset');

		const origin = flagT3.constraint.origin;
		if (origin.type !== 'subset') throw new Error('unreachable');
		expect(origin.part.origin.type).toBe('intersection');
	});

	test('explanations list premises before the conclusion', () => {
		const board = Board.fromStringNotation(['_!_!', 'F  F', '    ']);
		const flag = solve(board).inferences.find((i) => i.type === 'flag')!;

		const { steps, conclusion } = explainInference(flag);

		// Two base constraints, their intersection, then the subset step.
		expect(steps.length).toBe(4);
		expect(steps[0].constraint.origin.type).toBe('number');
		expect(steps[1].constraint.origin.type).toBe('number');
		expect(steps.at(-1)!.constraint).toBe(flag.constraint);
		expect(conclusion).toContain('(3,0)');
		expect(conclusion.toLowerCase()).toContain('flag');
	});

	describe('mine counter rule', () => {
		test('all remaining mines flagged: leftover hidden tiles are safe', () => {
			// Two hidden tiles no number can see; the only mine is flagged.
			const board = Board.fromStringNotation(['__F  ']);

			expect(solve(board).inferences).toEqual([]);
			expect(
				solve(board, { totalMines: 1 })
					.inferences.map((i) => `${i.type} ${i.cell.x},${i.cell.y}`)
					.sort(),
			).toEqual(['reveal 0,0', 'reveal 1,0']);
		});

		test('disambiguates local configurations by remaining count', () => {
			// The 1 at (2,0) allows a mine on (1,0) or (3,0) — two valid
			// configurations. Either way the single remaining mine is
			// spent, so the unconstrained (0,0) must be safe.
			const board = Board.fromStringNotation(['_! _']);

			expect(solve(board).inferences).toEqual([]);
			expect(
				solve(board, { totalMines: 1 })
					.inferences.map((i) => `${i.type} ${i.cell.x},${i.cell.y}`)
					.sort(),
			).toEqual(['reveal 0,0']);
		});

		test('stays out of the early game', () => {
			// 25 hidden cells exceed the default cell limit.
			const board = Board.fromStringNotation([
				'_____',
				'_____',
				'_____',
				'_____',
				'____!',
			]);

			const result = solve(board, { totalMines: 1 });
			expect(
				result.constraints.every(
					(c) => c.origin.type !== 'mineCount',
				),
			).toBe(true);
		});
	});

	test('marks contradictions when flags cannot be right', () => {
		// (0,1) shows 1 but touches two flags: one flag must be wrong.
		const board = Board.fromStringNotation(['Ff', '  ']);
		const result = solve(board);
		expect(result.contradictions.length).toBeGreaterThan(0);
	});

	describe('undo memory (opt-in meta-gaming)', () => {
		test('a remembered cell is directly provable', () => {
			const board = Board.fromStringNotation(['__', '__']);
			expect(solve(board).inferences).toEqual([]);

			const safe = solve(board, {
				memory: new Map([['0,0', 'safe']]),
			}).inferences;
			expect(safe.map((i) => `${i.type} ${i.cell.x},${i.cell.y}`)).toEqual(
				['reveal 0,0'],
			);
			expect(safe[0].constraint.origin.type).toBe('memory');

			const mine = solve(board, {
				memory: new Map([['1,1', 'mine']]),
			}).inferences;
			expect(mine.map((i) => `${i.type} ${i.cell.x},${i.cell.y}`)).toEqual(
				['flag 1,1'],
			);
		});

		test('memory combines with numbers to resolve otherwise-stuck cells', () => {
			// The 1 at (0,0) sees three hidden cells holding one mine.
			// Remembering two of them as safe pins the mine on the third.
			const board = Board.fromStringNotation([' _', '_!']);
			expect(
				solve(board).inferences.some((i) => i.type === 'flag'),
			).toBe(false);

			const flag = solve(board, {
				memory: new Map([
					['1,0', 'safe'],
					['0,1', 'safe'],
				]),
			}).inferences.find((i) => i.type === 'flag');

			expect(flag).toBeDefined();
			expect(flag!.cell).toEqual({ x: 1, y: 1 });
			expect(flag!.constraint.origin.type).toBe('subset');
		});
	});

	describe('proof ranking', () => {
		test('the primary proof is never more complex than its alternatives', () => {
			const board = Board.fromStringNotation(['_!_!', 'F  F', '    ']);
			for (const inference of solve(board).inferences) {
				for (const alt of inference.alternatives) {
					expect(inference.constraint.stepCount).toBeLessThanOrEqual(
						alt.stepCount,
					);
				}
			}
		});

		test('explanation steps record the premises they depend on', () => {
			const board = Board.fromStringNotation(['_!_!', 'F  F', '    ']);
			const flag = solve(board).inferences.find((i) => i.type === 'flag')!;
			const steps = explainInference(flag).steps;

			const conclusion = steps.at(-1)!;
			// Its supporting chain is every earlier step.
			expect(conclusion.dependsOn.sort()).toEqual(
				steps.slice(0, -1).map((s) => s.id).sort(),
			);
			// Base (number) steps depend on nothing.
			expect(steps[0].dependsOn).toEqual([]);
		});
	});
});
