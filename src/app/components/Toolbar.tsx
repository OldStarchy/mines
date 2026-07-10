import type {
	GameConfig,
	GameState,
	PresetName,
} from '../../domain/game/Game';
import { PRESETS } from '../../domain/game/Game';
import { THEMES, type ThemeName } from '../theme';
import ScenarioDialog from './ScenarioDialog';
import ThemedSelect from './ThemedSelect';
import Timer from './Timer';

const FACES = {
	idle: '🙂',
	playing: '🙂',
	won: '😎',
	lost: '😵',
} as const;

const PRESET_LABELS: Record<PresetName, string> = {
	beginner: 'Beginner 9×9',
	intermediate: 'Intermediate 16×16',
	expert: 'Expert 30×16',
};

function presetOf(config: GameConfig): PresetName | null {
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
	onRestart,
	onSelectConfig,
	onUndo,
	onRedo,
	onTheme,
}: {
	state: GameState;
	theme: ThemeName;
	onRestart: () => void;
	onSelectConfig: (config: GameConfig) => void;
	onUndo: () => void;
	onRedo: () => void;
	onTheme: (theme: ThemeName) => void;
}) {
	const minesLeft = state.config.bombs - state.board.flagCount;
	const preset = presetOf(state.config);
	const presetItems: Record<string, string> = preset
		? PRESET_LABELS
		: {
				...PRESET_LABELS,
				custom: `Custom ${state.config.width}×${state.config.height}`,
			};

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
				<ThemedSelect
					ariaLabel="Theme"
					value={theme}
					items={THEMES}
					onValueChange={onTheme}
				/>
			</div>
		</header>
	);
}
