export const THEMES = {
	classic: 'Classic',
	midnight: 'Midnight',
	mint: 'Mint',
} as const;

export type ThemeName = keyof typeof THEMES;

const STORAGE_KEY = 'mines.theme';

export function loadTheme(): ThemeName {
	const stored = localStorage.getItem(STORAGE_KEY);
	return stored && stored in THEMES ? (stored as ThemeName) : 'classic';
}

export function applyTheme(theme: ThemeName) {
	document.documentElement.dataset.theme = theme;
	localStorage.setItem(STORAGE_KEY, theme);
}
