import type { GameConfig } from './Game';

export const MIN_DIMENSION = 2;
export const MAX_DIMENSION = 50;

/**
 * The most bombs a board can hold while keeping the first click safe:
 * the opening clears up to a 3×3, and at least one cell must be safe.
 */
export function maxMines(width: number, height: number): number {
	return Math.max(1, width * height - 9);
}

/** Mine densities matching our beginner/intermediate/expert presets. */
export const DENSITIES = {
	easy: 9 / 81,
	medium: 36 / 256,
	hard: 92 / 480,
} as const;

export type Density = keyof typeof DENSITIES;

/** Suggested mine count for a board at each difficulty, clamped to fit. */
export function recommendedMines(
	width: number,
	height: number,
): Record<Density, number> {
	const cells = width * height;
	const cap = maxMines(width, height);
	const clampCount = (n: number) =>
		Math.min(cap, Math.max(1, Math.round(n)));

	return {
		easy: clampCount(cells * DENSITIES.easy),
		medium: clampCount(cells * DENSITIES.medium),
		hard: clampCount(cells * DENSITIES.hard),
	};
}

export function clampDimension(value: number): number {
	if (!Number.isFinite(value)) return MIN_DIMENSION;
	return Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, Math.round(value)));
}

/** Coerces arbitrary editor input into a valid, playable config. */
export function normalizeConfig(config: GameConfig): GameConfig {
	const width = clampDimension(config.width);
	const height = clampDimension(config.height);
	const bombs = Math.min(
		maxMines(width, height),
		Math.max(1, Math.round(config.bombs)),
	);
	return { width, height, bombs };
}

/** A stable key identifying a scenario, used as its save slot. */
export function configKey(config: GameConfig): string {
	return `${config.width}x${config.height}x${config.bombs}`;
}
