import Action from '../Action';
import Board from '../Board';
import Index2D from '../Index2D';
import {
	applyMove,
	autoStep,
	baseBoard,
	boardsForRecord,
	moveOrigin,
	moveReveals,
	revealedDiff,
	withWinFlags,
	type AutoOptions,
	type GameRecord,
	type Move,
} from './GameRecord';

export type { AutoOptions } from './GameRecord';

export interface GameConfig {
	readonly width: number;
	readonly height: number;
	readonly bombs: number;
}

// A shade under the classic 10/40/99: those ratios ask for a bit too
// much guessing luck.
export const PRESETS = {
	beginner: { width: 9, height: 9, bombs: 9 },
	intermediate: { width: 16, height: 16, bombs: 36 },
	expert: { width: 30, height: 16, bombs: 92 },
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
	| {
			readonly type: 'batch';
			readonly action: 'flag' | 'reveal';
			readonly indices: readonly Index2D[];
	  }
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
	/**
	 * A mine layout fixed from outside (a multiplayer host or a loaded
	 * record). While set, the first reveal uses it instead of
	 * randomizing, so replicas and rematches reproduce the same board.
	 */
	private seededMines: string[] | null = null;
	private moves: Move[] = [];
	/** boards[i] is the board after moves[i]; base board is not stored. */
	private boards: Board[] = [];
	/** Undone moves available for redo, most-recent last. */
	private future: Move[] = [];
	private auto: AutoOptions = { autoFlag: true, autoReveal: false };
	/**
	 * Moves played by the auto pass rather than the player. Undo/redo
	 * treat a player move and its auto follow-ups as one group. Not
	 * serialized — a loaded record replays them as ordinary moves.
	 */
	private autoMoves = new WeakSet<Move>();
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
			case 'batch':
				this.applyMany(event.action, event.indices);
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

	/**
	 * Configures what the game does for the player: auto-flag (dress the
	 * won board's remaining mines with flags) and auto-reveal (chord
	 * satisfied numbers after each move). Takes effect from the next
	 * move — the board is never changed by the toggle itself, so
	 * switching mid-game is safe (and replicable).
	 */
	setAuto(auto: AutoOptions) {
		this.auto = { ...auto };
	}

	/**
	 * Plays auto-reveals after a player move. Each pass lands as one
	 * batch move (its own replay tick) marked as auto, so a single undo
	 * reverts the player move together with everything it caused.
	 */
	private autoPass() {
		if (!this.auto.autoReveal) return;
		for (;;) {
			const board = this.currentBoard();
			if (this.deriveStatus(board) !== 'playing') return;
			const indices = autoStep(board, this.auto);
			if (!indices) return;
			const move: Move = { type: 'batch', action: 'reveal', indices };
			this.autoMoves.add(move);
			this.pushMove(
				move,
				applyMove(board, move, this.auto.autoFlag),
				board,
			);
		}
	}

	/**
	 * Fixes the mine layout before the game starts (multiplayer replicas
	 * receive the host's layout this way). Ignored once a move exists;
	 * calling again at move zero replaces the layout.
	 */
	seedMines(mines: readonly string[]) {
		if (this.moves.length > 0) return;
		this.seededMines = [...mines];
		this.mines = [...mines];
		this.commit();
	}

	/** Records a move that produced `next`, dropping any redo branch. */
	private pushMove(move: Move, next: Board, revealedFrom: Board | null) {
		if (this.moves.length === 0) this.startedAt = Date.now();
		this.moves.push(move);
		this.boards.push(next);
		this.future.length = 0;
		this.lastReveal = revealedFrom
			? {
					origin: moveOrigin(move),
					revealed: revealedDiff(revealedFrom, next),
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
		// Seeded games keep their fixed layout instead.
		if (status === 'idle') {
			if (this.seededMines) {
				this.mines = [...this.seededMines];
				const base = this.currentBoard();
				const move: Move = { type: 'reveal', index };
				this.pushMove(move, applyMove(base, move, this.auto.autoFlag), base);
				this.autoPass();
				return;
			}
			const seeded = Board.ofSize(
				this.config.width,
				this.config.height,
			).applyAction(
				Action.placeBombsAndReveal(index, this.config.bombs),
			);
			this.mines = seeded.mineKeys();
			this.pushMove(
				{ type: 'reveal', index },
				this.auto.autoFlag ? withWinFlags(seeded) : seeded,
				Board.ofSize(this.config.width, this.config.height),
			);
			this.autoPass();
			return;
		}

		const cell = board.cells.atOrNull(index);
		if (!cell || cell.state.type !== 'hidden') return;

		const move: Move = { type: 'reveal', index };
		this.pushMove(move, applyMove(board, move, this.auto.autoFlag), board);
		this.autoPass();
	}

	chord(at: Index2D) {
		const index = { x: at.x, y: at.y };
		const board = this.currentBoard();
		if (this.deriveStatus(board) !== 'playing') return;

		const next = applyMove(board, { type: 'chord', index }, this.auto.autoFlag);
		const revealed = revealedDiff(board, next).length > 0;
		const flagged = next.flagCount !== board.flagCount;
		// A chord that neither reveals nor flags anything isn't a move.
		if (!revealed && !flagged) return;

		this.pushMove({ type: 'chord', index }, next, revealed ? board : null);
		this.autoPass();
	}

	/**
	 * Applies several same-type actions as ONE move — the assistant's
	 * multi-cell suggestions behave like a chord: one undo step, one
	 * replay tick. Cells that are no longer actionable are skipped.
	 */
	applyMany(action: 'flag' | 'reveal', cells: readonly Index2D[]) {
		const board = this.currentBoard();
		if (this.deriveStatus(board) !== 'playing') return;

		const indices = cells.map((at) => ({ x: at.x, y: at.y }));
		const move: Move = { type: 'batch', action, indices };
		const next = applyMove(board, move, this.auto.autoFlag);

		const revealed = revealedDiff(board, next).length > 0;
		if (!revealed && next.flagCount === board.flagCount) return;

		this.pushMove(move, next, revealed ? board : null);
		this.autoPass();
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
			this.autoPass();
		} else if (cell.state.type === 'flagged') {
			this.pushMove(
				{ type: 'unflag', index },
				board.applyAction(Action.unflag(index)),
				null,
			);
			this.autoPass();
		}
	}

	/**
	 * Undoes the last player move together with any auto-played
	 * follow-ups above it — one undo per player intent.
	 */
	undo() {
		if (this.boards.length === 0) return;

		while (
			this.moves.length > 1 &&
			this.autoMoves.has(this.moves[this.moves.length - 1])
		) {
			this.undoOne();
		}
		this.undoOne();

		this.lastReveal = null;
		this.commit();
	}

	private undoOne() {
		const undoneBoard = this.boards.pop()!;
		const move = this.moves.pop()!;
		this.future.push(move);

		// The player saw whatever that move revealed; remember it.
		if (moveReveals(move)) {
			const previous = this.currentBoard();
			for (const key of revealedDiff(previous, undoneBoard)) {
				const cell = undoneBoard.cells.at(Index2D.fromKey(key));
				this.memory.set(key, cell.isBomb ? 'mine' : 'safe');
			}
		}
	}

	/** Redoes one player move and its auto-played follow-ups. */
	redo() {
		if (this.future.length === 0) return;

		const before = this.currentBoard();
		const first = this.future[this.future.length - 1];
		do {
			this.redoOne();
		} while (
			this.future.length > 0 &&
			this.autoMoves.has(this.future[this.future.length - 1])
		);

		const revealed = revealedDiff(before, this.currentBoard());
		this.lastReveal =
			revealed.length > 0
				? { origin: moveOrigin(first), revealed }
				: null;
		this.commit();
	}

	private redoOne() {
		const move = this.future.pop()!;
		this.moves.push(move);
		this.boards.push(
			applyMove(this.currentBoard(), move, this.auto.autoFlag),
		);
	}

	restart(config?: GameConfig) {
		this.config = config ?? this.config;
		this.mines = [];
		this.seededMines = null;
		this.moves = [];
		this.boards = [];
		this.future = [];
		this.memory.clear();
		this.startedAt = null;
		this.endedAt = null;
		this.lastReveal = null;
		this.commit();
	}

	/**
	 * Replaces the whole session with a saved record (undo memory
	 * resets). `elapsedMs` restores previously accumulated play time so
	 * the timer resumes instead of restarting from zero.
	 */
	loadRecord(record: GameRecord, elapsedMs = 0) {
		this.config = record.config;
		this.mines = [...record.mines];
		// A loaded layout stays fixed: undoing back to the start and
		// re-revealing must not re-roll the board (competitive fairness).
		this.seededMines = record.mines.length > 0 ? [...record.mines] : null;
		this.moves = [...record.moves];
		this.boards = boardsForRecord(record, this.auto.autoFlag);
		this.future = [];
		this.memory.clear();
		this.startedAt =
			record.moves.length > 0 ? Date.now() - elapsedMs : null;
		this.endedAt = null;
		this.lastReveal = null;
		this.commit();
	}
}
