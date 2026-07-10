import type Cell from '../../domain/Cell';
import Index2D from '../../domain/Index2D';
import type Board from '../../domain/Board';
import type { GameStatus } from '../../domain/game/Game';
import type { Highlight } from '../highlight';
import CellView from './CellView';

export default function BoardView({
	board,
	status,
	highlight,
	onReveal,
	onToggleFlag,
}: {
	board: Board;
	status: GameStatus;
	highlight: Highlight | null;
	onReveal: (cell: Cell) => void;
	onToggleFlag: (cell: Cell) => void;
}) {
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
					onReveal={onReveal}
					onToggleFlag={onToggleFlag}
				/>
			))}
		</div>
	);
}
