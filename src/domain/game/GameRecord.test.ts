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

	test('round-trips batch moves', () => {
		const game = new Game();
		game.loadRecord({
			config: { width: 5, height: 5, bombs: 3 },
			mines: ['1,0', '0,1', '1,1'],
			moves: [{ type: 'reveal', index: { x: 4, y: 4 } }],
		});
		game.applyMany('flag', [
			{ x: 1, y: 0 },
			{ x: 1, y: 1 },
		]);

		const restored = deserializeRecord(
			serializeRecord(game.getRecord()),
		)!;
		expect(restored.moves).toEqual(game.getRecord().moves);
		// The batch is one move, so it replays as one tick.
		expect(restored.moves).toHaveLength(2);
		expect(boardsForRecord(restored)).toHaveLength(2);
	});

	test('still reads v1 records (single moves only)', () => {
		const v1 =
			'{"v":1,"config":{"width":3,"height":3,"bombs":1},"mines":["1,0"],"moves":[["reveal",0,0]]}';

		expect(deserializeRecord(v1)).toEqual({
			config: { width: 3, height: 3, bombs: 1 },
			mines: ['1,0'],
			moves: [{ type: 'reveal', index: { x: 0, y: 0 } }],
		});
	});

	test('rejects malformed or versioned-out data', () => {
		expect(deserializeRecord('not json')).toBeNull();
		expect(deserializeRecord('{"v":999}')).toBeNull();
	});
});
