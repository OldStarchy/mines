import type { GameConfig, GameEvent, GameStatus } from '../game/Game';
import { PRESETS } from '../game/Game';

export type MatchMode = 'coop' | 'competitive';

/** Everything the host configures in the lobby before starting. */
export interface MatchSettings {
	readonly config: GameConfig;
	/**
	 * coop: everyone plays one shared board (host-authoritative).
	 * competitive: everyone races on identical private boards; the game
	 * itself makes the first (safe) click so all boards start equal.
	 */
	readonly mode: MatchMode;
	readonly allowUndo: boolean;
	readonly allowAssistant: boolean;
}

export const DEFAULT_SETTINGS: MatchSettings = {
	config: PRESETS.beginner,
	mode: 'coop',
	allowUndo: false,
	allowAssistant: true,
};

export interface Player {
	readonly id: string;
	readonly name: string;
}

export interface PlayerProgress {
	/** Safe cells revealed so far. */
	readonly revealed: number;
	/** Safe cells on the board in total. */
	readonly safeTotal: number;
	readonly status: GameStatus;
}

/** Guest → host. */
export type GuestMessage =
	| { readonly t: 'hello'; readonly name: string }
	/** coop: ask the host to apply an action to the shared game. */
	| { readonly t: 'intent'; readonly event: GameEvent }
	/** competitive: report own progress for the scoreboard. */
	| { readonly t: 'progress'; readonly progress: PlayerProgress };

/** Host → guests. */
export type HostMessage =
	| {
			readonly t: 'lobby';
			readonly players: readonly Player[];
			readonly settings: MatchSettings;
	  }
	| { readonly t: 'players'; readonly players: readonly Player[] }
	| {
			readonly t: 'start';
			readonly settings: MatchSettings;
			/** Serialized GameRecord (competitive) or null (coop). */
			readonly record: string | null;
	  }
	/**
	 * coop: an event the host accepted; replicas re-dispatch it. The mine
	 * layout rides along on the op that started the board.
	 */
	| {
			readonly t: 'op';
			readonly event: GameEvent;
			readonly mines?: readonly string[];
	  }
	| {
			readonly t: 'progress';
			readonly playerId: string;
			readonly progress: PlayerProgress;
	  }
	| { readonly t: 'winner'; readonly playerId: string }
	| { readonly t: 'refused'; readonly reason: 'in-progress' };

/**
 * Star topology: the host accepts connections and relays; guests hold a
 * single connection to the host. Implementations: PeerJS (production)
 * and an in-memory network (tests).
 */
export interface HostEndpoint {
	/** The id guests use to join (goes in the share link). */
	readonly id: string;
	send(to: string, message: HostMessage): void;
	broadcast(message: HostMessage): void;
	onMessage(cb: (from: string, message: GuestMessage) => void): () => void;
	onPeer(cb: (peerId: string, joined: boolean) => void): () => void;
	close(): void;
}

export interface GuestEndpoint {
	/** Own peer id (how the host refers to this guest). */
	readonly id: string;
	send(message: GuestMessage): void;
	onMessage(cb: (message: HostMessage) => void): () => void;
	onClose(cb: () => void): () => void;
	close(): void;
}
