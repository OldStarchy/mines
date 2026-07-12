import Action from '../Action';
import Board from '../Board';
import Index2D from '../Index2D';
import Range2D from '../Range2D';
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
			return withWinFlags(board.applyAction(Action.reveal(move.index)));
		case 'chord':
			return withWinFlags(board.applyAction(Action.chord(move.index)));
		case 'flag':
			return board.applyAction(Action.flag(move.index));
		case 'unflag':
			return board.applyAction(Action.unflag(move.index));
		case 'batch':
			return withWinFlags(
				move.indices.reduce(
					(b, index) =>
						b.applyAction(
							move.action === 'flag'
								? Action.flag(index)
								: Action.reveal(index),
						),
					board,
				),
			);
	}
}

/**
 * A won board flags its remaining hidden cells (all mines by
 * definition) — the classic end-of-game auto-flag. Applied to every
 * move's result, so replay, undo snapshots and multiplayer replicas
 * agree without recording extra moves.
 */
export function withWinFlags(board: Board): Board {
	if (!board.isWon) return board;
	return board.cells
		.toArray()
		.filter((cell) => cell.state.type === 'hidden')
		.reduce((b, cell) => b.applyAction(Action.flag(cell)), board);
}

/** Which forced follow-ups the game plays by itself after each move. */
export interface AutoOptions {
	/** Flag cells some revealed number proves must be mines. */
	readonly autoFlag: boolean;
	/** Reveal neighbors of numbers already satisfied by their flags. */
	readonly autoReveal: boolean;
}

/**
 * One step of the auto-play pass, or null at the fixpoint. Flags come
 * first — new flags are what satisfy numbers and enable reveals. Both
 * follow the flags on the board, right or wrong, exactly like a chord.
 */
export function autoStep(
	board: Board,
	options: AutoOptions,
): { action: 'flag' | 'reveal'; indices: Index2D[] } | null {
	const flags = new Map<string, Index2D>();
	const reveals = new Map<string, Index2D>();

	for (const cell of board.cells.toArray()) {
		if (cell.state.type !== 'revealed' || cell.isBomb) continue;
		if (cell.state.number === 0) continue;

		const neighbors = board.cells
			.slice(Range2D.around(cell))
			.toArray()
			.filter((c) => c !== cell);
		const flagged = neighbors.filter(
			(c) => c.state.type === 'flagged',
		).length;
		const hidden = neighbors.filter((c) => c.state.type === 'hidden');
		if (hidden.length === 0) continue;

		const target =
			options.autoFlag && flagged + hidden.length === cell.state.number
				? flags
				: options.autoReveal && flagged === cell.state.number
					? reveals
					: null;
		if (!target) continue;
		for (const c of hidden) target.set(Index2D.key(c), { x: c.x, y: c.y });
	}

	if (flags.size > 0) return { action: 'flag', indices: [...flags.values()] };
	if (reveals.size > 0)
		return { action: 'reveal', indices: [...reveals.values()] };
	return null;
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
