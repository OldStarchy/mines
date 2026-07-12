import type { GameConfig, PresetName } from '../../domain/game/Game';
import { PRESETS } from '../../domain/game/Game';

export const PRESET_LABELS: Record<PresetName, string> = {
	beginner: 'Beginner 9×9',
	intermediate: 'Intermediate 16×16',
	expert: 'Expert 30×16',
};

export function presetOf(config: GameConfig): PresetName | null {
	return (
		(Object.keys(PRESETS) as PresetName[]).find(
			(name) =>
				PRESETS[name].width === config.width &&
				PRESETS[name].height === config.height &&
				PRESETS[name].bombs === config.bombs,
		) ?? null
	);
}

/** Human label for a config: its preset name, or its dimensions. */
export function configLabel(config: GameConfig): string {
	const preset = presetOf(config);
	return preset
		? PRESET_LABELS[preset]
		: `Custom ${config.width}×${config.height}, ${config.bombs} mines`;
}
