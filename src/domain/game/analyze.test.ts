import { describe, expect, test } from 'vitest';
import Game from './Game';
import { analyzeRecord } from './analyze';

/** The pocket scenario from Game.test: 3 mines walling off (0,0). */
function pocketGame(): Game {
	const game = new Game();
	game.loadRecord({
		config: { width: 5, height: 5, bombs: 3 },
		mines: ['1,0', '0,1', '1,1'],
		moves: [{ type: 'reveal', index: { x: 4, y: 4 } }],
	});
	return game;
}

describe('analyzeRecord', () => {
	test('splits flags by manual/chorded and correct/incorrect', () => {
		const game = pocketGame();

		game.toggleFlag({ x: 0, y: 0 }); // manual, wrong (safe cell)
		game.toggleFlag({ x: 1, y: 0 }); // manual, correct (mine)
		// The 2 at (0,2) now sees one flag and two hidden mines... give
		// it a chord that flags its forced mines (0,1) and (1,1).
		game.chord({ x: 0, y: 2 });

		const stats = analyzeRecord(game.getRecord());
		expect(stats.chords).toBe(1);
		expect(stats.flags.manual).toEqual({ correct: 1, incorrect: 1 });
		expect(stats.flags.chorded).toEqual({ correct: 2, incorrect: 0 });
	});

	test('unflag and re-flag counts each placement', () => {
		const game = pocketGame();
		game.toggleFlag({ x: 1, y: 0 });
		game.toggleFlag({ x: 1, y: 0 });
		game.toggleFlag({ x: 1, y: 0 });

		const stats = analyzeRecord(game.getRecord());
		expect(stats.flags.manual).toEqual({ correct: 2, incorrect: 0 });
	});

	test('win auto-flags are derived, not counted as placed', () => {
		const game = pocketGame();
		game.reveal({ x: 0, y: 0 }); // wins; the 3 mines get auto-flagged

		expect(game.getState().board.flagCount).toBe(3);
		const stats = analyzeRecord(game.getRecord());
		expect(stats.flags.manual).toEqual({ correct: 0, incorrect: 0 });
		expect(stats.flags.chorded).toEqual({ correct: 0, incorrect: 0 });
	});
});
