import Action from '../Action';
import Board from '../Board';
import Index2D from '../Index2D';
import {
	baseBoard,
	boardsForRecord,
	type GameRecord,
	type Move,
} from './GameRecord';

export interface GameConfig {
	readonly width: number;
	readonly height: number;
	readonly bombs: number;
}

export const PRESETS = {
	beginner: { width: 9, height: 9, bombs: 10 },
	intermediate: { width: 16, height: 16, bombs: 40 },
	expert: { width: 30, height: 16, bombs: 99 },
} as const satisfies Record<string, GameConfig>;

export type PresetName = keyof typeof PRESETS;

export type GameStatus = 'idle' | 'playing' | 'won' | 'lost';

/** What the player learned about a cell by revealing then undoing it. */
export type CellKnowledge = 'mine' | 'safe';

export interface GameState {
	readonly board: Board;
	readonly config: GameConfig;
	readonly status: GameStatus;
	readonly startedAt: number | null;
	readonly endedAt: number | null;
	/**
	 * Cells newly revealed by the latest reveal, with its origin —
	 * lets the UI animate flood-fills as a wave from the click.
	 */
	readonly lastReveal: {
		readonly origin: Index2D;
		readonly revealed: readonly string[];
	} | null;
	readonly canUndo: boolean;
	readonly canRedo: boolean;
	readonly moveCount: number;
	/**
	 * Cells the player revealed and then undid, with what they saw.
	 * The assistant may optionally use this as "you've seen this before"
	 * knowledge (off by default — it is meta-gaming).
	 */
	readonly memory: ReadonlyMap<string, CellKnowledge>;
}

/**
 * Every mutation is expressed as an event so state can later be shared:
 * serialize events over a transport (webrtc, supabase, ...) and replay
 * them through `dispatch` on every peer.
 */
export type GameEvent =
	| { readonly type: 'reveal'; readonly index: Index2D }
	| { readonly type: 'chord'; readonly index: Index2D }
	| { readonly type: 'toggleFlag'; readonly index: Index2D }
	| { readonly type: 'undo' }
	| { readonly type: 'redo' }
	| { readonly type: 'restart'; readonly config?: GameConfig };

/**
 * Observable, framework-agnostic game session.
 *
 * The source of truth is a move log plus the fixed mine layout (see
 * GameRecord); the board after each move is kept as a snapshot so undo
 * is O(1) and the whole game can be serialized or replayed. React
 * consumes state via useSyncExternalStore; anything else can use
 * subscribe/getState directly.
 */
export default class Game {
	private config: GameConfig;
	private mines: string[] = [];
	private moves: Move[] = [];
	/** boards[i] is the board after moves[i]; base board is not stored. */
	private boards: Board[] = [];
	/** Undone moves available for redo, most-recent last. */
	private future: Move[] = [];
	private memory = new Map<string, CellKnowledge>();
	private startedAt: number | null = null;
	private endedAt: number | null = null;
	private lastReveal: GameState['lastReveal'] = null;

	private state: GameState;
	private listeners = new Set<() => void>();

	constructor(config: GameConfig = PRESETS.beginner) {
		this.config = config;
		this.state = this.buildState();
	}

	private currentBoard(): Board {
		return this.boards.length > 0
			? this.boards[this.boards.length - 1]
			: baseBoard({ config: this.config, mines: this.mines, moves: [] });
	}

	private deriveStatus(board: Board): GameStatus {
		if (this.moves.length === 0) return 'idle';
		if (board.isLost) return 'lost';
		if (board.isWon) return 'won';
		return 'playing';
	}

