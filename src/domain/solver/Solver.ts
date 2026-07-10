import Action from '../Action';
import type Board from '../Board';
import Index2D from '../Index2D';
import Range2D from '../Range2D';
import Constraint from './Constraint';

export interface Inference {
	readonly type: 'flag' | 'reveal';
	readonly cell: Index2D;
	/** The simplest constraint that proves this (isAllMines or isAllSafe). */
	readonly constraint: Constraint;
	/**
	 * Other, independent proofs of the same conclusion, ranked after the
	 * primary one by increasing complexity. Empty when there is only one.
	 */
	readonly alternatives: Constraint[];
}

/** How many alternative proofs to keep per inference. */
const MAX_ALTERNATIVES = 3;

/** Ranks proofs: fewest steps, then shallowest, then smallest set. */
function proofOrder(a: Constraint, b: Constraint): number {
	return (
		a.stepCount - b.stepCount ||
		a.depth - b.depth ||
		a.size - b.size
	);
}

export interface SolveResult {
	/** All informative constraints discovered, base and derived. */
	readonly constraints: Constraint[];
	/** One inference per cell (the shallowest derivation wins). */
	readonly inferences: Inference[];
	/**
	 * Non-empty when the visible numbers and flags cannot all be true,
	 * i.e. at least one flag must be wrong.
	 */
	readonly contradictions: Constraint[];
}

export interface SolveOptions {
	/** Max derivation depth; the interesting patterns appear by depth 3. */
	maxDepth?: number;
	/** Hard cap on total constraints, guards against pathological boards. */
	maxConstraints?: number;
	/**
	 * Total mine count as shown on the mine counter. When given, the
	 * remaining count (total − flags) constrains the set of all hidden
	 * cells — the late-game "counter" rule.
	 */
	totalMines?: number;
	/**
	 * The counter rule only kicks in once the hidden region is this
	 * small: earlier it derives sprawling constraints that explain
	 * nothing, and endgames are where the counter decides anything.
	 */
	mineCountCellLimit?: number;
	/**
	 * Opt-in meta-gaming: cells the player revealed then undid, mapped to
	 * what they saw. Fed in as known-mine / known-safe constraints.
	 */
	memory?: ReadonlyMap<string, 'mine' | 'safe'>;
}

export function inferenceToAction(inference: Inference): Action {
	return inference.type === 'flag'
		? Action.flag(inference.cell)
		: Action.reveal(inference.cell);
}

/**
 * Derives everything that can be proven from the currently visible board:
 * revealed numbers are facts, flags are assumed correct, and `isBomb` of
 * hidden cells is never consulted.
 *
 * Base constraints come from each revealed number (rule: the mines among a
 * number's hidden neighbors equal the number minus its flagged neighbors).
 * Derived constraints come from combining overlapping constraints:
 *
 * - subset: if part ⊆ whole, then (whole \ part) holds
 *   [whole.min − part.max, whole.max − part.min] mines.
 * - intersection: for overlapping a, b the overlap I holds at most
 *   min(a.max, b.max, |I|) and at least max(a.min − |a\b|, b.min − |b\a|)
 *   mines. Follow-up subset derivations then constrain a\I and b\I.
 * - merge: two bounds over the same set intersect.
 *
 * The loop runs to a fixpoint (bounded by maxDepth/maxConstraints). Any
 * constraint that pins all its cells (all mines, or all safe) yields
 * inferences.
 */
