import type {
	GameConfig,
	GameState,
	PresetName,
} from '../../domain/game/Game';
import { PRESETS } from '../../domain/game/Game';
import { configKey } from '../../domain/game/scenario';
import { hasSaveInProgress } from '../persistence';
import { THEMES, type ThemeName } from '../theme';
import type { AppSettings } from '../settings';
import ScenarioDialog from './ScenarioDialog';
import SettingsDialog from './SettingsDialog';
import ThemedSelect from './ThemedSelect';
import Timer from './Timer';

const FACES = {
	idle: '🙂',
	playing: '🙂',
	won: '😎',
	lost: '😵',
} as const;

export const PRESET_LABELS: Record<PresetName, string> = {
	beginner: 'Beginner 9×9',
	intermediate: 'Intermediate 16×16',
	expert: 'Expert 30×16',
};

export function presetOf(config: GameConfig): PresetName | null {
	return (
		(Object.keys(PRESETS) as PresetName[]).find(
			(name) =>
				PRESETS[name].width === config.width &&
				PRESETS[name].height === config.height &&
				PRESETS[name].bombs === config.bombs,
		) ?? null
	);
}

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

	const presetItems: Record<string, string> = Object.fromEntries(
		(Object.keys(PRESET_LABELS) as PresetName[]).map((name) => [
			name,
			withSaveDot(PRESET_LABELS[name], PRESETS[name]),
		]),
	);
	if (!preset) {
		presetItems.custom = withSaveDot(
			`Custom ${state.config.width}×${state.config.height}`,
			state.config,
		);
	}

	return (
		<header className="toolbar">
			<h1 className="title">Mines Lab</h1>

			<span className="counter" title="Mines minus flags">
				💣 {String(Math.max(-99, minesLeft)).padStart(3, '0')}
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
					value={preset ?? 'custom'}
					items={presetItems}
					onValueChange={(name) => {
						if (name !== 'custom') {
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
					items={THEMES}
					onValueChange={onTheme}
				/>
				<SettingsDialog settings={settings} onChange={onSettings} />
			</div>
		</header>
	);
}
