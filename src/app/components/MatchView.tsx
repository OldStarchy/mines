import { useMemo, useState } from 'react';
import type Cell from '../../domain/Cell';
import type Index2D from '../../domain/Index2D';
import HostSession from '../../domain/multiplayer/HostSession';
import type Session from '../../domain/multiplayer/Session';
import type {
	Player,
	PlayerProgress,
} from '../../domain/multiplayer/protocol';
import type { SessionState } from '../../domain/multiplayer/Session';
import solve from '../../domain/solver/Solver';
import type { Highlight } from '../highlight';
import { useGameState, useSessionState } from '../useSession';
import AssistantPanel from './AssistantPanel';
import BoardView from './BoardView';
import BoardViewport from './BoardViewport';
import FlagModeToggle from './FlagModeToggle';
import Timer from './Timer';

function progressLabel(progress: PlayerProgress | undefined): string {
	if (!progress) return '0%';
	if (progress.status === 'won') return 'cleared!';
	if (progress.status === 'lost') return '💥';
	return `${Math.round((progress.revealed / progress.safeTotal) * 100)}%`;
}

function Scoreboard({ state }: { state: SessionState }) {
	return (
		<div className="scoreboard">
			<h3 className="scoreboard-title">Race</h3>
			{state.players.map((player: Player) => {
				const progress = state.progress.get(player.id);
				const pct = progress
					? Math.round((progress.revealed / progress.safeTotal) * 100)
					: 0;
				const isWinner = state.winnerId === player.id;
				return (
					<div key={player.id} className="score-row">
						<span className="score-name">
							{isWinner && '👑 '}
							{player.name}
							{player.id === state.selfId && ' (you)'}
						</span>
						<div className="score-bar">
							<div
								className={`score-fill${progress?.status === 'lost' ? ' score-lost' : ''}`}
								style={{ width: `${pct}%` }}
							/>
						</div>
						<span className="score-pct">
							{progressLabel(progress)}
						</span>
					</div>
				);
			})}
		</div>
	);
}

export default function MatchView({
	session,
	showBoardControls,
	onLeave,
}: {
	session: Session;
	showBoardControls: boolean;
	onLeave: () => void;
}) {
	const state = useSessionState(session);
	const gameState = useGameState(session.game);
	const [assist, setAssist] = useState(false);
	const [metaAssist, setMetaAssist] = useState(false);
	const [flagMode, setFlagMode] = useState(false);
	const [highlight, setHighlight] = useState<Highlight | null>(null);

	const { settings } = state;
	const host = session instanceof HostSession ? session : null;

	const result = useMemo(
		() =>
			settings.allowAssistant &&
			assist &&
			gameState.status === 'playing'
				? solve(gameState.board, {
						totalMines: gameState.config.bombs,
						memory: metaAssist ? gameState.memory : undefined,
					})
				: null,
		[settings.allowAssistant, assist, metaAssist, gameState],
	);

	const act = (action: () => void) => {
		setHighlight(null);
		action();
	};
	const reveal = (cell: Cell) =>
		act(() =>
			session.dispatch({
				type: 'reveal',
				index: { x: cell.x, y: cell.y },
			}),
		);
	const chord = (cell: Cell) =>
		act(() =>
			session.dispatch({ type: 'chord', index: { x: cell.x, y: cell.y } }),
		);
	const toggleFlag = (cell: Cell) =>
		act(() =>
			session.dispatch({
				type: 'toggleFlag',
				index: { x: cell.x, y: cell.y },
			}),
		);
	const applyCells = (type: 'flag' | 'reveal', cells: Index2D[]) =>
		act(() =>
			session.dispatch({ type: 'batch', action: type, indices: cells }),
		);

	const minesLeft = gameState.config.bombs - gameState.board.flagCount;
	const winner = state.players.find((p) => p.id === state.winnerId);

	return (
		<main className="main">
			<div className="board-area">
				<div className="match-bar">
					<span className="counter" title="Mines minus flags">
						💣 {String(Math.max(-99, minesLeft)).padStart(3, '0')}
					</span>
					<Timer state={gameState} />
					{settings.mode === 'coop' && (
						<span className="match-players">
							🤝 {state.players.map((p) => p.name).join(', ')}
						</span>
					)}
					{settings.allowUndo && (
						<div className="history-controls">
							<button
								type="button"
								className="button button-icon"
								title="Undo"
								disabled={!gameState.canUndo}
								onClick={() =>
									act(() => session.dispatch({ type: 'undo' }))
								}
							>
								↩
							</button>
							<button
								type="button"
								className="button button-icon"
								title="Redo"
								disabled={!gameState.canRedo}
								onClick={() =>
									act(() => session.dispatch({ type: 'redo' }))
								}
							>
								↪
							</button>
						</div>
					)}
					{host ? (
						<button
							type="button"
							className="button"
							onClick={() => host.backToLobby()}
						>
							Back to lobby
						</button>
					) : (
						<button type="button" className="button" onClick={onLeave}>
							Leave
						</button>
					)}
				</div>

				<BoardViewport
					showControls={showBoardControls}
					extraControls={
						<FlagModeToggle
							flagMode={flagMode}
							onChange={setFlagMode}
						/>
					}
				>
					<BoardView
						board={gameState.board}
						status={gameState.status}
						lastReveal={gameState.lastReveal}
						highlight={highlight}
						flagMode={flagMode}
						onReveal={reveal}
						onChord={chord}
						onToggleFlag={toggleFlag}
					/>
				</BoardViewport>

				{winner && (
					<p className="banner banner-won">
						👑{' '}
						{winner.id === state.selfId
							? 'You win!'
							: `${winner.name} wins!`}
					</p>
				)}
				{settings.mode === 'coop' && gameState.status === 'won' && (
					<p className="banner banner-won">Cleared together! 🎉</p>
				)}
				{gameState.status === 'lost' && (
					<p className="banner banner-lost">
						Boom.
						{settings.allowUndo
							? ' Undo the move to keep going.'
							: settings.mode === 'competitive'
								? ' The race goes on without you…'
								: ''}
					</p>
				)}
			</div>

			<div className="side-panels">
				{settings.mode === 'competitive' && <Scoreboard state={state} />}
				{settings.allowAssistant && (
					<AssistantPanel
						enabled={assist}
						onEnabledChange={setAssist}
						metaAssist={metaAssist}
						onMetaAssistChange={setMetaAssist}
						memorySize={gameState.memory.size}
						result={result}
						idle={gameState.status === 'idle'}
						onHighlight={setHighlight}
						onApplyCells={applyCells}
					/>
				)}
			</div>
		</main>
	);
}