export default function solve(
	board: Board,
	{
		maxDepth = 4,
		maxConstraints = 2000,
		totalMines,
		mineCountCellLimit = 24,
		memory,
	}: SolveOptions = {},
): SolveResult {
	/** Tightest known constraint per cell set. */
	const bySet = new Map<string, Constraint>();
	/** Which sets each cell participates in, for overlap lookup. */
	const setsByCell = new Map<string, Set<string>>();
	const contradictions: Constraint[] = [];
	const queue: Constraint[] = [];

	function index(constraint: Constraint) {
		bySet.set(constraint.setKey, constraint);
		for (const cell of constraint.cells) {
			let sets = setsByCell.get(cell);
			if (!sets) setsByCell.set(cell, (sets = new Set()));
			sets.add(constraint.setKey);
		}
	}

	/** Clamps, deduplicates and enqueues a candidate constraint. */
	function add(
		cells: Iterable<string>,
		min: number,
		max: number,
		origin: Constraint['origin'],
		depth: number,
	) {
		const candidate = new Constraint(cells, min, max, origin, depth);

		if (candidate.isContradiction || min < 0 || max > candidate.size) {
			contradictions.push(candidate);
			if (candidate.isContradiction) return;
		}
		if (candidate.size === 0) return;

		const clamped =
			min < 0 || max > candidate.size
				? new Constraint(
						candidate.cells,
						Math.max(0, min),
						Math.min(candidate.size, max),
						origin,
						depth,
					)
				: candidate;

		if (!clamped.isInformative) return;
		if (bySet.size >= maxConstraints) return;

		const existing = bySet.get(clamped.setKey);
		if (existing) {
			const mergedMin = Math.max(existing.min, clamped.min);
			const mergedMax = Math.min(existing.max, clamped.max);
			if (mergedMin === existing.min && mergedMax === existing.max)
				return; // nothing new

			const next =
				mergedMin === clamped.min && mergedMax === clamped.max
					? clamped
					: new Constraint(
							clamped.cells,
							mergedMin,
							mergedMax,
							{ type: 'merge', a: existing, b: clamped },
							Math.max(existing.depth, clamped.depth) + 1,
						);
			if (next.isContradiction) {
				contradictions.push(next);
				return;
			}
			index(next);
			queue.push(next);
			return;
		}

		index(clamped);
		queue.push(clamped);
	}

	// Base constraints from revealed numbers.
	for (const cell of board.cells.toArray()) {
		if (cell.state.type !== 'revealed') continue;

		const neighbors = board.cells
			.slice(Range2D.around(cell))
			.toArray()
			.filter((c) => c !== cell);

		const hidden = neighbors.filter((c) => c.state.type === 'hidden');
		const flags = neighbors.filter((c) => c.state.type === 'flagged').length;
		const remaining = cell.state.number - flags;
		if (hidden.length === 0 && remaining >= 0) continue;

		add(
			hidden.map(Index2D.key),
			remaining,
			remaining,
			{
				type: 'number',
				at: { x: cell.x, y: cell.y },
				number: cell.state.number,
				flags,
			},
			0,
		);
	}

	// The mine counter itself is a constraint over everything hidden.
	if (totalMines !== undefined) {
		const allCells = board.cells.toArray();
		const hidden = allCells.filter((c) => c.state.type === 'hidden');
		const flags = allCells.filter(
			(c) => c.state.type === 'flagged',
		).length;
		const remaining = totalMines - flags;

		if (hidden.length > 0 && hidden.length <= mineCountCellLimit) {
			add(
				hidden.map(Index2D.key),
				remaining,
				remaining,
				{ type: 'mineCount', totalMines, flags },
				0,
			);
		}
	}

	// Opt-in memory: cells the player revealed then undid are known.
	if (memory) {
		for (const [key, knowledge] of memory) {
			const cell = board.cells.atOrNull(Index2D.fromKey(key));
			if (!cell || cell.state.type !== 'hidden') continue;
			const mines = knowledge === 'mine' ? 1 : 0;
			add([key], mines, mines, { type: 'memory', knowledge }, 0);
		}
	}

	// Fixpoint: combine each new constraint with every overlapping one.
	while (queue.length > 0) {
		const a = queue.shift()!;
		if (bySet.get(a.setKey) !== a) continue; // superseded by a merge
		if (a.depth >= maxDepth) continue;

		const overlappingKeys = new Set<string>();
		for (const cell of a.cells)
			for (const key of setsByCell.get(cell) ?? [])
				if (key !== a.setKey) overlappingKeys.add(key);

		for (const key of overlappingKeys) {
			const b = bySet.get(key);
			if (!b || b.depth >= maxDepth) continue;

			const depth = Math.max(a.depth, b.depth) + 1;

			if (b.contains(a)) {
				add(
					b.withoutCellsOf(a),
					b.min - a.max,
					b.max - a.min,
					{ type: 'subset', whole: b, part: a },
					depth,
				);
			} else if (a.contains(b)) {
				add(
					a.withoutCellsOf(b),
					a.min - b.max,
					a.max - b.min,
					{ type: 'subset', whole: a, part: b },
					depth,
				);
			} else {
				const overlap = a.intersectionWith(b);
				const aOutside = a.size - overlap.length;
				const bOutside = b.size - overlap.length;
				add(
					overlap,
					Math.max(a.min - aOutside, b.min - bOutside),
					Math.min(a.max, b.max),
					{ type: 'intersection', a, b },
					depth,
				);
			}
		}
	}

	// Collect every proof of every cell, then per cell rank them and keep
	// the simplest as primary with the rest as alternatives.
	const proofsByCell = new Map<string, Constraint[]>();
	for (const constraint of bySet.values()) {
		if (!constraint.isAllMines && !constraint.isAllSafe) continue;
		for (const cell of constraint.cells) {
			let proofs = proofsByCell.get(cell);
			if (!proofs) proofsByCell.set(cell, (proofs = []));
			proofs.push(constraint);
		}
	}

	const inferences: Inference[] = [];
	for (const [cell, proofs] of proofsByCell) {
		proofs.sort(proofOrder);
		const primary = proofs[0];
		const type = primary.isAllMines ? 'flag' : 'reveal';

		// Keep alternatives that agree with the conclusion and cover a
		// different cell set (a genuinely different way to see it).
		const seenSets = new Set([primary.setKey]);
		const alternatives: Constraint[] = [];
		for (const proof of proofs.slice(1)) {
			const agrees =
				type === 'flag' ? proof.isAllMines : proof.isAllSafe;
			if (!agrees || seenSets.has(proof.setKey)) continue;
			seenSets.add(proof.setKey);
			alternatives.push(proof);
			if (alternatives.length >= MAX_ALTERNATIVES) break;
		}

		inferences.push({
			type,
			cell: Index2D.fromKey(cell),
			constraint: primary,
			alternatives,
		});
	}

	inferences.sort(
		(a, b) =>
			proofOrder(a.constraint, b.constraint) ||
			a.type.localeCompare(b.type),
	);

	return {
		constraints: [...bySet.values()],
		inferences,
		contradictions,
	};
}
