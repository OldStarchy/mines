/** Player preferences that apply across games (localStorage-backed). */
export interface AppSettings {
	/** Auto-play flags a number proves (single player). */
	readonly autoFlag: boolean;
	/** Auto-chord numbers already satisfied by their flags (single player). */
	readonly autoReveal: boolean;
	/** Show the floating board controls (mode toggle, zoom). */
	readonly showBoardControls: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
	autoFlag: false,
	autoReveal: false,
	showBoardControls: true,
};

const STORAGE_KEY = 'mines.settings';

export function loadSettings(): AppSettings {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return DEFAULT_APP_SETTINGS;
		return { ...DEFAULT_APP_SETTINGS, ...JSON.parse(stored) };
	} catch {
		return DEFAULT_APP_SETTINGS;
	}
}

export function saveSettings(settings: AppSettings) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch {
		// best-effort
	}
}
