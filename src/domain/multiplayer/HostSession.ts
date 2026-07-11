import Game, { type GameEvent } from '../game/Game';
import { serializeRecord } from '../game/GameRecord';
import Session from './Session';
import {
	DEFAULT_SETTINGS,
	type GuestMessage,
	type HostEndpoint,
	type MatchSettings,
	type PlayerProgress,
} from './protocol';

/**
 * The authoritative seat. Owns the lobby (players, settings) and, in
 * coop, the shared game: everyone's actions funnel through here as
 * intents, are validated against one board, and fan back out as ops.
 */
export default class HostSession extends Session {
	readonly isHost = true;

	constructor(
		private endpoint: HostEndpoint,
		name: string,
		settings: MatchSettings = DEFAULT_SETTINGS,
	) {
		super(endpoint.id, settings);
		this.players = [{ id: endpoint.id, name }];
		endpoint.onPeer((peerId, joined) => {
			if (!joined) this.removePlayer(peerId);
		});
		endpoint.onMessage((from, message) => this.onMessage(from, message));
		this.commit();
	}

	setSettings(patch: Partial<MatchSettings>) {
		if (this.phase !== 'lobby') return;
		this.settings = { ...this.settings, ...patch };
		this.broadcastLobby();
		this.commit();
	}

	start() {
		if (this.phase !== 'lobby') return;
		this.phase = 'playing';
		this.winnerId = null;
		this.progress.clear();

		let record: string | null = null;
		if (this.settings.mode === 'competitive') {
			// The game makes the first click itself so every player gets
			// the same board with the same safe opening.
			const opener = new Game(this.settings.config);
			opener.reveal({
				x: Math.floor(Math.random() * this.settings.config.width),
				y: Math.floor(Math.random() * this.settings.config.height),
			});
			record = serializeRecord(opener.getRecord());
			this.endpoint.broadcast({ t: 'start', settings: this.settings, record });
			this.game.loadRecord(opener.getRecord());
		} else {
			this.endpoint.broadcast({ t: 'start', settings: this.settings, record });
			this.game.restart(this.settings.config);
		}
		this.commit();
	}

	backToLobby() {
		if (this.phase !== 'playing') return;
		this.phase = 'lobby';
		this.winnerId = null;
		this.progress.clear();
		this.game.restart(this.settings.config);
		this.broadcastLobby();
		this.commit();
	}

	dispatch(event: GameEvent) {
		if (this.phase !== 'playing' || !this.allowed(event)) return;
		if (this.settings.mode === 'coop') this.applyShared(event);
		else this.game.dispatch(event);
	}

	close() {
		this.endpoint.close();
	}

	/** coop: apply to the shared game; fan accepted events out as ops. */
	private applyShared(event: GameEvent) {
		const before = this.game.getState();
		this.game.dispatch(event);
		const after = this.game.getState();
		// No-ops (e.g. revealing a revealed cell) don't produce a state
		// object, so nothing needs broadcasting.
		if (after === before) return;

		this.endpoint.broadcast({
			t: 'op',
			event,
			// The op that starts the board carries the mine layout so
			// replicas reproduce it (also after an undo back to zero).
			mines:
				before.moveCount === 0 && after.moveCount > 0
					? this.game.getRecord().mines
					: undefined,
		});
	}

	private onMessage(from: string, message: GuestMessage) {
		switch (message.t) {
			case 'hello': {
				if (this.phase !== 'lobby') {
					this.endpoint.send(from, {
						t: 'refused',
						reason: 'in-progress',
					});
					return;
				}
				this.players = [
					...this.players.filter((p) => p.id !== from),
					{ id: from, name: message.name },
				];
				this.broadcastLobby();
				this.commit();
				break;
			}
			case 'intent': {
				if (
					this.phase === 'playing' &&
					this.settings.mode === 'coop' &&
					this.allowed(message.event)
				) {
					this.applyShared(message.event);
				}
				break;
			}
			case 'progress': {
				this.setProgress(from, message.progress);
				break;
			}
		}
	}

	protected sendProgress(progress: PlayerProgress) {
		this.setProgress(this.selfId, progress);
	}

	private setProgress(playerId: string, progress: PlayerProgress) {
		if (this.phase !== 'playing') return;
		this.progress.set(playerId, progress);
		this.endpoint.broadcast({ t: 'progress', playerId, progress });
		if (progress.status === 'won' && this.winnerId === null) {
			this.winnerId = playerId;
			this.endpoint.broadcast({ t: 'winner', playerId });
		}
		this.commit();
	}

	private removePlayer(peerId: string) {
		if (!this.players.some((p) => p.id === peerId)) return;
		this.players = this.players.filter((p) => p.id !== peerId);
		this.progress.delete(peerId);
		if (this.phase === 'lobby') this.broadcastLobby();
		else this.endpoint.broadcast({ t: 'players', players: this.players });
		this.commit();
	}

	private broadcastLobby() {
		this.endpoint.broadcast({
			t: 'lobby',
			players: this.players,
			settings: this.settings,
		});
	}
}
