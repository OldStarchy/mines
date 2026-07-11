import type { GameEvent } from '../game/Game';
import { deserializeRecord } from '../game/GameRecord';
import Session from './Session';
import {
	DEFAULT_SETTINGS,
	type GuestEndpoint,
	type HostMessage,
	type PlayerProgress,
} from './protocol';

/**
 * A joined seat. In coop the local game is a replica: actions go to the
 * host as intents and come back as ops (nothing is applied locally
 * first). In competitive the game is played locally and progress is
 * reported to the host.
 */
export default class GuestSession extends Session {
	readonly isHost = false;

	constructor(
		private endpoint: GuestEndpoint,
		name: string,
	) {
		super(endpoint.id, DEFAULT_SETTINGS);
		endpoint.onMessage((message) => this.onMessage(message));
		endpoint.onClose(() => {
			this.disconnected = true;
			this.commit();
		});
		endpoint.send({ t: 'hello', name });
	}

	dispatch(event: GameEvent) {
		if (this.phase !== 'playing' || !this.allowed(event)) return;
		if (this.settings.mode === 'coop') {
			this.endpoint.send({ t: 'intent', event });
		} else {
			this.game.dispatch(event);
		}
	}

	close() {
		this.endpoint.close();
	}

	protected sendProgress(progress: PlayerProgress) {
		this.progress.set(this.selfId, progress);
		this.endpoint.send({ t: 'progress', progress });
		this.commit();
	}

	private onMessage(message: HostMessage) {
		switch (message.t) {
			case 'lobby': {
				this.phase = 'lobby';
				this.players = [...message.players];
				this.settings = message.settings;
				this.winnerId = null;
				this.progress.clear();
				this.commit();
				break;
			}
			case 'players': {
				this.players = [...message.players];
				this.commit();
				break;
			}
			case 'start': {
				this.settings = message.settings;
				this.phase = 'playing';
				this.winnerId = null;
				this.progress.clear();
				if (message.record) {
					const record = deserializeRecord(message.record);
					if (record) this.game.loadRecord(record);
				} else {
					this.game.restart(this.settings.config);
				}
				this.commit();
				break;
			}
			case 'op': {
				if (message.mines && this.game.getState().moveCount === 0) {
					this.game.seedMines(message.mines);
				}
				this.game.dispatch(message.event);
				break;
			}
			case 'progress': {
				this.progress.set(message.playerId, message.progress);
				this.commit();
				break;
			}
			case 'winner': {
				this.winnerId = message.playerId;
				this.commit();
				break;
			}
			case 'refused': {
				this.error = 'That game has already started.';
				this.commit();
				this.endpoint.close();
				break;
			}
		}
	}
}
