import { describe, expect, test } from 'vitest';
import { PRESETS } from './Game';
import {
	configKey,
	maxMines,
	normalizeConfig,
	recommendedMines,
} from './scenario';

describe('scenario', () => {
	test('recommended mines match the presets', () => {
		expect(recommendedMines(9, 9).easy).toBe(PRESETS.beginner.bombs);
		expect(recommendedMines(16, 16).medium).toBe(
			PRESETS.intermediate.bombs,
		);
		expect(recommendedMines(30, 16).hard).toBe(PRESETS.expert.bombs);
	});

	test('maxMines leaves room for a safe opening', () => {
		expect(maxMines(9, 9)).toBe(72);
		expect(maxMines(2, 2)).toBe(1);
	});

	test('normalizeConfig clamps dimensions and mine count', () => {
		expect(normalizeConfig({ width: 0, height: 999, bombs: 100000 })).toEqual(
			{ width: 2, height: 50, bombs: maxMines(2, 50) },
		);
		expect(normalizeConfig({ width: 9, height: 9, bombs: 0 })).toEqual({
			width: 9,
			height: 9,
			bombs: 1,
		});
	});

	test('configKey is stable and distinct per scenario', () => {
		expect(configKey(PRESETS.beginner)).toBe('9x9x9');
		expect(configKey(PRESETS.expert)).toBe('30x16x92');
	});
});
