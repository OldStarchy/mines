import type { GameConfig } from '../domain/game/Game';
import { analyzeRecord, type FlagTally } from '../domain/game/analyze';
import type { GameRecord } from '../domain/game/GameRecord';
import { configKey } from '../domain/game/scenario';
import type { SaveMeta } from './persistence';

export type GameOutcome = 'won' | 'lost' | 'abandoned';

/** One finished game on the best-times board. */
export interface ScoreEntry {
	readonly timeMs: number;
	/** Assistant on at any point, or undo used. */
	readonly assisted: boolean;
	/** Raw clicks (no-ops included) divided by the board's mine count. */
	readonly clickRatio: number;
	readonly date: string;
}

/** Lifetime statistics for one board configuration. */
export interface ConfigStats {
	played: number;
	won: number;
	lost: number;
	abandoned: number;
	chords: number;
	flags: { manual: FlagTally; chorded: FlagTally };
	/** Fastest wins first, capped at SCOREBOARD_SIZE. */
	board: ScoreEntry[];
}

export const SCOREBOARD_SIZE = 10;

const STORAGE_KEY = 'mines.stats';

export function emptyStats(): ConfigStats {
	return {
		played: 0,
		won: 0,
		lost: 0,
		abandoned: 0,
		chords: 0,
		flags: {
			manual: { correct: 0, incorrect: 0 },
			chorded: { correct: 0, incorrect: 0 },
		},
		board: [],
	};
}

/** Fills in any fields missing from older stored shapes. */
export function normalizeStats(
	stats: Partial<ConfigStats> | undefined,
): ConfigStats {
	const base = emptyStats();
	if (!stats) return base;
	return {
		...base,
		...stats,
		flags: {
			manual: { ...base.flags.manual, ...stats.flags?.manual },
			chorded: { ...base.flags.chorded, ...stats.flags?.chorded },
		},
		board: stats.board ?? [],
	};
}

export function loadAllStats(): Record<string, ConfigStats> {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return stored
			? (JSON.parse(stored) as Record<string, ConfigStats>)
			: {};
	} catch {
		return {};
	}
}

function update(config: GameConfig, change: (stats: ConfigStats) => void) {
	const all = loadAllStats();
	const key = configKey(config);
	const stats = normalizeStats(all[key]);
	change(stats);
	all[key] = stats;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
	} catch {
		// best-effort
	}
}

/** A fresh game got its first move. */
export function recordStart(config: GameConfig) {
	update(config, (stats) => stats.played++);
}

/**
 * A game reached its (first) outcome: finished, or discarded while in
 * progress. Move-log statistics aggregate here; wins also enter the
 * best-times board.
 */
export function recordOutcome(
	config: GameConfig,
	outcome: GameOutcome,
	record: GameRecord,
	meta: SaveMeta,
) {
	update(config, (stats) => {
		stats[outcome]++;
		// A game may predate its stats (an old save, another device):
		// outcomes always imply at least as many games played.
		stats.played = Math.max(
			stats.played,
			stats.won + stats.lost + stats.abandoned,
		);

		const analyzed = analyzeRecord(record);
		stats.chords += analyzed.chords;
		for (const kind of ['manual', 'chorded'] as const) {
			stats.flags[kind].correct += analyzed.flags[kind].correct;
			stats.flags[kind].incorrect += analyzed.flags[kind].incorrect;
		}

		if (outcome === 'won') {
			stats.board.push({
				timeMs: meta.elapsed,
				assisted: meta.assisted,
				clickRatio: meta.clicks / config.bombs,
				date: new Date().toISOString(),
			});
			stats.board.sort((a, b) => a.timeMs - b.timeMs);
			stats.board.length = Math.min(
				stats.board.length,
				SCOREBOARD_SIZE,
			);
		}
	});
}
