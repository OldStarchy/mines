import { useEffect, useMemo, useState } from 'react';
import type Board from '../domain/Board';
import type { GameState, GameStatus } from '../domain/game/Game';
import {
	baseBoard,
	boardsForRecord,
	revealedDiff,
	type GameRecord,
} from '../domain/game/GameRecord';

export const REPLAY_SPEEDS = [1, 2, 4, 8] as const;

export interface Replay {
	/** null when no replay is running. */
	readonly view: {
		readonly board: Board;
		readonly status: GameStatus;
		readonly lastReveal: GameState['lastReveal'];
		/** How many moves have been played back so far. */
		readonly moveIndex: number;
		readonly totalMoves: number;
		readonly playing: boolean;
		readonly aps: number;
	} | null;
	start(record: GameRecord): void;
	stop(): void;
	/** Pause, resume, or restart from the beginning when at the end. */
	togglePlay(): void;
	setAps(aps: number): void;
}

/**
 * Plays a GameRecord back one move per tick at an adjustable
 * actions-per-second rate. Moves are spaced evenly — a chord is a
 * single tick no matter how much it reveals — and the caller scales
 * the reveal-wave animation to the tick interval via `waveScale`.
 */
export default function useReplay(): Replay {
	const [record, setRecord] = useState<GameRecord | null>(null);
	const [moveIndex, setMoveIndex] = useState(0);
	const [playing, setPlaying] = useState(false);
	const [aps, setAps] = useState<number>(2);

	// boards[i] is the board after i moves; boards[0] is the base board.
	const boards = useMemo(
		() => (record ? [baseBoard(record), ...boardsForRecord(record)] : null),
		[record],
	);
	const totalMoves = record?.moves.length ?? 0;

	const done = moveIndex >= totalMoves;
	useEffect(() => {
		if (!playing || done) return;
		const timer = setInterval(
			() => setMoveIndex((i) => i + 1),
			1000 / aps,
		);
		return () => clearInterval(timer);
	}, [playing, done, aps]);

	useEffect(() => {
		if (done) setPlaying(false);
	}, [done]);

	const view = useMemo(() => {
		if (!record || !boards) return null;

		const board = boards[moveIndex];
		const move = moveIndex > 0 ? record.moves[moveIndex - 1] : null;
		const lastReveal =
			move && (move.type === 'reveal' || move.type === 'chord')
				? {
						origin: move.index,
						revealed: revealedDiff(boards[moveIndex - 1], board),
					}
				: null;

		const status: GameStatus =
			moveIndex === 0
				? 'idle'
				: board.isLost
					? 'lost'
					: board.isWon
						? 'won'
						: 'playing';

		return {
			board,
			status,
			lastReveal,
			moveIndex,
			totalMoves,
			playing,
			aps,
		};
	}, [record, boards, moveIndex, totalMoves, playing, aps]);

	return {
		view,
		start(next: GameRecord) {
			setRecord(next);
			setMoveIndex(0);
			setPlaying(true);
		},
		stop() {
			setRecord(null);
			setPlaying(false);
			setMoveIndex(0);
		},
		togglePlay() {
			if (!playing && done) setMoveIndex(0);
			setPlaying((p) => !p);
		},
		setAps,
	};
}
