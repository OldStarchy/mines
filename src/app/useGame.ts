import { useCallback, useRef, useSyncExternalStore } from 'react';
import Game, { type GameConfig, type GameState } from '../domain/game/Game';

/** Creates a Game once and subscribes React to its state. */
export default function useGame(initialConfig?: GameConfig): {
	game: Game;
	state: GameState;
} {
	const gameRef = useRef<Game | null>(null);
	gameRef.current ??= new Game(initialConfig);
	const game = gameRef.current;

	const subscribe = useCallback(
		(onChange: () => void) => game.subscribe(onChange),
		[game],
	);
	const state = useSyncExternalStore(subscribe, () => game.getState());

	return { game, state };
}
