import { useMemo } from 'react';
import type Cell from '../../domain/Cell';
import Index2D from '../../domain/Index2D';
import type Board from '../../domain/Board';
import type { GameState, GameStatus } from '../../domain/game/Game';
import type { Highlight } from '../highlight';
import CellView from './CellView';

const WAVE_STEP_MS = 35;
const WAVE_MAX_MS = 700;

export default function BoardView({
	board,
	status,
	lastReveal,
	highlight,
	onReveal,
	onToggleFlag,
}: {
	board: Board;
	status: GameStatus;
	lastReveal: GameState['lastReveal'];
	highlight: Highlight | null;
	onReveal: (cell: Cell) => void;
	onToggleFlag: (cell: Cell) => void;
}) {
	// Flood-fill wave: each newly revealed cell pops after a delay
	// proportional to its distance from the clicked cell.
	const revealDelays = useMemo(() => {
		if (!lastReveal) return null;
		const delays = new Map<string, number>();
		for (const key of lastReveal.revealed) {
			const { x, y } = Index2D.fromKey(key);
			const distance = Math.max(
				Math.abs(x - lastReveal.origin.x),
				Math.abs(y - lastReveal.origin.y),
			);
			delays.set(key, Math.min(distance * WAVE_STEP_MS, WAVE_MAX_MS));
		}
		return delays;
	}, [lastReveal]);
	return (
		<div
			className="board"
			style={{
				gridTemplateColumns: `repeat(${board.cells.width}, var(--cell-size))`,
			}}
			data-status={status}
		>
			{board.cells.toArray().map((cell) => (
				<CellView
					key={Index2D.key(cell)}
					cell={cell}
					status={status}
					highlight={highlight?.get(Index2D.key(cell))}
					revealDelay={revealDelays?.get(Index2D.key(cell))}
					onReveal={onReveal}
					onToggleFlag={onToggleFlag}
				/>
			))}
		</div>
	);
}
