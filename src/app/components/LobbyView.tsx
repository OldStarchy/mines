import { Switch } from '@base-ui/react/switch';
import { useState } from 'react';
import { PRESETS, type PresetName } from '../../domain/game/Game';
import HostSession from '../../domain/multiplayer/HostSession';
import type Session from '../../domain/multiplayer/Session';
import type {
	MatchMode,
	MatchSettings,
} from '../../domain/multiplayer/protocol';
import { useSessionState } from '../useSession';
import ScenarioDialog from './ScenarioDialog';
import ThemedSelect from './ThemedSelect';
import { PRESET_LABELS, presetOf } from './Toolbar';

const MODE_LABELS: Record<MatchMode, string> = {
	coop: '🤝 Co-op',
	competitive: '🏁 Competitive',
};

const MODE_HINTS: Record<MatchMode, string> = {
	coop: 'One shared board — everyone digs together.',
	competitive:
		'Identical private boards — the game makes the same safe first click for everyone; fastest clear wins.',
};

function SettingRow({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="setting-row">
			<span className="setting-label">{label}</span>
			{children}
		</div>
	);
}

type ToggleName = 'allowUndo' | 'allowAssistant' | 'autoFlag' | 'autoReveal';

/** A boolean match setting: a switch for the host, a label for guests. */
function ToggleSetting({
	label,
	setting,
	host,
	settings,
}: {
	label: string;
	setting: ToggleName;
	host: HostSession | null;
	settings: MatchSettings;
}) {
	return (
		<SettingRow label={label}>
			{host ? (
				<Switch.Root
					className="switch"
					checked={settings[setting]}
					onCheckedChange={(value) =>
						host.setSettings({ [setting]: value })
					}
					aria-label={label}
				>
					<Switch.Thumb className="switch-thumb" />
				</Switch.Root>
			) : (
				<span>{settings[setting] ? 'On' : 'Off'}</span>
			)}
		</SettingRow>
	);
}

export default function LobbyView({
	session,
	onLeave,
}: {
	session: Session;
	onLeave: () => void;
}) {
	const state = useSessionState(session);
	const [copied, setCopied] = useState(false);
	const host = session instanceof HostSession ? session : null;
	const { settings } = state;
	const preset = presetOf(settings.config);

	const link = `${location.origin}${location.pathname}?join=${state.hostId}`;
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(link);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			/* clipboard unavailable; the link stays selectable */
		}
	};

	const boardLabel = `${settings.config.width}×${settings.config.height}, ${settings.config.bombs} mines`;

	return (
		<div className="lobby">
			<h2 className="lobby-title">Lobby</h2>

			<div className="share-row">
				<input
					className="text-input share-link"
					readOnly
					value={link}
					aria-label="Share link"
					onFocus={(event) => event.target.select()}
				/>
				<button type="button" className="button" onClick={() => void copy()}>
					{copied ? 'Copied ✓' : 'Copy link'}
				</button>
			</div>
			<p className="lobby-hint">
				Anyone with the link joins this lobby.
			</p>

			<ul className="players-list">
				{state.players.map((player) => (
					<li key={player.id} className="player-row">
						<span className="player-name">{player.name}</span>
						{player.id === state.hostId && (
							<span className="player-badge">host</span>
						)}
						{player.id === state.selfId && (
							<span className="player-badge player-you">you</span>
						)}
					</li>
				))}
			</ul>

			<div className="lobby-settings">
				<SettingRow label="Mode">
					{host ? (
						<div className="mode-buttons">
							{(Object.keys(MODE_LABELS) as MatchMode[]).map(
								(mode) => (
									<button
										key={mode}
										type="button"
										className={`button${settings.mode === mode ? ' button-selected' : ''}`}
										onClick={() => host.setSettings({ mode })}
									>
										{MODE_LABELS[mode]}
									</button>
								),
							)}
						</div>
					) : (
						<span>{MODE_LABELS[settings.mode]}</span>
					)}
				</SettingRow>
				<p className="lobby-hint">{MODE_HINTS[settings.mode]}</p>

				<SettingRow label="Board">
					{host ? (
						<div className="mode-buttons">
							<ThemedSelect
								ariaLabel="Difficulty"
								value={preset ?? 'custom'}
								items={
									(preset
										? PRESET_LABELS
										: {
												...PRESET_LABELS,
												custom: `Custom ${boardLabel}`,
											}) as Record<string, string>
								}
								onValueChange={(name) => {
									if (name !== 'custom') {
										host.setSettings({
											config: PRESETS[name as PresetName],
										});
									}
								}}
							/>
							<ScenarioDialog
								config={settings.config}
								submitLabel="Use board"
								onSubmit={(config) =>
									host.setSettings({ config })
								}
							/>
						</div>
					) : (
						<span>{boardLabel}</span>
					)}
				</SettingRow>

				<ToggleSetting
					label="Allow undo"
					setting="allowUndo"
					host={host}
					settings={settings}
				/>
				<ToggleSetting
					label="Allow assistant"
					setting="allowAssistant"
					host={host}
					settings={settings}
				/>
				<ToggleSetting
					label="Auto-flag on win"
					setting="autoFlag"
					host={host}
					settings={settings}
				/>
				<ToggleSetting
					label="Auto-reveal"
					setting="autoReveal"
					host={host}
					settings={settings}
				/>
				<p className="lobby-hint">
					Auto-flag marks the remaining mines once the board is
					cleared; auto-reveal chords numbers already satisfied by
					their flags.
				</p>
			</div>

			<div className="lobby-actions">
				<button type="button" className="button" onClick={onLeave}>
					Leave
				</button>
				{host ? (
					<button
						type="button"
						className="button button-primary"
						onClick={() => host.start()}
					>
						Start game
					</button>
				) : (
					<span className="lobby-waiting">
						Waiting for the host to start…
					</span>
				)}
			</div>
		</div>
	);
}
