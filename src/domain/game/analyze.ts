import Index2D from '../Index2D';
import { applyMove, baseBoard, type GameRecord } from './GameRecord';

export interface FlagTally {
	/** Flags that sat on a mine. */
	correct: number;
	incorrect: number;
}

/** Per-game statistics derivable from the move log alone. */
export interface RecordStats {
	/** Recorded chord moves (clicks on a number that changed the board). */
	chords: number;
	/**
	 * Flag placements: manual = single flag moves, chorded = flags laid
	 * by chords or batches (assistant, auto-flag). Placing, removing and
	 * re-placing a flag counts each placement.
	 */
	flags: {
		manual: FlagTally;
		chorded: FlagTally;
	};
}

export function analyzeRecord(record: GameRecord): RecordStats {
	const mines = new Set(record.mines);
	const stats: RecordStats = {
		chords: 0,
		flags: {
			manual: { correct: 0, incorrect: 0 },
			chorded: { correct: 0, incorrect: 0 },
		},
	};

	let board = baseBoard(record);
	for (const move of record.moves) {
		const next = applyMove(board, move);

		if (move.type === 'chord') stats.chords++;

		// Winning derives auto-flags on the remaining mines (see
		// withWinFlags); nobody placed those, so skip winning moves.
		const placesFlags =
			move.type === 'flag' ||
			move.type === 'chord' ||
			(move.type === 'batch' && move.action === 'flag');
		if (placesFlags && !next.isWon) {
			const tally =
				move.type === 'flag'
					? stats.flags.manual
					: stats.flags.chorded;
			const before = board.cells.toArray();
			next.cells.toArray().forEach((cell, i) => {
				if (
					cell.state.type === 'flagged' &&
					before[i].state.type !== 'flagged'
				) {
					if (mines.has(Index2D.key(cell))) tally.correct++;
					else tally.incorrect++;
				}
			});
		}

		board = next;
	}

	return stats;
}
