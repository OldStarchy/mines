import type {
	GameConfig,
	GameState,
	PresetName,
} from '../../domain/game/Game';
import { PRESETS } from '../../domain/game/Game';
import { configKey, parseConfigKey } from '../../domain/game/scenario';
import { loadCustomTheme } from '../customTheme';
import { hasSaveInProgress, savedConfigs } from '../persistence';
import { THEMES, type ThemeName } from '../theme';
import type { AppSettings } from '../settings';
import { configLabel, PRESET_LABELS, presetOf } from './presets';
import ScenarioDialog from './ScenarioDialog';
import SettingsDialog from './SettingsDialog';
import StatsDialog from './StatsDialog';
import ThemedSelect from './ThemedSelect';
import ThemeStudioDialog from './ThemeStudioDialog';
import Timer from './Timer';

export { PRESET_LABELS, presetOf } from './presets';

const FACES = {
	idle: '🙂',
	playing: '🙂',
	won: '😎',
	lost: '😵',
} as const;

export default function Toolbar({
	state,
	theme,
	settings,
	onRestart,
	onSelectConfig,
	onUndo,
	onRedo,
	onTheme,
	onSettings,
	onMultiplayer,
}: {
	state: GameState;
	theme: ThemeName;
	settings: AppSettings;
	onRestart: () => void;
	onSelectConfig: (config: GameConfig) => void;
	onUndo: () => void;
	onRedo: () => void;
	onTheme: (theme: ThemeName) => void;
	onSettings: (settings: AppSettings) => void;
	onMultiplayer: () => void;
}) {
	const minesLeft = state.config.bombs - state.board.flagCount;
	const preset = presetOf(state.config);

	// A dot marks layouts with a game to resume. The current layout is
	// judged from live state — its autosave lags this render by a tick.
	const inProgress = (config: GameConfig): boolean =>
		configKey(config) === configKey(state.config)
			? state.status === 'playing'
			: hasSaveInProgress(config);
	const withSaveDot = (label: string, config: GameConfig) =>
		inProgress(config) ? `${label} ●` : label;

	const difficultyItems: Record<string, string> = Object.fromEntries(
		(Object.keys(PRESET_LABELS) as PresetName[]).map((name) => [
			name,
			withSaveDot(PRESET_LABELS[name], PRESETS[name]),
		]),
	);
	// Custom boards: the active one, plus every one with a game to
	// resume — off the list they'd be impossible to come back to.
	const customs = new Map<string, GameConfig>();
	for (const config of savedConfigs()) {
		if (!presetOf(config) && hasSaveInProgress(config)) {
			customs.set(configKey(config), config);
		}
	}
	if (!preset) customs.set(configKey(state.config), state.config);
	for (const [key, config] of [...customs.entries()].sort(([a], [b]) =>
		a.localeCompare(b, undefined, { numeric: true }),
	)) {
		difficultyItems[`custom:${key}`] = withSaveDot(
			configLabel(config),
			config,
		);
	}

	const selected = preset ?? `custom:${configKey(state.config)}`;

	// The generated theme joins the built-ins under its own name.
	const themeItems: Record<string, string> = { ...THEMES };
	const customTheme = loadCustomTheme();
	if (customTheme) themeItems.custom = customTheme.name;

	return (
		<header className="toolbar">
			<h1 className="title">Mines Lab</h1>

			<span className="counter" title="Mines minus flags">
				<span className="glyph-mine" />{' '}
				{String(Math.max(-99, minesLeft)).padStart(3, '0')}
			</span>

			<button
				type="button"
				className="face"
				title="New game"
				onClick={onRestart}
			>
				{FACES[state.status]}
			</button>

			<Timer state={state} />

			<div className="history-controls">
				<button
					type="button"
					className="button button-icon"
					title="Undo"
					disabled={!state.canUndo}
					onClick={onUndo}
				>
					↩
				</button>
				<button
					type="button"
					className="button button-icon"
					title="Redo"
					disabled={!state.canRedo}
					onClick={onRedo}
				>
					↪
				</button>
			</div>

			<div className="toolbar-controls">
				<ThemedSelect
					ariaLabel="Difficulty"
					value={selected}
					items={difficultyItems}
					onValueChange={(name) => {
						if (name === selected) return; // no self-restarts
						if (name.startsWith('custom:')) {
							const config = parseConfigKey(
								name.slice('custom:'.length),
							);
							if (config) onSelectConfig(config);
						} else {
							onSelectConfig(PRESETS[name as PresetName]);
						}
					}}
				/>
				<ScenarioDialog config={state.config} onSubmit={onSelectConfig} />
				<button
					type="button"
					className="button"
					onClick={onMultiplayer}
				>
					👥 Multiplayer
				</button>
				<ThemedSelect
					ariaLabel="Theme"
					value={theme}
					items={themeItems}
					onValueChange={(name) => onTheme(name as ThemeName)}
				/>
				<ThemeStudioDialog onTheme={onTheme} />
				<StatsDialog config={state.config} />
				<SettingsDialog settings={settings} onChange={onSettings} />
			</div>
		</header>
	);
}
