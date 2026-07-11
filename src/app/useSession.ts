import { useCallback, useSyncExternalStore } from 'react';
import type Game from '../domain/game/Game';
import type { GameState } from '../domain/game/Game';
import type Session from '../domain/multiplayer/Session';
import type { SessionState } from '../domain/multiplayer/Session';

export function useSessionState(session: Session): SessionState {
	const subscribe = useCallback(
		(onChange: () => void) => session.subscribe(onChange),
		[session],
	);
	return useSyncExternalStore(subscribe, () => session.getState());
}

/** Like useGame, but for an externally-owned Game (a session's board). */
export function useGameState(game: Game): GameState {
	const subscribe = useCallback(
		(onChange: () => void) => game.subscribe(onChange),
		[game],
	);
	return useSyncExternalStore(subscribe, () => game.getState());
}
