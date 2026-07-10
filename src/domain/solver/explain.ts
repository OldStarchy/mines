import Index2D from '../Index2D';
import type Constraint from './Constraint';
import type { Inference } from './Solver';

export interface ExplanationStep {
	/** Stable id within this explanation, for cross-referencing steps. */
	readonly id: string;
	readonly constraint: Constraint;
	/** Human-readable statement of what this constraint says and why. */
	readonly text: string;
	/**
	 * Cells to highlight alongside this step: the constraint's own cells,
	 * plus the source number cell for base constraints.
	 */
	readonly cells: Index2D[];
	readonly sourceCell?: Index2D;
	/**
	 * Ids of the earlier steps this one is built on (its whole supporting
	 * sub-chain, transitively). Hovering a step can then light up exactly
	 * the premises it rests on.
	 */
	readonly dependsOn: string[];
}

export interface Explanation {
	/** Premises first, conclusion last; shared premises appear once. */
	readonly steps: ExplanationStep[];
	readonly conclusion: string;
}

function listCells(cells: readonly string[]): string {
	if (cells.length > 6) return `the ${cells.length} tiles around there`;
	return cells.map((key) => `(${key})`).join(', ');
}

function mines(n: number): string {
	return n === 1 ? '1 mine' : `${n} mines`;
}

/** "exactly 2 mines" | "at most 1 mine" | "at least 1 mine" | "1 to 2 mines" */
export function describeBounds(constraint: Constraint): string {
	const { min, max, size } = constraint;
	if (min === max) return `exactly ${mines(min)}`;
	if (min <= 0) return `at most ${mines(max)}`;
	if (max >= size) return `at least ${mines(min)}`;
	return `${min} to ${mines(max)}`;
}

export function describeConstraint(constraint: Constraint): string {
	const cells = listCells(constraint.cells);
	const bounds = describeBounds(constraint);
	const origin = constraint.origin;

	switch (origin.type) {
		case 'number': {
			const at = `(${Index2D.key(origin.at)})`;
			const flags =
				origin.flags > 0
					? ` and already touches ${origin.flags} flag${origin.flags === 1 ? '' : 's'}`
					: '';
			return `The ${origin.number} at ${at} needs ${mines(origin.number)}${flags}, so its hidden neighbors ${cells} hold ${bounds}.`;
		}
		case 'mineCount': {
			const remaining = origin.totalMines - origin.flags;
			const flags =
				origin.flags > 0
					? ` (${origin.totalMines} total minus ${origin.flags} flagged)`
					: '';
			return `The mine counter says ${mines(remaining)} remain${flags}, and ${cells} are the only hidden tiles left — so they hold ${bounds}.`;
		}
		case 'subset':
			return `Setting aside ${listCells(origin.part.cells)} (${describeBounds(origin.part)}) from the group of ${listCells(origin.whole.cells)} (${describeBounds(origin.whole)}) leaves ${bounds} in ${cells}.`;
		case 'intersection':
			return `The groups ${listCells(origin.a.cells)} (${describeBounds(origin.a)}) and ${listCells(origin.b.cells)} (${describeBounds(origin.b)}) overlap on ${cells}, so the overlap holds ${bounds}.`;
		case 'merge':
			return `Combining both known bounds on ${cells} gives ${bounds}.`;
		case 'memory':
			return origin.knowledge === 'mine'
				? `You revealed ${cells} earlier and undid it — you already know it is a mine.`
				: `You revealed ${cells} earlier and undid it — you already know it is safe.`;
	}
}

export function explainConstraint(constraint: Constraint): ExplanationStep[] {
	const steps: ExplanationStep[] = [];
	const ids = new Map<Constraint, string>();

	function visit(c: Constraint): string {
		const existing = ids.get(c);
		if (existing) return existing;

		// Parents are visited first (post-order), so their own supporting
		// chains are already computed and can be inherited transitively.
		const dependsOn = new Set<string>();
		for (const parent of c.parents) {
			const parentId = visit(parent);
			dependsOn.add(parentId);
			const parentStep = steps.find((s) => s.id === parentId);
			for (const dep of parentStep?.dependsOn ?? []) dependsOn.add(dep);
		}

		const id = `s${steps.length}`;
		ids.set(c, id);
		steps.push({
			id,
			constraint: c,
			text: describeConstraint(c),
			cells: c.indices,
			sourceCell: c.origin.type === 'number' ? c.origin.at : undefined,
			dependsOn: [...dependsOn],
		});
		return id;
	}

	visit(constraint);
	return steps;
}

export function explainInference(inference: Inference): Explanation {
	const { constraint, cell, type } = inference;
	const steps = explainConstraint(constraint);

	const conclusion =
		type === 'flag'
			? constraint.size === 1
				? `Therefore (${Index2D.key(cell)}) must be a mine — flag it.`
				: `All ${constraint.size} cells ${listCells(constraint.cells)} must be mines, so (${Index2D.key(cell)}) can be flagged.`
			: constraint.size === 1
				? `Therefore (${Index2D.key(cell)}) cannot be a mine — it is safe to reveal.`
				: `None of ${listCells(constraint.cells)} can be mines, so (${Index2D.key(cell)}) is safe to reveal.`;

	return { steps, conclusion };
}
