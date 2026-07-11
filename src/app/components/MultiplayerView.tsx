import type Session from '../../domain/multiplayer/Session';
import { useSessionState } from '../useSession';
import LobbyView from './LobbyView';
import MatchView from './MatchView';

/** The whole multiplayer surface: lobby, match, and failure states. */
export default function MultiplayerView({
	session,
	onLeave,
}: {
	session: Session;
	onLeave: () => void;
}) {
	const state = useSessionState(session);

	if (state.error || state.disconnected) {
		return (
			<main className="main">
				<div className="lobby">
					<h2 className="lobby-title">
						{state.error ? 'Could not join' : 'Connection lost'}
					</h2>
					<p className="lobby-hint">
						{state.error ??
							'The host went away. You can keep the board as a solo game or leave.'}
					</p>
					<div className="lobby-actions">
						<button
							type="button"
							className="button button-primary"
							onClick={onLeave}
						>
							Back to single player
						</button>
					</div>
				</div>
			</main>
		);
	}

	if (state.phase === 'lobby') {
		return (
			<main className="main">
				<LobbyView session={session} onLeave={onLeave} />
			</main>
		);
	}

	return <MatchView session={session} onLeave={onLeave} />;
}
