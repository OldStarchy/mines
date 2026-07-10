import Action from '../Action';
import Board from '../Board';
import type Index2D from '../Index2D';
import type { GameConfig } from './Game';

/** A single semantic move a player can make. One move = one replay tick. */
export type MoveType = 'reveal' | 'chord' | 'flag' | 'unflag';

export interface Move {
	readonly type: MoveType;
	readonly index: Index2D;
}

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
	}
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

const CURRENT_VERSION = 1;

interface SerializedRecord {
	readonly v: number;
	readonly config: GameConfig;
	readonly mines: readonly string[];
	readonly moves: readonly [MoveType, number, number][];
}

export function serializeRecord(record: GameRecord): string {
	const payload: SerializedRecord = {
		v: CURRENT_VERSION,
		config: record.config,
		mines: record.mines,
		moves: record.moves.map((m) => [m.type, m.index.x, m.index.y]),
	};
	return JSON.stringify(payload);
}

export function deserializeRecord(json: string): GameRecord | null {
	try {
		const data = JSON.parse(json) as SerializedRecord;
		if (data.v !== CURRENT_VERSION) return null;
		if (!data.config || !Array.isArray(data.moves)) return null;

		return {
			config: data.config,
			mines: data.mines ?? [],
			moves: data.moves.map(([type, x, y]) => ({ type, index: { x, y } })),
		};
	} catch {
		return null;
	}
}
