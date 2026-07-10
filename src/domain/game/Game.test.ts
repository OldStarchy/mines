import { describe, expect, test } from 'vitest';
import Game, { PRESETS } from './Game';

describe('Game', () => {
	test('first reveal places bombs and starts the game', () => {
		const game = new Game(PRESETS.beginner);
		expect(game.getState().status).toBe('idle');

		game.reveal({ x: 4, y: 4 });

		const state = game.getState();
		expect(state.status).toBe('playing');
		expect(state.board.bombCount).toBe(10);
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
});
