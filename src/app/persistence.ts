import type { GameConfig } from '../domain/game/Game';
import {
	deserializeRecord,
	serializeRecord,
	type GameRecord,
} from '../domain/game/GameRecord';
import { configKey } from '../domain/game/scenario';

const SAVE_PREFIX = 'mines.save.';
const LAST_CONFIG_KEY = 'mines.lastConfig';

function safeGet(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function safeSet(key: string, value: string) {
	try {
		localStorage.setItem(key, value);
	} catch {
		// Ignore quota / disabled-storage errors — persistence is best-effort.
	}
}

function safeRemove(key: string) {
	try {
		localStorage.removeItem(key);
	} catch {
		// ignore
	}
}

/**
 * Persists a game under a slot keyed by its scenario, so each
 * difficulty (and each custom board) keeps its own in-progress game.
 * An untouched game clears the slot rather than saving an empty record.
 */
export function saveGame(record: GameRecord) {
	const key = SAVE_PREFIX + configKey(record.config);
	if (record.moves.length === 0) {
		safeRemove(key);
		return;
	}
	safeSet(key, serializeRecord(record));
}

export function loadGame(config: GameConfig): GameRecord | null {
	const json = safeGet(SAVE_PREFIX + configKey(config));
	return json ? deserializeRecord(json) : null;
}

export function hasSave(config: GameConfig): boolean {
	return safeGet(SAVE_PREFIX + configKey(config)) !== null;
}

export function clearSave(config: GameConfig) {
	safeRemove(SAVE_PREFIX + configKey(config));
}

export function saveLastConfig(config: GameConfig) {
	safeSet(LAST_CONFIG_KEY, JSON.stringify(config));
}

export function loadLastConfig(): GameConfig | null {
	const json = safeGet(LAST_CONFIG_KEY);
	if (!json) return null;
	try {
		const config = JSON.parse(json) as GameConfig;
		if (
			typeof config?.width === 'number' &&
			typeof config?.height === 'number' &&
			typeof config?.bombs === 'number'
		) {
			return config;
		}
	} catch {
		// fall through
	}
	return null;
}
