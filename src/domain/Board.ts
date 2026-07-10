import Action from './Action';
import Array2D from './Array2D';
import Cell from './Cell';
import CellGroupConstraint from './CellGroupConstraint';
import CellState, { BombCount } from './CellState';
import Index2D from './Index2D';
import Range2D from './Range2D';

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

	createNeighborCountConstraint(index: Index2D): CellGroupConstraint | null {
		const cell = this.cells.at(index);
		if (cell.state.type == 'hidden') return null;
		if (cell.state.type == 'flagged') return null;

		const neighborRange = Range2D.around(index);
		const cells = this.cells
			.slice(neighborRange)
			.toArray()
			.filter((c) => c !== cell);

		const flags = cells.filter((c) => c.state.type === 'flagged').length;

		return new CellGroupConstraint(
			this.cells.at(index),
			cells,
			cell.state.number - flags,
			cell.state.number - flags,
		);
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

					if (bombs === 0) {
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

				case 'placeBombsAndReveal':
					const candidates = new Set(
						Array.from(
							{ length: this.cells.width * this.cells.height },
							(_, i) => i,
						),
					);

					Range2D.around(action.index).forEach((index) => {
						candidates.delete(
							Array2D.toIndex(this.cells.size, index),
						);
					});

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

					cells = Array2D.fromData(cells.size, cellsArr);

					queue.push(Action.reveal(action.index));
					break;
				default:
					const _exhaustiveCheck: never = action;
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

	generateConstraints(): CellGroupConstraint[] {
		return this.cells
			.map((_, index) => this.createNeighborCountConstraint(index))
			.toArray()
			.filter((v) => v !== null);
	}
}
