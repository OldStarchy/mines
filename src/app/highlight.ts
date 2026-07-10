import Index2D from '../domain/Index2D';
import type { ExplanationStep } from '../domain/solver/explain';
import type { Inference } from '../domain/solver/Solver';

export type HighlightRole = 'target' | 'group' | 'source';

/** Cell key (Index2D.key) -> visual role on the board. */
export type Highlight = ReadonlyMap<string, HighlightRole>;

/** Highlight for hovering an inference as a whole. */
export function highlightInference(inference: Inference): Highlight {
	const map = new Map<string, HighlightRole>();
	for (const key of inference.constraint.cells) map.set(key, 'group');
	map.set(Index2D.key(inference.cell), 'target');
	return map;
}

/** Highlight for hovering a single explanation step. */
export function highlightStep(
	step: ExplanationStep,
	inference: Inference,
): Highlight {
	const map = new Map<string, HighlightRole>();
	for (const cell of step.cells) map.set(Index2D.key(cell), 'group');
	if (step.sourceCell) map.set(Index2D.key(step.sourceCell), 'source');
	map.set(Index2D.key(inference.cell), 'target');
	return map;
}
