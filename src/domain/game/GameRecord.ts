import Action from '../Action';
import Board from '../Board';
import Index2D from '../Index2D';
import type { GameConfig } from './Game';

/** A single semantic move a player can make. One move = one replay tick. */
export type SingleMoveType = 'reveal' | 'chord' | 'flag' | 'unflag';

export type Move =
	| { readonly type: SingleMoveType; readonly index: Index2D }
	| {
			/**
			 * Several proven actions applied together — the assistant's
			 * multi-cell suggestions land as one move, chord-style: one
			 * undo step, one replay tick.
			 */
			readonly type: 'batch';
			readonly action: 'flag' | 'reveal';
			readonly indices: readonly Index2D[];
	  };

/**
 * A complete, serializable game: its configuration, the fixed mine
 * layout (empty until the first reveal places it), and the ordered log
 * of moves. Everything else — the board at any point, win/loss, the
 * replay — is a pure function of this record.
 */
export interface GameRecord {
	readonly config: GameConfig;
	/** Bomb cell keys (see Index2D.key). Empty before the first reveal. */
	readonly mines: readonly string[];
	readonly moves: readonly Move[];
}

export function emptyRecord(config: GameConfig): GameRecord {
	return { config, mines: [], moves: [] };
}

export function applyMove(board: Board, move: Move): Board {
	switch (move.type) {
		case 'reveal':
			return board.applyAction(Action.reveal(move.index));
		case 'chord':
			return board.applyAction(Action.chord(move.index));
		case 'flag':
			return board.applyAction(Action.flag(move.index));
		case 'unflag':
			return board.applyAction(Action.unflag(move.index));
		case 'batch':
			return move.indices.reduce(
				(b, index) =>
					b.applyAction(
						move.action === 'flag'
							? Action.flag(index)
							: Action.reveal(index),
					),
				board,
			);
	}
}

/** Whether a move can reveal cells (and so can start a reveal wave). */
export function moveReveals(move: Move): boolean {
	if (move.type === 'batch') return move.action === 'reveal';
	return move.type === 'reveal' || move.type === 'chord';
}

/** Where a move's reveal wave starts. */
export function moveOrigin(move: Move): Index2D {
	return move.type === 'batch' ? move.indices[0] : move.index;
}

/** The board before any move: fully hidden, with the recorded mines. */
export function baseBoard(record: GameRecord): Board {
	const size = { width: record.config.width, height: record.config.height };
	return record.mines.length > 0
		? Board.create(size, record.mines)
		: Board.ofSize(size.width, size.height);
}

/**
 * The board after each move, in order. Index i is the board after
 * moves[i]; the base board is not included. Deterministic — this is
 * what both undo and replay reconstruct from.
 */
export function boardsForRecord(record: GameRecord): Board[] {
	let board = baseBoard(record);
	const boards: Board[] = [];
	for (const move of record.moves) {
		board = applyMove(board, move);
		boards.push(board);
	}
	return boards;
}

/** Keys of the cells revealed by the step from `prev` to `next`. */
export function revealedDiff(prev: Board, next: Board): string[] {
	const before = prev.cells.toArray();
	return next.cells
		.toArray()
		.filter(
			(cell, i) =>
				cell.state.type === 'revealed' &&
				before[i].state.type !== 'revealed',
		)
		.map(Index2D.key);
}

// v1: single moves only. v2 adds batch moves; v1 records still load.
const CURRENT_VERSION = 2;

type SerializedMove =
	| [SingleMoveType, number, number]
	| ['batch', 'flag' | 'reveal', ...number[]];

interface SerializedRecord {
	readonly v: number;
	readonly config: GameConfig;
	readonly mines: readonly string[];
	readonly moves: readonly SerializedMove[];
}

function serializeMove(move: Move): SerializedMove {
	if (move.type === 'batch') {
		return [
			'batch',
			move.action,
			...move.indices.flatMap((i) => [i.x, i.y]),
		];
	}
	return [move.type, move.index.x, move.index.y];
}

function deserializeMove(move: SerializedMove): Move {
	if (move[0] === 'batch') {
		const [, action, ...coords] = move;
		const indices: Index2D[] = [];
		for (let i = 0; i + 1 < coords.length; i += 2)
			indices.push({ x: coords[i], y: coords[i + 1] });
		return { type: 'batch', action, indices };
	}
	const [type, x, y] = move;
	return { type, index: { x, y } };
}

export function serializeRecord(record: GameRecord): string {
	const payload: SerializedRecord = {
		v: CURRENT_VERSION,
		config: record.config,
		mines: record.mines,
		moves: record.moves.map(serializeMove),
	};
	return JSON.stringify(payload);
}

export function deserializeRecord(json: string): GameRecord | null {
	try {
		const data = JSON.parse(json) as SerializedRecord;
		if (data.v !== 1 && data.v !== CURRENT_VERSION) return null;
		if (!data.config || !Array.isArray(data.moves)) return null;

		return {
			config: data.config,
			mines: data.mines ?? [],
			moves: data.moves.map(deserializeMove),
		};
	} catch {
		return null;
	}
}
