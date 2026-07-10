import type { BombCount } from '../CellState';
import Index2D from '../Index2D';

/**
 * Where a constraint came from. Base constraints originate from a revealed
 * numbered cell; derived constraints reference their parent constraints so a
 * full derivation tree can be reconstructed for explanations.
 */
export type ConstraintOrigin =
	| {
			readonly type: 'number';
			/** The revealed cell whose number produced this constraint. */
			readonly at: Index2D;
			readonly number: BombCount;
			/** Flagged neighbors already accounted for. */
			readonly flags: number;
	  }
	| {
			/** part ⊆ whole, so (whole \ part) is also constrained. */
			readonly type: 'subset';
			readonly whole: Constraint;
			readonly part: Constraint;
	  }
	| {
			/** a and b overlap; bounds the mines inside the overlap. */
			readonly type: 'intersection';
			readonly a: Constraint;
			readonly b: Constraint;
	  }
	| {
			/** a and b cover the same cells; bounds intersected. */
			readonly type: 'merge';
			readonly a: Constraint;
			readonly b: Constraint;
	  };

/**
 * "Between `min` and `max` of the hidden cells in `cells` are mines."
 *
 * Only ever ranges over hidden cells; flags are treated as confirmed mines
 * and revealed cells carry no uncertainty.
 */
export default class Constraint {
	/** Sorted cell keys (see Index2D.key), the canonical set identity. */
	readonly cells: readonly string[];

	constructor(
		cells: Iterable<string>,
		readonly min: number,
		readonly max: number,
		readonly origin: ConstraintOrigin,
		/** 0 for base constraints, 1 + max(parents) for derived ones. */
		readonly depth: number,
	) {
		this.cells = [...new Set(cells)].sort();
	}

	get size() {
		return this.cells.length;
	}

	/** Key identifying the cell set (ignores bounds). */
	get setKey(): string {
		return this.cells.join(';');
	}

	/** Key identifying set and bounds, used for exact deduplication. */
	get key(): string {
		return `${this.setKey}|${this.min}|${this.max}`;
	}

	get indices(): Index2D[] {
		return this.cells.map(Index2D.fromKey);
	}

	/** True when the bounds actually restrict something. */
	get isInformative(): boolean {
		return this.min > 0 || this.max < this.size;
	}

	/** Every cell in the set is a mine. */
	get isAllMines(): boolean {
		return this.size > 0 && this.min === this.size;
	}

	/** No cell in the set is a mine. */
	get isAllSafe(): boolean {
		return this.size > 0 && this.max === 0;
	}

	/** Bounds that cannot be satisfied, e.g. after clamping. */
	get isContradiction(): boolean {
		return this.min > this.max;
	}

	contains(other: Constraint): boolean {
		if (other.size > this.size) return false;
		const set = new Set(this.cells);
		return other.cells.every((c) => set.has(c));
	}

	intersectionWith(other: Constraint): string[] {
		const set = new Set(this.cells);
		return other.cells.filter((c) => set.has(c));
	}

	withoutCellsOf(other: Constraint): string[] {
		const set = new Set(other.cells);
		return this.cells.filter((c) => !set.has(c));
	}
}
