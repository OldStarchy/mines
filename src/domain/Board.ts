import Action from './Action';
import Array2D from './Array2D';
import Cell from './Cell';
import CellState, { type BombCount } from './CellState';
import Index2D from './Index2D';
import Range2D from './Range2D';
import type { Size2D } from './Size2D';

/** 1D indices of the up-to-8 in-bounds neighbors of a 1D index. */
function neighborsOf(size: Size2D, index: number): number[] {
	const { x, y } = Array2D.toXy(size, index);
	const result: number[] = [];
	for (let dy = -1; dy <= 1; dy++)
		for (let dx = -1; dx <= 1; dx++) {
			if (dx === 0 && dy === 0) continue;
			const next = { x: x + dx, y: y + dy };
			if (next.x < 0 || next.x >= size.width) continue;
			if (next.y < 0 || next.y >= size.height) continue;
			result.push(Array2D.toIndex(size, next));
		}
	return result;
}

/** The safe cells reachable from origin, moving in all 8 directions. */
function reachableSafe(
	cells: Cell[],
	size: Size2D,
	origin: number,
): Set<number> {
	const seen = new Set([origin]);
	const queue = [origin];
	while (queue.length > 0) {
		for (const next of neighborsOf(size, queue.pop()!)) {
			if (seen.has(next) || cells[next].isBomb) continue;
			seen.add(next);
			queue.push(next);
		}
	}
	return seen;
}

const sample = <T>(values: T[]): T =>
	values[Math.floor(Math.random() * values.length)];

/**
 * Reworks a random placement so every safe cell is reachable from the
 * opening without crossing a mine (diagonals count): a walled-off
 * pocket could only be finished by guessing. While a pocket remains,
 * a mine on the reachable region's rim trades places with a pocket
 * cell — the region grows, the pockets shrink, the mine count stays.
 */
function connectSafeCells(cells: Cell[], size: Size2D, origin: Index2D): void {
	const originIndex = Array2D.toIndex(size, origin);
	for (;;) {
		const reachable = reachableSafe(cells, size, originIndex);
		const pockets: number[] = [];
		for (let i = 0; i < cells.length; i++)
			if (!cells[i].isBomb && !reachable.has(i)) pockets.push(i);
		if (pockets.length === 0) return;

		const rim = new Set<number>();
		for (const index of reachable)
			for (const next of neighborsOf(size, index))
				if (cells[next].isBomb) rim.add(next);

		const mine = sample([...rim]);
		const pocket = sample(pockets);
		cells[mine] = cells[mine].with({ isBomb: false });
		cells[pocket] = cells[pocket].with({ isBomb: true });
	}
}

export default class Board {
	private constructor(readonly cells: Array2D<Cell>) {}

	static fromStringNotation(str: string[]) {
		const height = str.length;
		if (height === 0) throw 'Invalid string notation (0 height)';
		const width = str[0].length;
		if (width === 0) throw 'Invalid string notation (0 width)';

		var data = Array2D.fromData(
			{ width, height },
			str
				.flatMap((s) => s.split(''))
				.map((ch, i) => {
					const { x, y } = Array2D.toXy({ width, height }, i);
					//prettier-ignore
					switch (ch) {
							case '*': return new Cell(x, y, CellState.revealed(0), true);
							case ' ': return new Cell(x, y, CellState.revealed(0), false);
							case '!': return new Cell(x, y, CellState.hidden, true);
							case '_': return new Cell(x, y, CellState.hidden, false);
							case 'F': return new Cell(x, y, CellState.flagged, true);
							case 'f': return new Cell(x, y, CellState.flagged, false);
						}

					throw 'Invalid string notation';
				}),
		);

		return new Board(
			data.map((cell, index) => {
				if (cell.state.type !== 'revealed') return cell;

				const bombs = data
					.slice(Range2D.around(index))
					.toArray()
					.filter(Index2D.predicate.notEquals(cell))
					.filter((c) => c.isBomb).length;

				return cell.with({
					state: CellState.revealed(bombs as BombCount),
				});
			}),
		);
	}

	static ofSize(width: number, height: number): Board {
		return new Board(
			Array2D.from({ width, height }, ({ x, y }) => {
				return new Cell(x, y, CellState.hidden, false);
			}),
		);
	}

	/**
	 * A fresh, fully hidden board with bombs at the given cell keys
	 * (see Index2D.key). Deterministic — used to replay a recorded game
	 * from its fixed mine layout.
	 */
	static create(size: Size2D, mineKeys: Iterable<string>): Board {
		const mines = new Set(mineKeys);
		return new Board(
			Array2D.from(size, ({ x, y }) => {
				return new Cell(
					x,
					y,
					CellState.hidden,
					mines.has(Index2D.key({ x, y })),
				);
			}),
		);
	}

	/** Bomb positions as cell keys (see Index2D.key). */
	mineKeys(): string[] {
		return this.cells
			.toArray()
			.filter((c) => c.isBomb)
			.map(Index2D.key);
	}

