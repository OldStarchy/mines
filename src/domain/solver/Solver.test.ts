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

	test('marks contradictions when flags cannot be right', () => {
		// (0,1) shows 1 but touches two flags: one flag must be wrong.
		const board = Board.fromStringNotation(['Ff', '  ']);
		const result = solve(board);
		expect(result.contradictions.length).toBeGreaterThan(0);
	});
});
