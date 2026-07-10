import { useEffect, useMemo, useState } from 'react';
import type Cell from '../domain/Cell';
import type Index2D from '../domain/Index2D';
import { PRESETS, type GameConfig } from '../domain/game/Game';
import { configKey } from '../domain/game/scenario';
import solve from '../domain/solver/Solver';
import AssistantPanel from './components/AssistantPanel';
import BoardView from './components/BoardView';
import ResumeDialog from './components/ResumeDialog';
import Toolbar from './components/Toolbar';
import type { Highlight } from './highlight';
import { hasSave, loadGame, loadLastConfig } from './persistence';
import { applyTheme, loadTheme, type ThemeName } from './theme';
import useGame from './useGame';
import './styles.css';

export default function App() {
	const [initialConfig] = useState(
		() => loadLastConfig() ?? PRESETS.beginner,
	);
	const { game, state } = useGame(initialConfig);
	const [theme, setTheme] = useState<ThemeName>(loadTheme);
	const [assist, setAssist] = useState(false);
	const [highlight, setHighlight] = useState<Highlight | null>(null);
	/** Scenario awaiting a resume-or-new decision (has a saved game). */
	const [pendingConfig, setPendingConfig] = useState<GameConfig | null>(null);

	useEffect(() => applyTheme(theme), [theme]);

	const result = useMemo(
		() =>
			assist && state.status === 'playing'
				? solve(state.board, { totalMines: state.config.bombs })
				: null,
		[assist, state.status, state.board, state.config.bombs],
	);

	const act = (action: () => void) => {
		setHighlight(null);
		action();
	};
	const reveal = (cell: Cell) => act(() => game.reveal(cell));
	const chord = (cell: Cell) => act(() => game.chord(cell));
	const toggleFlag = (cell: Cell) => act(() => game.toggleFlag(cell));

	const applyCells = (type: 'flag' | 'reveal', cells: Index2D[]) => {
		setHighlight(null);
		for (const index of cells) {
			const cell = game.getState().board.cells.atOrNull(index);
			if (!cell || cell.state.type !== 'hidden') continue;
			if (type === 'flag') game.toggleFlag(index);
			else game.reveal(index);
		}
	};

	const selectConfig = (config: GameConfig) => {
		setHighlight(null);
		if (configKey(config) !== configKey(state.config) && hasSave(config)) {
			setPendingConfig(config);
		} else {
			game.restart(config);
		}
	};

	const resumeSaved = () => {
		if (!pendingConfig) return;
		const saved = loadGame(pendingConfig);
		if (saved) game.loadRecord(saved);
		else game.restart(pendingConfig);
		setPendingConfig(null);
	};

	const startNew = () => {
		if (!pendingConfig) return;
		game.restart(pendingConfig);
		setPendingConfig(null);
	};

	return (
		<div className="app">
			<Toolbar
				state={state}
				theme={theme}
				onRestart={() => act(() => game.restart())}
				onSelectConfig={selectConfig}
				onUndo={() => act(() => game.undo())}
				onRedo={() => act(() => game.redo())}
				onTheme={setTheme}
			/>

			<ResumeDialog
				config={pendingConfig}
				onResume={resumeSaved}
				onNewGame={startNew}
				onCancel={() => setPendingConfig(null)}
			/>

			<main className="main">
				<div className="board-area">
					<BoardView
						board={state.board}
						status={state.status}
						lastReveal={state.lastReveal}
						highlight={highlight}
						onReveal={reveal}
						onChord={chord}
						onToggleFlag={toggleFlag}
					/>
					{state.status === 'won' && (
						<p className="banner banner-won">Cleared! 🎉</p>
					)}
					{state.status === 'lost' && (
						<p className="banner banner-lost">
							Boom. Undo the move or press the face to try again.
						</p>
					)}
				</div>

				<AssistantPanel
					enabled={assist}
					onEnabledChange={setAssist}
					result={result}
					idle={state.status === 'idle'}
					onHighlight={setHighlight}
					onApplyCells={applyCells}
				/>
			</main>
		</div>
	);
}
