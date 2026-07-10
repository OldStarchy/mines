import Action from '../Action';
import Board from '../Board';
import Index2D from '../Index2D';

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
}

/**
 * Every mutation is expressed as an event so state can later be shared:
 * serialize events over a transport (webrtc, supabase, ...) and replay
 * them through `dispatch` on every peer.
 */
export type GameEvent =
	| { readonly type: 'reveal'; readonly index: Index2D }
	| { readonly type: 'toggleFlag'; readonly index: Index2D }
	| { readonly type: 'restart'; readonly config?: GameConfig };

/**
 * Observable, framework-agnostic game session over the immutable Board.
 * React consumes it via useSyncExternalStore; anything else can use
 * subscribe/getState directly.
 */
export default class Game {
	private state: GameState;
	private listeners = new Set<() => void>();

	constructor(config: GameConfig = PRESETS.beginner) {
		this.state = Game.initialState(config);
	}

	private static initialState(config: GameConfig): GameState {
		return {
			board: Board.ofSize(config.width, config.height),
			config,
			status: 'idle',
			startedAt: null,
			endedAt: null,
			lastReveal: null,
		};
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

	getState(): GameState {
		return this.state;
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private setState(next: GameState) {
		this.state = next;
		for (const listener of this.listeners) listener();
	}

	dispatch(event: GameEvent) {
		switch (event.type) {
			case 'reveal':
				this.reveal(event.index);
				break;
			case 'toggleFlag':
				this.toggleFlag(event.index);
				break;
			case 'restart':
				this.setState(
					Game.initialState(event.config ?? this.state.config),
				);
				break;
			default:
				event satisfies never;
		}
	}

	reveal(index: Index2D) {
		const { board, config, status } = this.state;

		if (status === 'won' || status === 'lost') return;

		if (status === 'idle') {
			const next = board.applyAction(
				Action.placeBombsAndReveal(index, config.bombs),
			);
			this.setState({
				...this.state,
				board: next,
				status: 'playing',
				startedAt: Date.now(),
				lastReveal: {
					origin: index,
					revealed: Game.revealedDiff(board, next),
				},
			});
			this.settle();
			return;
		}

		const cell = board.cells.atOrNull(index);
		if (!cell || cell.state.type !== 'hidden') return;

		const next = board.applyAction(Action.reveal(index));
		this.setState({
			...this.state,
			board: next,
			lastReveal: {
				origin: index,
				revealed: Game.revealedDiff(board, next),
			},
		});
		this.settle();
	}

	toggleFlag(index: Index2D) {
		const { board, status } = this.state;
		if (status === 'won' || status === 'lost') return;

		const cell = board.cells.atOrNull(index);
		if (!cell) return;

		if (cell.state.type === 'hidden') {
			this.setState({ ...this.state, board: board.applyAction(Action.flag(index)) });
		} else if (cell.state.type === 'flagged') {
			this.setState({ ...this.state, board: board.applyAction(Action.unflag(index)) });
		}
	}

	restart(config?: GameConfig) {
		this.dispatch({ type: 'restart', config });
	}

	/** Moves the game to won/lost after a board change. */
	private settle() {
		const { board, status } = this.state;
		if (status !== 'playing') return;

		if (board.isLost) {
			this.setState({ ...this.state, status: 'lost', endedAt: Date.now() });
		} else if (board.isWon) {
			this.setState({ ...this.state, status: 'won', endedAt: Date.now() });
		}
	}
}
