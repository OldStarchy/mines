import {
	useCallback,
	useEffect,
	useRef,
	useSyncExternalStore,
} from 'react';
import Game, { type GameConfig, type GameState } from '../domain/game/Game';
import {
	loadGame,
	loadMeta,
	saveGame,
	saveLastConfig,
	type SaveMeta,
} from './persistence';
import { recordOutcome, recordStart } from './stats';

function elapsedMs(state: GameState): number {
	if (state.startedAt === null) return 0;
	return (state.endedAt ?? Date.now()) - state.startedAt;
}

/**
 * Creates a Game once, restoring any saved game for the initial config,
 * subscribes React to its state, and persists every change so a reload
 * resumes exactly where the player left off — board, timer, and the
 * session meta (clicks, assists) that the move log can't derive.
 */
export default function useGame(initialConfig: GameConfig): {
	game: Game;
	state: GameState;
	/** Loads the saved game for a config, or starts fresh without one. */
	resume: (config: GameConfig) => void;
	/** Counts a raw board click (no-ops included) for the click ratio. */
	noteClick: () => void;
	/** Marks this game as assisted (assistant on, or undo used). */
	noteAssist: () => void;
	/** The current game's meta, as it would be saved right now. */
	meta: () => SaveMeta;
} {
	const gameRef = useRef<Game | null>(null);
	const clicksRef = useRef(0);
	const assistedRef = useRef(false);
	/** Whether this game's outcome already went into the statistics. */
	const countedRef = useRef(false);

	const restore = useCallback((game: Game, config: GameConfig): boolean => {
		const saved = loadGame(config);
		if (!saved) return false;
		const meta = loadMeta(config);
		game.loadRecord(saved, meta?.elapsed ?? 0);
		clicksRef.current = meta?.clicks ?? 0;
		assistedRef.current = meta?.assisted ?? false;
		countedRef.current = meta?.counted ?? false;
		return true;
	}, []);

	if (gameRef.current === null) {
		const game = new Game(initialConfig);
		restore(game, initialConfig);
		gameRef.current = game;
	}
	const game = gameRef.current;

	const subscribe = useCallback(
		(onChange: () => void) => game.subscribe(onChange),
		[game],
	);
	const state = useSyncExternalStore(subscribe, () => game.getState());

	const meta = useCallback(
		(): SaveMeta => ({
			elapsed: elapsedMs(game.getState()),
			status: game.getState().status,
			clicks: clicksRef.current,
			assisted: assistedRef.current,
			counted: countedRef.current,
		}),
		[game],
	);

	const previousStatus = useRef(state.status);
	const previousCanRedo = useRef(state.canRedo);
	useEffect(() => {
		const previous = previousStatus.current;
		previousStatus.current = state.status;
		const couldRedo = previousCanRedo.current;
		previousCanRedo.current = state.canRedo;

		// A fresh board starts fresh meta. Undo back to move zero keeps
		// it (canRedo) — that is still the same session, and the undo
		// already marked it assisted.
		if (state.status === 'idle' && previous !== 'idle' && !state.canRedo) {
			clicksRef.current = 0;
			assistedRef.current = false;
			countedRef.current = false;
		}

		// Statistics: count a game when its first move lands (redoing
		// back from move zero is not a new game), and its outcome once.
		if (state.status === 'playing' && previous === 'idle' && !couldRedo) {
			recordStart(state.config);
		}
		if (
			(state.status === 'won' || state.status === 'lost') &&
			previous === 'playing' &&
			!countedRef.current
		) {
			countedRef.current = true;
			recordOutcome(state.config, state.status, game.getRecord(), meta());
		}

		// Wiping the slot for a fresh board discards any unfinished,
		// uncounted game still stored there: that game was abandoned.
		const record = game.getRecord();
		if (record.moves.length === 0 && !state.canRedo) {
			const oldMeta = loadMeta(state.config);
			if (oldMeta && oldMeta.status === 'playing' && !oldMeta.counted) {
				const oldRecord = loadGame(state.config);
				if (oldRecord) {
					recordOutcome(
						state.config,
						'abandoned',
						oldRecord,
						oldMeta,
					);
				}
			}
		}

		saveGame(record, meta());
		saveLastConfig(state.config);
	}, [game, state, meta]);

	// The timer's elapsed value only hits storage when state changes;
	// catch up on the way out so idle time before a reload isn't lost.
	useEffect(() => {
		const flush = () => {
			if (game.getState().moveCount > 0) {
				saveGame(game.getRecord(), meta());
			}
		};
		window.addEventListener('pagehide', flush);
		return () => window.removeEventListener('pagehide', flush);
	}, [game, meta]);

	return {
		game,
		state,
		resume: useCallback(
			(config: GameConfig) => {
				if (!restore(game, config)) game.restart(config);
			},
			[game, restore],
		),
		noteClick: useCallback(() => {
			const status = game.getState().status;
			if (status === 'idle' || status === 'playing') clicksRef.current++;
		}, [game]),
		noteAssist: useCallback(() => {
			assistedRef.current = true;
		}, []),
		meta,
	};
}
