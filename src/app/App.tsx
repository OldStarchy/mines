import { useEffect, useMemo, useState } from 'react';
import type Cell from '../domain/Cell';
import type Index2D from '../domain/Index2D';
import { PRESETS, type PresetName } from '../domain/game/Game';
import solve from '../domain/solver/Solver';
import AssistantPanel from './components/AssistantPanel';
import BoardView from './components/BoardView';
import Toolbar from './components/Toolbar';
import type { Highlight } from './highlight';
import { applyTheme, loadTheme, type ThemeName } from './theme';
import useGame from './useGame';
import './styles.css';

export default function App() {
	const { game, state } = useGame();
	const [theme, setTheme] = useState<ThemeName>(loadTheme);
	const [assist, setAssist] = useState(false);
	const [highlight, setHighlight] = useState<Highlight | null>(null);

	useEffect(() => applyTheme(theme), [theme]);

	const result = useMemo(
		() =>
			assist && state.status === 'playing'
				? solve(state.board, { totalMines: state.config.bombs })
				: null,
		[assist, state.status, state.board, state.config.bombs],
	);

	const reveal = (cell: Cell) => {
		setHighlight(null);
		game.reveal(cell);
	};
	const toggleFlag = (cell: Cell) => {
		setHighlight(null);
		game.toggleFlag(cell);
	};

	const applyCells = (type: 'flag' | 'reveal', cells: Index2D[]) => {
		setHighlight(null);
		for (const index of cells) {
			const cell = game.getState().board.cells.atOrNull(index);
			if (!cell || cell.state.type !== 'hidden') continue;
			if (type === 'flag') game.toggleFlag(index);
			else game.reveal(index);
		}
	};

	return (
		<div className="app">
			<Toolbar
				state={state}
				theme={theme}
				onRestart={() => game.restart()}
				onPreset={(preset: PresetName) => game.restart(PRESETS[preset])}
				onTheme={setTheme}
			/>

			<main className="main">
				<div className="board-area">
					<BoardView
						board={state.board}
						status={state.status}
						highlight={highlight}
						onReveal={reveal}
						onToggleFlag={toggleFlag}
					/>
					{state.status === 'won' && (
						<p className="banner banner-won">Cleared! 🎉</p>
					)}
					{state.status === 'lost' && (
						<p className="banner banner-lost">
							Boom. Press the face to try again.
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
