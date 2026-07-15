import { memo } from 'react';
import type Cell from '../../domain/Cell';
import type { GameStatus } from '../../domain/game/Game';
import type { HighlightRole } from '../highlight';

/** Icons render as themeable CSS content (glyphs.css); numbers as text. */
function content(cell: Cell, status: GameStatus): React.ReactNode {
	const glyph = (kind: string) => <span className={`glyph-${kind}`} />;
	// Only *hidden* bombs get the mine glyph on loss: the one that was
	// clicked is revealed and falls through to the boom glyph below.
	if (status === 'lost' && cell.isBomb && cell.state.type === 'hidden')
		return glyph('mine');
	if (status === 'lost' && !cell.isBomb && cell.state.type === 'flagged')
		return glyph('wrong');

	switch (cell.state.type) {
		case 'hidden':
			return null;
		case 'flagged':
			return glyph('flag');
		case 'revealed':
			if (cell.isBomb) return glyph('boom');
			return cell.state.number === 0 ? null : String(cell.state.number);
	}
}

function CellView({
	cell,
	status,
	highlight,
	revealDelay,
	revealDuration,
	interactive,
	flagMode,
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
	/** Swaps the primary/secondary click actions: click flags, right-click digs. */
	flagMode: boolean;
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
				if (flagMode) {
					if (
						cell.state.type === 'hidden' ||
						cell.state.type === 'flagged'
					) {
						onToggleFlag(cell);
					}
				} else if (cell.state.type === 'hidden') {
					onReveal(cell);
				}
				// Chording happens on click, not pointer-down: a press that
				// turns into a viewport pan suppresses the click, so board
				// drags never chord in passing.
				if (revealedNumber) onChord(cell);
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
				// The alternate action: flag normally, dig in flag mode.
				if (flagMode) {
					if (cell.state.type === 'hidden') onReveal(cell);
				} else {
					onToggleFlag(cell);
				}
			}}
		>
			{content(cell, status)}
		</button>
	);
}

export default memo(CellView);
