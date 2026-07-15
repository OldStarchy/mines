import type { GameConfig, GameStatus } from '../domain/game/Game';
import {
	deserializeRecord,
	serializeRecord,
	type GameRecord,
} from '../domain/game/GameRecord';
import { configKey, parseConfigKey } from '../domain/game/scenario';

const SAVE_PREFIX = 'mines.save.';
const META_SUFFIX = '.meta';
const LAST_CONFIG_KEY = 'mines.lastConfig';

/**
 * Sidecar to a saved record: everything about the session that is NOT
 * derivable from the move log — play time, raw click count, whether
 * assists were used — plus the status so the difficulty menu can tell
 * in-progress saves from finished ones without replaying the record.
 */
export interface SaveMeta {
	/** Milliseconds of play time accumulated when the save was written. */
	readonly elapsed: number;
	readonly status: GameStatus;
	/** Raw board clicks this game, including no-ops. */
	readonly clicks: number;
	/** The assistant was on, or undo was used, at some point. */
	readonly assisted: boolean;
	/** This game's outcome already went into the statistics. */
	readonly counted: boolean;
}

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
export function saveGame(record: GameRecord, meta: SaveMeta) {
	const key = SAVE_PREFIX + configKey(record.config);
	if (record.moves.length === 0) {
		safeRemove(key);
		safeRemove(key + META_SUFFIX);
		return;
	}
	safeSet(key, serializeRecord(record));
	safeSet(key + META_SUFFIX, JSON.stringify(meta));
}

export function loadGame(config: GameConfig): GameRecord | null {
	const json = safeGet(SAVE_PREFIX + configKey(config));
	return json ? deserializeRecord(json) : null;
}

export function loadMeta(config: GameConfig): SaveMeta | null {
	const json = safeGet(SAVE_PREFIX + configKey(config) + META_SUFFIX);
	if (!json) return null;
	try {
		const meta = JSON.parse(json) as SaveMeta;
		if (typeof meta?.elapsed === 'number') return meta;
	} catch {
		// fall through
	}
	return null;
}

export function hasSave(config: GameConfig): boolean {
	return safeGet(SAVE_PREFIX + configKey(config)) !== null;
}

/** A save exists and its game is still unfinished. */
export function hasSaveInProgress(config: GameConfig): boolean {
	if (!hasSave(config)) return false;
	const meta = loadMeta(config);
	// Saves from before meta existed can't tell; assume resumable.
	return meta ? meta.status === 'playing' : true;
}

/** Every config with a saved game, whatever its status. */
export function savedConfigs(): GameConfig[] {
	const configs: GameConfig[] = [];
	try {
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (!key?.startsWith(SAVE_PREFIX)) continue;
			if (key.endsWith(META_SUFFIX)) continue;
			const config = parseConfigKey(key.slice(SAVE_PREFIX.length));
			if (config) configs.push(config);
		}
	} catch {
		// disabled storage — nothing saved, then
	}
	return configs;
}

export function clearSave(config: GameConfig) {
	safeRemove(SAVE_PREFIX + configKey(config));
	safeRemove(SAVE_PREFIX + configKey(config) + META_SUFFIX);
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