	private static revealedDiff(prev: Board, next: Board): string[] {
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

	private buildState(): GameState {
		const board = this.currentBoard();
		const status = this.deriveStatus(board);

		if (status === 'won' || status === 'lost') {
			if (this.endedAt === null) this.endedAt = Date.now();
		} else {
			this.endedAt = null;
		}

		return {
			board,
			config: this.config,
			status,
			startedAt: this.startedAt,
			endedAt: this.endedAt,
			lastReveal: this.lastReveal,
			canUndo: this.boards.length > 0,
			canRedo: this.future.length > 0,
			moveCount: this.moves.length,
			memory: new Map(this.memory),
		};
	}

	private commit() {
		this.state = this.buildState();
		for (const listener of this.listeners) listener();
	}

	getState(): GameState {
		return this.state;
	}

	getRecord(): GameRecord {
		return {
			config: this.config,
			mines: [...this.mines],
			moves: [...this.moves],
		};
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	dispatch(event: GameEvent) {
		switch (event.type) {
			case 'reveal':
				this.reveal(event.index);
				break;
			case 'chord':
				this.chord(event.index);
				break;
			case 'toggleFlag':
				this.toggleFlag(event.index);
				break;
			case 'undo':
				this.undo();
				break;
			case 'redo':
				this.redo();
				break;
			case 'restart':
				this.restart(event.config);
				break;
			default:
				event satisfies never;
		}
	}

	/** Records a move that produced `next`, dropping any redo branch. */
	private pushMove(move: Move, next: Board, revealedFrom: Board | null) {
		if (this.moves.length === 0) this.startedAt = Date.now();
		this.moves.push(move);
		this.boards.push(next);
		this.future.length = 0;
		this.lastReveal = revealedFrom
			? {
					origin: move.index,
					revealed: Game.revealedDiff(revealedFrom, next),
				}
			: null;
		this.commit();
	}

	reveal(at: Index2D) {
		const index = { x: at.x, y: at.y };
		const board = this.currentBoard();
		const status = this.deriveStatus(board);
		if (status === 'won' || status === 'lost') return;

		// First reveal places bombs (avoiding the click) and starts a
		// fresh branch, re-randomizing so the first click is always safe.
		if (status === 'idle') {
			const seeded = Board.ofSize(
				this.config.width,
				this.config.height,
			).applyAction(
				Action.placeBombsAndReveal(index, this.config.bombs),
			);
			this.mines = seeded.mineKeys();
			this.pushMove(
				{ type: 'reveal', index },
				seeded,
				Board.ofSize(this.config.width, this.config.height),
			);
			return;
		}

		const cell = board.cells.atOrNull(index);
		if (!cell || cell.state.type !== 'hidden') return;

		this.pushMove(
			{ type: 'reveal', index },
			board.applyAction(Action.reveal(index)),
			board,
		);
	}

	chord(at: Index2D) {
		const index = { x: at.x, y: at.y };
		const board = this.currentBoard();
		if (this.deriveStatus(board) !== 'playing') return;

		const next = board.applyAction(Action.chord(index));
		// A chord on an unsatisfied number reveals nothing; don't record it.
		if (Game.revealedDiff(board, next).length === 0) return;

		this.pushMove({ type: 'chord', index }, next, board);
	}

	toggleFlag(at: Index2D) {
		const index = { x: at.x, y: at.y };
		const board = this.currentBoard();
		if (this.deriveStatus(board) !== 'playing') return;

		const cell = board.cells.atOrNull(index);
		if (!cell) return;

		if (cell.state.type === 'hidden') {
			this.pushMove(
				{ type: 'flag', index },
				board.applyAction(Action.flag(index)),
				null,
			);
		} else if (cell.state.type === 'flagged') {
			this.pushMove(
				{ type: 'unflag', index },
				board.applyAction(Action.unflag(index)),
				null,
			);
		}
	}

	undo() {
		if (this.boards.length === 0) return;

		const undoneBoard = this.boards.pop()!;
		const move = this.moves.pop()!;
		this.future.push(move);

		// The player saw whatever that move revealed; remember it.
		if (move.type === 'reveal' || move.type === 'chord') {
			const previous = this.currentBoard();
			for (const key of Game.revealedDiff(previous, undoneBoard)) {
				const cell = undoneBoard.cells.at(Index2D.fromKey(key));
				this.memory.set(key, cell.isBomb ? 'mine' : 'safe');
			}
		}

		this.lastReveal = null;
		this.commit();
	}

	redo() {
		const move = this.future.pop();
		if (!move) return;

		const board = this.currentBoard();
		const next = boardsForRecord({
			config: this.config,
			mines: this.mines,
			moves: [...this.moves, move],
		}).at(-1)!;

		this.moves.push(move);
		this.boards.push(next);
		this.lastReveal =
			move.type === 'reveal' || move.type === 'chord'
				? {
						origin: move.index,
						revealed: Game.revealedDiff(board, next),
					}
				: null;
		this.commit();
	}

	restart(config?: GameConfig) {
		this.config = config ?? this.config;
		this.mines = [];
		this.moves = [];
		this.boards = [];
		this.future = [];
		this.memory.clear();
		this.startedAt = null;
		this.endedAt = null;
		this.lastReveal = null;
		this.commit();
	}

	/** Replaces the whole session with a saved record (undo memory resets). */
	loadRecord(record: GameRecord) {
		this.config = record.config;
		this.mines = [...record.mines];
		this.moves = [...record.moves];
		this.boards = boardsForRecord(record);
		this.future = [];
		this.memory.clear();
		this.startedAt = record.moves.length > 0 ? Date.now() : null;
		this.endedAt = null;
		this.lastReveal = null;
		this.commit();
	}
}
