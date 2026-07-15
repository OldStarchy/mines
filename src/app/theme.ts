import { hasCustomTheme } from './customTheme';

export const THEMES = {
	classic: 'Classic',
	midnight: 'Midnight',
	mint: 'Mint',
	meadow: 'Meadow',
	dragon: 'Dragon',
	dusk: 'Dusk',
} as const;

/** 'custom' is the player-generated theme; only valid while one exists. */
export type ThemeName = keyof typeof THEMES | 'custom';

const STORAGE_KEY = 'mines.theme';

/** What the OS asks for: classic for light, midnight for dark. */
export function systemTheme(): ThemeName {
	return window.matchMedia('(prefers-color-scheme: dark)').matches
		? 'midnight'
		: 'classic';
}

export function hasStoredTheme(): boolean {
	return localStorage.getItem(STORAGE_KEY) !== null;
}

/** The stored choice, or the system preference until one is made. */
export function loadTheme(): ThemeName {
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === 'custom') {
		return hasCustomTheme() ? 'custom' : systemTheme();
	}
	return stored && stored in THEMES ? (stored as ThemeName) : systemTheme();
}

export function applyTheme(theme: ThemeName) {
	document.documentElement.dataset.theme = theme;
}

/** An explicit pick sticks; the default keeps following the system. */
export function saveTheme(theme: ThemeName) {
	localStorage.setItem(STORAGE_KEY, theme);
}
