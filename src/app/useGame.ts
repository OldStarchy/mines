import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import Game, { type GameConfig, type GameState } from '../domain/game/Game';
import type { GameRecord } from '../domain/game/GameRecord';
import { loadGame, saveGame, saveLastConfig } from './persistence';

/**
 * Creates a Game once, restoring any saved game for the initial config,
 * subscribes React to its state, and persists every change so a reload
 * resumes exactly where the player left off.
 */
export default function useGame(initialConfig: GameConfig): {
	game: Game;
	state: GameState;
} {
	const gameRef = useRef<Game | null>(null);
	if (gameRef.current === null) {
		const game = new Game(initialConfig);
		const saved: GameRecord | null = loadGame(initialConfig);
		if (saved) game.loadRecord(saved);
		gameRef.current = game;
	}
	const game = gameRef.current;

	const subscribe = useCallback(
		(onChange: () => void) => game.subscribe(onChange),
		[game],
	);
	const state = useSyncExternalStore(subscribe, () => game.getState());

	useEffect(() => {
		saveGame(game.getRecord());
		saveLastConfig(state.config);
	}, [game, state]);

	return { game, state };
}
