import { useEffect, useMemo, useState } from 'react';
import type Cell from '../domain/Cell';
import type Index2D from '../domain/Index2D';
import { PRESETS, type GameConfig } from '../domain/game/Game';
import { configKey } from '../domain/game/scenario';
import type Session from '../domain/multiplayer/Session';
import solve from '../domain/solver/Solver';
import AssistantPanel from './components/AssistantPanel';
import BoardView from './components/BoardView';
import MultiplayerLauncher, {
	type Connector,
} from './components/MultiplayerLauncher';
import MultiplayerView from './components/MultiplayerView';
import ReplayControls from './components/ReplayControls';
import ResumeDialog from './components/ResumeDialog';
import ThemedSelect from './components/ThemedSelect';
import Toolbar from './components/Toolbar';
import type { Highlight } from './highlight';
import { hasSave, loadLastConfig } from './persistence';
import {
	THEMES,
	applyTheme,
	hasStoredTheme,
	loadTheme,
	saveTheme,
	systemTheme,
	type ThemeName,
} from './theme';
import useGame from './useGame';
import useReplay from './useReplay';
import './styles.css';

export default function App({ connector }: { connector?: Connector }) {
	const [initialConfig] = useState(
		() => loadLastConfig() ?? PRESETS.beginner,
	);
	const { game, state, resume, noteClick, noteAssist } =
		useGame(initialConfig);
	const [theme, setTheme] = useState<ThemeName>(loadTheme);
	const [assist, setAssist] = useState(false);
	/** Off by default: reasoning from undone reveals is meta-gaming. */
	const [metaAssist, setMetaAssist] = useState(false);
	const [highlight, setHighlight] = useState<Highlight | null>(null);
	/** Scenario awaiting a resume-or-new decision (has a saved game). */
	const [pendingConfig, setPendingConfig] = useState<GameConfig | null>(null);
	const replay = useReplay();

	/** Host id from a ?join= share link, consumed once on load. */
	const [joinId, setJoinId] = useState(() => {
		const id = new URLSearchParams(location.search).get('join');
		if (id) history.replaceState(null, '', location.pathname);
		return id;
	});
	const [session, setSession] = useState<Session | null>(null);
	const [launcherOpen, setLauncherOpen] = useState(joinId !== null);

	const adoptSession = (next: Session) => {
		setSession(next);
		setJoinId(null);
	};
	const leaveSession = () => {
		session?.close();
		setSession(null);
	};

	useEffect(() => applyTheme(theme), [theme]);

	// Until the player picks a theme, follow the OS light/dark setting.
	useEffect(() => {
		const query = window.matchMedia('(prefers-color-scheme: dark)');
		const onChange = () => {
			if (!hasStoredTheme()) setTheme(systemTheme());
		};
		query.addEventListener('change', onChange);
		return () => query.removeEventListener('change', onChange);
	}, []);

	const chooseTheme = (next: ThemeName) => {
		saveTheme(next);
		setTheme(next);
	};

	// The assistant being on during play marks the game as assisted.
	useEffect(() => {
		if (assist && state.status === 'playing') noteAssist();
	}, [assist, state.status, noteAssist]);

	const result = useMemo(
		() =>
			assist && state.status === 'playing'
				? solve(state.board, {
						totalMines: state.config.bombs,
						memory: metaAssist ? state.memory : undefined,
					})
				: null,
		[
			assist,
			metaAssist,
			state.status,
			state.board,
			state.config.bombs,
			state.memory,
		],
	);

	const act = (action: () => void) => {
		setHighlight(null);
		action();
	};
	const reveal = (cell: Cell) => act(() => game.reveal(cell));
	const chord = (cell: Cell) => act(() => game.chord(cell));
	const toggleFlag = (cell: Cell) => act(() => game.toggleFlag(cell));

	// Assistant suggestions apply as one move — one undo, one replay tick.
	const applyCells = (type: 'flag' | 'reveal', cells: Index2D[]) =>
		act(() => game.applyMany(type, cells));

	const selectConfig = (config: GameConfig) => {
		setHighlight(null);
		replay.stop(); // picking a board always returns to live play
		if (configKey(config) !== configKey(state.config) && hasSave(config)) {
			setPendingConfig(config);
		} else {
			game.restart(config);
		}
	};

	const resumeSaved = () => {
		if (!pendingConfig) return;
		resume(pendingConfig);
		setPendingConfig(null);
	};

	const startNew = () => {
		if (!pendingConfig) return;
		game.restart(pendingConfig);
		setPendingConfig(null);
	};

	if (session) {
		return (
			<div className="app">
				<header className="toolbar">
					<h1 className="title">Mines Lab</h1>
					<div className="toolbar-controls">
						<ThemedSelect
							ariaLabel="Theme"
							value={theme}
							items={THEMES}
							onValueChange={chooseTheme}
						/>
					</div>
				</header>
				<MultiplayerView session={session} onLeave={leaveSession} />
			</div>
		);
	}

	return (
		<div className="app">
			<Toolbar
				state={state}
				theme={theme}
				onRestart={() =>
					act(() => {
						replay.stop();
						game.restart();
					})
				}
				onSelectConfig={selectConfig}
				onUndo={() =>
					act(() => {
						noteAssist(); // undoing counts as an assist
						game.undo();
					})
				}
				onRedo={() => act(() => game.redo())}
				onTheme={chooseTheme}
				onMultiplayer={() => setLauncherOpen(true)}
			/>

			<MultiplayerLauncher
				open={launcherOpen}
				onOpenChange={setLauncherOpen}
				joinId={joinId}
				onSession={adoptSession}
				connector={connector}
			/>

			<ResumeDialog
				config={pendingConfig}
				onResume={resumeSaved}
				onNewGame={startNew}
				onCancel={() => setPendingConfig(null)}
			/>

			<main className="main">
				<div className="board-area">
					{replay.view ? (
						<>
							<BoardView
								board={replay.view.board}
								status={replay.view.status}
								lastReveal={replay.view.lastReveal}
								highlight={null}
								interactive={false}
								waveScale={Math.min(1, 1 / replay.view.aps)}
							/>
							<ReplayControls replay={replay} />
						</>
					) : (
						<>
							{/* Every raw pointer-down counts toward the click
							    ratio, no-ops included. */}
							<div
								style={{ display: 'contents' }}
								onPointerDownCapture={noteClick}
							>
								<BoardView
									board={state.board}
									status={state.status}
									lastReveal={state.lastReveal}
									highlight={highlight}
									onReveal={reveal}
									onChord={chord}
									onToggleFlag={toggleFlag}
								/>
							</div>
							{state.status === 'won' && (
								<p className="banner banner-won">Cleared! 🎉</p>
							)}
							{state.status === 'lost' && (
								<p className="banner banner-lost">
									Boom. Undo the move or press the face to try
									again.
								</p>
							)}
							{state.moveCount > 0 && (
								<button
									type="button"
									className="button"
									onClick={() => {
										setHighlight(null);
										replay.start(game.getRecord());
									}}
								>
									▶ Replay
								</button>
							)}
						</>
					)}
				</div>

				{!replay.view && (
					<AssistantPanel
						enabled={assist}
						onEnabledChange={setAssist}
						metaAssist={metaAssist}
						onMetaAssistChange={setMetaAssist}
						memorySize={state.memory.size}
						result={result}
						idle={state.status === 'idle'}
						onHighlight={setHighlight}
						onApplyCells={applyCells}
					/>
				)}
			</main>
		</div>
	);
}
