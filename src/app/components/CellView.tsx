import { memo } from 'react';
import type Cell from '../../domain/Cell';
import type { GameStatus } from '../../domain/game/Game';
import type { HighlightRole } from '../highlight';

function content(cell: Cell, status: GameStatus): string {
	if (status === 'lost' && cell.isBomb && cell.state.type !== 'flagged')
		return '💣';
	if (status === 'lost' && !cell.isBomb && cell.state.type === 'flagged')
		return '❌';

	switch (cell.state.type) {
		case 'hidden':
			return '';
		case 'flagged':
			return '🚩';
		case 'revealed':
			if (cell.isBomb) return '💥';
			return cell.state.number === 0 ? '' : String(cell.state.number);
	}
}

function CellView({
	cell,
	status,
	highlight,
	revealDelay,
	onReveal,
	onToggleFlag,
}: {
	cell: Cell;
	status: GameStatus;
	highlight: HighlightRole | undefined;
	revealDelay: number | undefined;
	onReveal: (cell: Cell) => void;
	onToggleFlag: (cell: Cell) => void;
}) {
	const revealed =
		cell.state.type === 'revealed' ||
		(status === 'lost' && cell.isBomb === true);

	const classes = ['cell', revealed ? 'cell-revealed' : 'cell-hidden'];
	if (cell.state.type === 'revealed' && !cell.isBomb && cell.state.number > 0)
		classes.push(`n${cell.state.number}`);
	if (cell.state.type === 'revealed' && cell.isBomb) classes.push('cell-hit');
	if (cell.state.type === 'flagged') classes.push('cell-flagged');
	if (revealDelay !== undefined) classes.push('cell-pop');
	if (highlight) classes.push(`hl-${highlight}`);

	return (
		<button
			type="button"
			className={classes.join(' ')}
			style={
				revealDelay ? { animationDelay: `${revealDelay}ms` } : undefined
			}
			data-cell={`${cell.x},${cell.y}`}
			onClick={() => onReveal(cell)}
			onContextMenu={(event) => {
				event.preventDefault();
				onToggleFlag(cell);
			}}
		>
			{content(cell, status)}
		</button>
	);
}

export default memo(CellView);
