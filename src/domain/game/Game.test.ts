import { describe, expect, test } from 'vitest';
import Index2D from '../Index2D';
import Game, { PRESETS } from './Game';

/**
 * Deterministic 5x5 mid-game: bombs pocket the (0,0) corner, and the
 * loaded reveal at (4,4) has flooded everything else, so exactly (0,0)
 * and the three bombs are still hidden and the game is in progress.
 * (A random board can flood-win on the first click, making moves no-op.)
 */
function pocketGame(): Game {
	const game = new Game();
	game.loadRecord({
		config: { width: 5, height: 5, bombs: 3 },
		mines: ['1,0', '0,1', '1,1'],
		moves: [{ type: 'reveal', index: { x: 4, y: 4 } }],
	});
	return game;
}

describe('Game', () => {
	test('first reveal places bombs and starts the game', () => {
		const game = new Game(PRESETS.beginner);
		expect(game.getState().status).toBe('idle');

		game.reveal({ x: 4, y: 4 });

		const state = game.getState();
		expect(state.status).toBe('playing');
		expect(state.board.bombCount).toBe(PRESETS.beginner.bombs);
		expect(state.board.cells.at({ x: 4, y: 4 }).state.type).toBe(
			'revealed',
		);
		expect(state.startedAt).not.toBeNull();
	});

	test('notifies subscribers on change and supports unsubscribe', () => {
		const game = new Game();
		let calls = 0;
		const unsubscribe = game.subscribe(() => calls++);

		game.reveal({ x: 0, y: 0 });
		expect(calls).toBeGreaterThan(0);

		const seen = calls;
		unsubscribe();
		game.toggleFlag({ x: 8, y: 8 });
		expect(calls).toBe(seen);
	});

	test('toggleFlag flags and unflags without starting the game', () => {
		const game = new Game();
		game.reveal({ x: 0, y: 0 });

		// find a hidden cell
		const hidden = game
			.getState()
			.board.cells.toArray()
			.find((c) => c.state.type === 'hidden')!;

		game.toggleFlag(hidden);
		expect(game.getState().board.cells.at(hidden).state.type).toBe(
			'flagged',
		);

		// flagged cells cannot be revealed
		game.reveal(hidden);
		expect(game.getState().board.cells.at(hidden).state.type).toBe(
			'flagged',
		);

		game.toggleFlag(hidden);
		expect(game.getState().board.cells.at(hidden).state.type).toBe(
			'hidden',
		);
	});

	test('revealing a bomb loses the game and freezes input', () => {
		const game = new Game(PRESETS.beginner);
		game.reveal({ x: 0, y: 0 });

		const bomb = game
			.getState()
			.board.cells.toArray()
			.find((c) => c.isBomb && c.state.type === 'hidden')!;

		game.reveal(bomb);
		expect(game.getState().status).toBe('lost');

		const frozen = game.getState().board;
		game.reveal({ x: 8, y: 8 });
		expect(game.getState().board).toBe(frozen);
	});

	test('revealing all safe cells wins the game', () => {
		const game = new Game({ width: 4, height: 4, bombs: 2 });
		game.reveal({ x: 0, y: 0 });

		for (const cell of game.getState().board.cells.toArray()) {
			if (!cell.isBomb) game.reveal(cell);
		}

		expect(game.getState().status).toBe('won');
		expect(game.getState().endedAt).not.toBeNull();
	});

	test('winning auto-flags the remaining mines', () => {
		const game = pocketGame();

		// (0,0) is the last safe cell; the three mines are still hidden.
		game.reveal({ x: 0, y: 0 });

		const state = game.getState();
		expect(state.status).toBe('won');
		expect(state.board.flagCount).toBe(3);

		// The flags are derived, not recorded: undo returns to the
		// unflagged pre-win board.
		game.undo();
		expect(game.getState().board.flagCount).toBe(0);
	});

	test('tracks the last reveal for flood-fill animation', () => {
		const game = new Game(PRESETS.beginner);
		expect(game.getState().lastReveal).toBeNull();

		game.reveal({ x: 4, y: 4 });

		const lastReveal = game.getState().lastReveal!;
		expect(lastReveal.origin).toEqual({ x: 4, y: 4 });
		// First click reveals at least its own flood-filled region.
		expect(lastReveal.revealed).toContain('4,4');
		expect(lastReveal.revealed.length).toBeGreaterThanOrEqual(9);

		game.restart();
		expect(game.getState().lastReveal).toBeNull();
	});

	test('restart returns to idle with the new config', () => {
		const game = new Game(PRESETS.beginner);
		game.reveal({ x: 0, y: 0 });

		game.restart(PRESETS.expert);

		const state = game.getState();
		expect(state.status).toBe('idle');
		expect(state.config).toEqual(PRESETS.expert);
		expect(state.board.bombCount).toBe(0);
	});

	test('a loaded record resumes its accumulated play time', () => {
		const game = pocketGame();
		expect(game.getState().startedAt).not.toBeNull();

		const resumed = new Game();
		resumed.loadRecord(game.getRecord(), 5000);

		const elapsed = Date.now() - resumed.getState().startedAt!;
		expect(elapsed).toBeGreaterThanOrEqual(5000);
		expect(elapsed).toBeLessThan(6000);
	});

	describe('undo/redo', () => {
		test('undo reverts the last move, redo re-applies it', () => {
			const game = pocketGame();

			game.toggleFlag({ x: 0, y: 0 });
			expect(game.getState().board.flagCount).toBe(1);
			expect(game.getState().canUndo).toBe(true);

			game.undo();
			expect(game.getState().board.flagCount).toBe(0);
			expect(game.getState().canRedo).toBe(true);

			game.redo();
			expect(game.getState().board.flagCount).toBe(1);
			expect(game.getState().canRedo).toBe(false);
		});

		test('undo can recover from a loss', () => {
			const game = pocketGame();

			game.reveal({ x: 1, y: 0 });
			expect(game.getState().status).toBe('lost');

			game.undo();
			expect(game.getState().status).toBe('playing');
			expect(game.getState().endedAt).toBeNull();
		});

		test('a new move after undo discards the redo branch', () => {
			const game = pocketGame();

			game.toggleFlag({ x: 0, y: 0 });
			game.undo();
			game.toggleFlag({ x: 1, y: 0 });

			expect(game.getState().canRedo).toBe(false);
		});
	});

	describe('batch (assistant multi-cell apply)', () => {
		test('flagging several cells is one undoable move', () => {
			const game = pocketGame();

			game.applyMany('flag', [
				{ x: 1, y: 0 },
				{ x: 0, y: 1 },
				{ x: 1, y: 1 },
			]);

			expect(game.getState().board.flagCount).toBe(3);
			expect(game.getState().moveCount).toBe(2);

			game.undo();
			expect(game.getState().board.flagCount).toBe(0);
		});

		test('a batch reveal waves from its first cell', () => {
			const game = pocketGame();

			game.applyMany('reveal', [{ x: 0, y: 0 }]);

			expect(game.getState().lastReveal?.origin).toEqual({ x: 0, y: 0 });
			// (0,0) was the last safe cell, so the batch also wins the game.
			expect(game.getState().status).toBe('won');
		});

		test('a batch that changes nothing is not recorded', () => {
			const game = pocketGame();

			game.applyMany('reveal', [{ x: 3, y: 3 }]); // already revealed

			expect(game.getState().moveCount).toBe(1);
		});
	});

	describe('seeded mines', () => {
		test('the first reveal uses the seeded layout instead of randomizing', () => {
			const game = new Game({ width: 5, height: 5, bombs: 3 });
			game.seedMines(['1,0', '0,1', '1,1']);

			game.reveal({ x: 4, y: 4 });

			expect(game.getRecord().mines).toEqual(['1,0', '0,1', '1,1']);
			expect(game.getState().status).toBe('playing');
		});

		test('seeding is ignored once a move exists', () => {
			const game = pocketGame();
			game.seedMines(['4,4']);
			expect(game.getRecord().mines).toEqual(['1,0', '0,1', '1,1']);
		});

		test('a loaded record keeps its layout after undoing to the start', () => {
			const game = pocketGame();
			game.undo();
			expect(game.getState().moveCount).toBe(0);

			game.reveal({ x: 4, y: 4 });
			expect(game.getRecord().mines).toEqual(['1,0', '0,1', '1,1']);
		});

		test('restart clears the seeded layout', () => {
			// If the seed survived the restart, revealing the seeded mine
			// would lose; a cleared seed re-randomizes with a safe click.
			const game = new Game({ width: 5, height: 5, bombs: 3 });
			game.seedMines(['4,4']);
			game.restart();

			game.reveal({ x: 4, y: 4 });
			expect(game.getState().status).not.toBe('lost');
		});
	});

	describe('auto options', () => {
		test('auto-flag never places flags during play', () => {
			const game = pocketGame(); // auto-flag is on by default

			// Every number sees its hidden neighbors are exactly its
			// missing mines, yet nothing may be flagged for the player.
			game.toggleFlag({ x: 0, y: 0 });

			expect(game.getState().board.flagCount).toBe(1);
			expect(game.getState().moveCount).toBe(2);
		});

		test('auto-flag off leaves the won board unflagged', () => {
			const game = pocketGame();
			game.setAuto({ autoFlag: false, autoReveal: false });

			game.reveal({ x: 0, y: 0 });

			expect(game.getState().status).toBe('won');
			expect(game.getState().board.flagCount).toBe(0);
		});

		test('auto-reveal plays out satisfied numbers, undone with the trigger', () => {
			// 3x3, one mine: flagging it satisfies the 1 at (0,0), and the
			// reveals cascade number by number to a win.
			const game = new Game();
			game.loadRecord({
				config: { width: 3, height: 3, bombs: 1 },
				mines: ['1,0'],
				moves: [{ type: 'reveal', index: { x: 0, y: 0 } }],
			});
			game.setAuto({ autoFlag: false, autoReveal: true });

			game.toggleFlag({ x: 1, y: 0 });
			expect(game.getState().status).toBe('won');

			// One undo reverts the flag and the whole cascade it caused.
			game.undo();
			expect(game.getState().status).toBe('playing');
			expect(game.getState().moveCount).toBe(1);

			game.redo();
			expect(game.getState().status).toBe('won');
		});

		test('auto moves replay from a record like any other move', () => {
			const game = new Game();
			game.loadRecord({
				config: { width: 3, height: 3, bombs: 1 },
				mines: ['1,0'],
				moves: [{ type: 'reveal', index: { x: 0, y: 0 } }],
			});
			game.setAuto({ autoFlag: false, autoReveal: true });
			game.toggleFlag({ x: 1, y: 0 });

			const replica = new Game();
			replica.setAuto({ autoFlag: false, autoReveal: true });
			replica.loadRecord(game.getRecord());
			expect(replica.getState().status).toBe('won');
			expect(replica.getState().board).toEqual(game.getState().board);
		});

		test('auto-reveal is off by default: nothing is played for you', () => {
			const game = pocketGame();

			// All mines flagged: every number is satisfied, and (0,0) is
			// free to auto-reveal — but only if the option were on.
			game.applyMany('flag', [
				{ x: 1, y: 0 },
				{ x: 0, y: 1 },
				{ x: 1, y: 1 },
			]);

			expect(game.getState().moveCount).toBe(2);
			expect(game.getState().status).toBe('playing');
		});
	});

	describe('undo memory', () => {
		test('remembers the nature of undone reveals', () => {
			const game = pocketGame();

			game.reveal({ x: 1, y: 0 });
			game.undo();

			const memory = game.getState().memory;
			expect(memory.get(Index2D.key({ x: 1, y: 0 }))).toBe('mine');
		});

		test('restart clears the memory', () => {
			const game = pocketGame();
			game.reveal({ x: 1, y: 0 });
			game.undo();
			expect(game.getState().memory.size).toBeGreaterThan(0);

			game.restart();
			expect(game.getState().memory.size).toBe(0);
		});
	});

	describe('chord', () => {
		test('a chord that changes nothing is not recorded as a move', () => {
			// The 1 at (0,0) has three hidden neighbors and no flags:
			// not satisfied, and the hidden cells are not all mines.
			const game = new Game();
			game.loadRecord({
				config: { width: 3, height: 3, bombs: 1 },
				mines: ['1,0'],
				moves: [{ type: 'reveal', index: { x: 0, y: 0 } }],
			});

			const before = game.getState().moveCount;
			game.chord({ x: 0, y: 0 });
			expect(game.getState().moveCount).toBe(before);
		});

		test('a chord that flags forced mines is one undoable move', () => {
			const game = pocketGame();

			// The 2 at (2,0) touches exactly two hidden cells: both bombs.
			game.chord({ x: 2, y: 0 });

			expect(game.getState().board.flagCount).toBe(2);
			expect(game.getState().moveCount).toBe(2);
			expect(game.getState().lastReveal).toBeNull();

			game.undo();
			expect(game.getState().board.flagCount).toBe(0);
		});

		test('a chord that reveals safe cells is one undoable move', () => {
			// Deterministic 3x3: bomb at (1,0), the 1 at (0,0) revealed
			// without flooding, so (0,1) and (1,1) stay hidden and safe.
			const game = new Game();
			game.loadRecord({
				config: { width: 3, height: 3, bombs: 1 },
				mines: ['1,0'],
				moves: [{ type: 'reveal', index: { x: 0, y: 0 } }],
			});
			game.toggleFlag({ x: 1, y: 0 });

			const before = game.getState().moveCount;
			game.chord({ x: 0, y: 0 });

			expect(game.getState().moveCount).toBe(before + 1);
			expect(game.getState().board.cells.at({ x: 0, y: 1 }).state.type).toBe(
				'revealed',
			);

			game.undo();
			expect(game.getState().moveCount).toBe(before);
			expect(game.getState().board.cells.at({ x: 0, y: 1 }).state.type).toBe(
				'hidden',
			);
		});
	});
});
