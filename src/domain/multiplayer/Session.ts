import Game, { type GameEvent } from '../game/Game';
import type { MatchSettings, Player, PlayerProgress } from './protocol';

export interface SessionState {
	readonly phase: 'lobby' | 'playing';
	/** Host first, then guests in join order. */
	readonly players: readonly Player[];
	readonly settings: MatchSettings;
	readonly selfId: string;
	readonly hostId: string;
	/** competitive: first player to clear their board. */
	readonly winnerId: string | null;
	/** competitive: live scoreboard, by player id. */
	readonly progress: ReadonlyMap<string, PlayerProgress>;
	/** The connection to the host is gone (guest only). */
	readonly disconnected: boolean;
	readonly error: string | null;
}

/**
 * Shared shape of a multiplayer seat, host or guest. Owns the Game this
 * client renders (the shared replica in coop, the private race board in
 * competitive) and mirrors lobby/scoreboard state. Observable exactly
 * like Game: subscribe/getState (+ useSyncExternalStore in React).
 */
export default abstract class Session {
	readonly game: Game;
	abstract readonly isHost: boolean;

	protected phase: 'lobby' | 'playing' = 'lobby';
	protected players: Player[] = [];
	protected settings: MatchSettings;
	protected winnerId: string | null = null;
	protected progress = new Map<string, PlayerProgress>();
	protected disconnected = false;
	protected error: string | null = null;

	private listeners = new Set<() => void>();
	private state: SessionState;

	constructor(
		readonly selfId: string,
		settings: MatchSettings,
	) {
		this.settings = settings;
		this.game = new Game(settings.config);
		this.state = this.buildState();
		this.game.subscribe(() => this.reportProgress());
	}

	private buildState(): SessionState {
		return {
			phase: this.phase,
			players: [...this.players],
			settings: this.settings,
			selfId: this.selfId,
			hostId: this.players[0]?.id ?? this.selfId,
			winnerId: this.winnerId,
			progress: new Map(this.progress),
			disconnected: this.disconnected,
			error: this.error,
		};
	}

	protected commit() {
		this.state = this.buildState();
		for (const listener of this.listeners) listener();
	}

	getState(): SessionState {
		return this.state;
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/** Route a local player action according to role and mode. */
	abstract dispatch(event: GameEvent): void;

	abstract close(): void;

	/** Whether the settings permit this player action at all. */
	protected allowed(event: GameEvent): boolean {
		if (event.type === 'restart') return false;
		if (event.type === 'undo' || event.type === 'redo')
			return this.settings.allowUndo;
		return true;
	}

	protected progressOf(): PlayerProgress {
		const { board, config, status } = this.game.getState();
		return {
			revealed: board.cells
				.toArray()
				.filter((c) => c.state.type === 'revealed' && !c.isBomb).length,
			safeTotal: config.width * config.height - config.bombs,
			status,
		};
	}

	/** competitive: push own progress to the scoreboard when it changes. */
	private reportProgress() {
		if (this.phase !== 'playing' || this.settings.mode !== 'competitive')
			return;
		const next = this.progressOf();
		const prev = this.progress.get(this.selfId);
		if (
			prev &&
			prev.revealed === next.revealed &&
			prev.status === next.status
		)
			return;
		this.sendProgress(next);
	}

	protected abstract sendProgress(progress: PlayerProgress): void;
}
