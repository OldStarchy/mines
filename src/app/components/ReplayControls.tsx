import { REPLAY_SPEEDS, type Replay } from '../useReplay';

/**
 * Playback bar shown under the board during a replay: play/pause,
 * progress, speed in actions-per-second, and a way back to the game.
 */
export default function ReplayControls({ replay }: { replay: Replay }) {
	const view = replay.view;
	if (!view) return null;

	return (
		<div className="replay-bar">
			<button
				type="button"
				className="button button-icon"
				title={view.playing ? 'Pause' : 'Play'}
				onClick={() => replay.togglePlay()}
			>
				{view.playing ? '⏸' : '▶'}
			</button>

			<span className="replay-progress">
				move {view.moveIndex}/{view.totalMoves}
			</span>

			<span className="replay-speeds">
				{REPLAY_SPEEDS.map((speed) => (
					<button
						key={speed}
						type="button"
						className={`button button-mini${
							view.aps === speed ? ' button-selected' : ''
						}`}
						title={`${speed} actions per second`}
						onClick={() => replay.setAps(speed)}
					>
						{speed}×
					</button>
				))}
			</span>

			<button
				type="button"
				className="button"
				onClick={() => replay.stop()}
			>
				Back to game
			</button>
		</div>
	);
}
