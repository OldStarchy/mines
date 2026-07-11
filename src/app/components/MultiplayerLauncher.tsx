import { Dialog } from '@base-ui/react/dialog';
import { useState } from 'react';
import GuestSession from '../../domain/multiplayer/GuestSession';
import HostSession from '../../domain/multiplayer/HostSession';
import type Session from '../../domain/multiplayer/Session';
import type {
	GuestEndpoint,
	HostEndpoint,
} from '../../domain/multiplayer/protocol';
import { createGuestEndpoint, createHostEndpoint } from '../net/peer';

export interface Connector {
	host(): Promise<HostEndpoint>;
	join(hostId: string): Promise<GuestEndpoint>;
}

const peerConnector: Connector = {
	host: createHostEndpoint,
	join: createGuestEndpoint,
};

const NAME_KEY = 'mines.playerName';

function loadName(): string {
	try {
		return localStorage.getItem(NAME_KEY) ?? '';
	} catch {
		return '';
	}
}

/**
 * Entry point into multiplayer: names the player, then either creates a
 * lobby (host) or joins one from a ?join= link (guest).
 */
export default function MultiplayerLauncher({
	open,
	onOpenChange,
	joinId,
	onSession,
	connector = peerConnector,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Host id from a share link; null when creating a lobby. */
	joinId: string | null;
	onSession: (session: Session) => void;
	connector?: Connector;
}) {
	const [name, setName] = useState(loadName);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const go = async () => {
		const playerName = name.trim() || 'Anonymous';
		try {
			localStorage.setItem(NAME_KEY, playerName);
		} catch {
			/* private mode */
		}
		setPending(true);
		setError(null);
		try {
			const session = joinId
				? new GuestSession(await connector.join(joinId), playerName)
				: new HostSession(await connector.host(), playerName);
			onSession(session);
			onOpenChange(false);
		} catch {
			setError(
				joinId
					? 'Could not reach that lobby. The link may have expired.'
					: 'Could not reach the signaling server. Try again in a moment.',
			);
		} finally {
			setPending(false);
		}
	};

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Backdrop className="dialog-backdrop" />
				<Dialog.Popup className="dialog">
					<Dialog.Title className="dialog-title">
						{joinId ? 'Join game' : 'Multiplayer'}
					</Dialog.Title>
					<Dialog.Description className="dialog-description">
						{joinId
							? 'You have been invited to a game. Pick a name and join the lobby.'
							: 'Create a lobby and share the link with friends. Play the same board together, or race on identical boards.'}
					</Dialog.Description>

					<label className="field">
						<span className="field-label">Your name</span>
						<input
							className="text-input"
							value={name}
							maxLength={24}
							placeholder="Anonymous"
							onChange={(event) => setName(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === 'Enter' && !pending) void go();
							}}
						/>
					</label>

					{error && <p className="assistant-warning">⚠ {error}</p>}

					<div className="dialog-actions">
						<Dialog.Close className="button">Cancel</Dialog.Close>
						<button
							type="button"
							className="button button-primary"
							disabled={pending}
							onClick={() => void go()}
						>
							{pending
								? 'Connecting…'
								: joinId
									? 'Join lobby'
									: 'Create lobby'}
						</button>
					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
