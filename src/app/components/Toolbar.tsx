import type { GameState, PresetName } from '../../domain/game/Game';
import { PRESETS } from '../../domain/game/Game';
import { THEMES, type ThemeName } from '../theme';
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

function presetOf(state: GameState): PresetName {
	const found = (Object.keys(PRESETS) as PresetName[]).find(
		(name) =>
			PRESETS[name].width === state.config.width &&
			PRESETS[name].height === state.config.height &&
			PRESETS[name].bombs === state.config.bombs,
	);
	return found ?? 'beginner';
}

export default function Toolbar({
	state,
	theme,
	onRestart,
	onPreset,
	onTheme,
}: {
	state: GameState;
	theme: ThemeName;
	onRestart: () => void;
	onPreset: (preset: PresetName) => void;
	onTheme: (theme: ThemeName) => void;
}) {
	const minesLeft = state.config.bombs - state.board.flagCount;

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

			<div className="toolbar-controls">
				<ThemedSelect
					ariaLabel="Difficulty"
					value={presetOf(state)}
					items={PRESET_LABELS}
					onValueChange={onPreset}
				/>
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