	applyAction(action: Action) {
		let cells = this.cells.map((cell) => cell.with());

		const queue = [action];

		while (queue.length > 0) {
			const action = queue.shift()!;

			switch (action.type) {
				case 'reveal': {
					const { index } = action;
					const cell = cells.at(index);

					if (cell.state.type !== 'hidden') continue;

					const neighborRange = Range2D.around(index);
					const neighborhood = cells
						.slice(neighborRange)
						.toArray()
						.filter((c) => c !== cell);

					const bombs = neighborhood.filter((c) => c.isBomb)
						.length as BombCount;
					if (bombs > 8) throw new Error('Too many bombs');

					if (bombs === 0 && !cell.isBomb) {
						queue.unshift(...neighborhood.map(Action.reveal));
					}

					cells = cells.with(
						index,
						cell.with({ state: CellState.revealed(bombs) }),
					);
					break;
				}

				case 'flag': {
					const { index } = action;
					const cell = cells.at(index);

					if (cell.state.type !== 'hidden') continue;

					cells = cells.with(
						index,
						cell.with({ state: CellState.flagged }),
					);
					break;
				}

				case 'unflag': {
					const { index } = action;
					const cell = cells.at(index);

					if (cell.state.type !== 'flagged') continue;

					cells = cells.with(
						index,
						cell.with({ state: CellState.hidden }),
					);
					break;
				}

				case 'chord': {
					const { index } = action;
					const cell = cells.at(index);
					if (cell.state.type !== 'revealed') continue;

					const neighborhood = cells
						.slice(Range2D.around(index))
						.toArray()
						.filter((c) => c !== cell);

					const flags = neighborhood.filter(
						(c) => c.state.type === 'flagged',
					).length;
					const hidden = neighborhood.filter(
						(c) => c.state.type === 'hidden',
					);

					// A satisfied number reveals its hidden neighbors; a
					// number whose hidden neighbors are exactly its missing
					// mines flags them all instead.
					if (flags === cell.state.number) {
						queue.unshift(...hidden.map(Action.reveal));
					} else if (flags + hidden.length === cell.state.number) {
						queue.unshift(...hidden.map(Action.flag));
					}
					break;
				}

				case 'placeBombsAndReveal':
					const candidates = new Set(
						Array.from(
							{ length: this.cells.width * this.cells.height },
							(_, i) => i,
						),
					);

					// Protect the opening; only in-bounds neighbors, or an
					// edge click would map phantom coordinates onto real
					// cells across the board.
					candidates.delete(
						Array2D.toIndex(this.cells.size, action.index),
					);
					for (const neighbor of neighborsOf(
						this.cells.size,
						Array2D.toIndex(this.cells.size, action.index),
					)) {
						candidates.delete(neighbor);
					}

					let count = 0;
					const cellsArr = cells.toArray();

					while (candidates.size > 0 && count < action.bombCount) {
						count++;
						const nextIndex = Math.floor(
							Math.random() * candidates.size,
						);

						const next = [...candidates.values()][nextIndex];
						candidates.delete(next);

						cellsArr[next] = cellsArr[next].with({ isBomb: true });
					}

					connectSafeCells(cellsArr, cells.size, action.index);
					cells = Array2D.fromData(cells.size, cellsArr);

					queue.push(Action.reveal(action.index));
					break;
				default:
					action satisfies never;
			}
		}

		return new Board(cells);
	}

	renderToString({
		size,
		overlay = [],
	}: {
		size: 1 | 3;
		overlay?: [Index2D, string][];
	}): string {
		return this.cells
			.rows()
			.flatMap((row) => {
				const lines = row.map((cell) => {
					const ol = overlay.find(([index]) =>
						Index2D.equals(index, cell),
					)?.[1];

					if (size === 1)
						return cell.renderToString({
							overlay: ol,
							size,
						});
					if (size === 3)
						return cell.renderToString({
							overlay: ol,
							size,
							cells: this.cells,
						});

					throw 'err';
				});

				return lines
					.reduce(
						(newLines, cellLines) =>
							cellLines.map((c, i) => [
								...(newLines[i] ?? []),
								c,
							]),
						[] as string[][],
					)
					.map((l) => l.join(' '));
			})
			.join('\n');
	}

	get bombCount(): number {
		return this.cells.toArray().filter((c) => c.isBomb).length;
	}

	get flagCount(): number {
		return this.cells.toArray().filter((c) => c.state.type === 'flagged')
			.length;
	}

	/** A bomb has been revealed. */
	get isLost(): boolean {
		return this.cells
			.toArray()
			.some((c) => c.isBomb && c.state.type === 'revealed');
	}

	/** Every non-bomb cell has been revealed (and no bomb has). */
	get isWon(): boolean {
		return (
			!this.isLost &&
			this.cells
				.toArray()
				.every((c) => c.isBomb || c.state.type === 'revealed')
		);
	}
}
