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
	revealDuration,
	interactive,
	onReveal,
	onChord,
	onToggleFlag,
}: {
	cell: Cell;
	status: GameStatus;
	highlight: HighlightRole | undefined;
	revealDelay: number | undefined;
	revealDuration: number | undefined;
	interactive: boolean;
	onReveal: (cell: Cell) => void;
	onChord: (cell: Cell) => void;
	onToggleFlag: (cell: Cell) => void;
}) {
	const number =
		cell.state.type === 'revealed' && !cell.isBomb ? cell.state.number : 0;
	const revealedNumber = number > 0;
	const revealed =
		cell.state.type === 'revealed' ||
		(status === 'lost' && cell.isBomb === true);

	const classes = ['cell', revealed ? 'cell-revealed' : 'cell-hidden'];
	if (revealedNumber) classes.push(`n${number}`);
	if (cell.state.type === 'revealed' && cell.isBomb) classes.push('cell-hit');
	if (cell.state.type === 'flagged') classes.push('cell-flagged');
	if (revealDelay !== undefined) classes.push('cell-pop');
	if (highlight) classes.push(`hl-${highlight}`);

	const style: React.CSSProperties = {};
	if (revealDelay !== undefined) style.animationDelay = `${revealDelay}ms`;
	if (revealDuration !== undefined)
		style.animationDuration = `${revealDuration}ms`;

	return (
		<button
			type="button"
			className={classes.join(' ')}
			style={style}
			data-cell={`${cell.x},${cell.y}`}
			disabled={!interactive}
			onClick={() => {
				if (cell.state.type === 'hidden') onReveal(cell);
			}}
			// Chording happens on pointer-down so that keeping the button
			// held and sweeping across numbers chords each one in passing.
			onPointerDown={(event) => {
				if (event.button === 0 && revealedNumber) onChord(cell);
			}}
			onPointerOver={(event) => {
				if (event.buttons === 1 && revealedNumber) onChord(cell);
			}}
			onAuxClick={(event) => {
				// Middle-click always chords.
				if (event.button === 1) {
					event.preventDefault();
					onChord(cell);
				}
			}}
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
