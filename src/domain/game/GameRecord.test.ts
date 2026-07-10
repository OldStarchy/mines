import { describe, expect, test } from 'vitest';
import Game from './Game';
import {
	boardsForRecord,
	deserializeRecord,
	serializeRecord,
} from './GameRecord';

describe('GameRecord', () => {
	test('round-trips a game through serialization', () => {
		const game = new Game({ width: 6, height: 6, bombs: 5 });
		game.reveal({ x: 3, y: 3 });
		const hidden = game
			.getState()
			.board.cells.toArray()
			.filter((c) => c.state.type === 'hidden');
		game.toggleFlag(hidden[0]);
		game.reveal(hidden[1]);

		const json = serializeRecord(game.getRecord());
		const restored = deserializeRecord(json)!;

		expect(restored.config).toEqual(game.getRecord().config);
		expect(restored.mines).toEqual(game.getRecord().mines);
		expect(restored.moves).toEqual(game.getRecord().moves);
	});

	test('reconstructs the identical board from a record', () => {
		const game = new Game({ width: 6, height: 6, bombs: 5 });
		game.reveal({ x: 3, y: 3 });
		const hidden = game
			.getState()
			.board.cells.toArray()
			.filter((c) => c.state.type === 'hidden');
		game.reveal(hidden[0]);

		const boards = boardsForRecord(game.getRecord());
		expect(boards.at(-1)!.cells.toArray()).toEqual(
			game.getState().board.cells.toArray(),
		);
	});

	test('loadRecord restores a game into a fresh instance', () => {
		const original = new Game({ width: 6, height: 6, bombs: 5 });
		original.reveal({ x: 3, y: 3 });
		const record = original.getRecord();

		const loaded = new Game();
		loaded.loadRecord(record);

		expect(loaded.getState().board.cells.toArray()).toEqual(
			original.getState().board.cells.toArray(),
		);
	});

	test('rejects malformed or versioned-out data', () => {
		expect(deserializeRecord('not json')).toBeNull();
		expect(deserializeRecord('{"v":999}')).toBeNull();
	});
});
