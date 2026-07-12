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

	const restore = useCallback((game: Game, config: GameConfig): boolean => {
		const saved = loadGame(config);
		if (!saved) return false;
		const meta = loadMeta(config);
		game.loadRecord(saved, meta?.elapsed ?? 0);
		clicksRef.current = meta?.clicks ?? 0;
		assistedRef.current = meta?.assisted ?? false;
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
		}),
		[game],
	);

	const previousStatus = useRef(state.status);
	useEffect(() => {
		// A fresh board starts fresh meta. Undo back to move zero keeps
		// it (canRedo) — that is still the same session, and the undo
		// already marked it assisted.
		if (
			state.status === 'idle' &&
			previousStatus.current !== 'idle' &&
			!state.canRedo
		) {
			clicksRef.current = 0;
			assistedRef.current = false;
		}
		previousStatus.current = state.status;

		saveGame(game.getRecord(), meta());
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
