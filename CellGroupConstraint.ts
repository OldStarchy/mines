import Action from './Action';
import Cell from './Cell';
import dump from './dump';

export default class CellGroupConstraint {
	constructor(
		readonly cell: Cell | undefined,
		readonly cells: Cell[],
		readonly min: number,
		readonly max: number,
	) {
		if (cells.length > 8)
			throw new Error(`Invalid group constraint size ${cells.length}`);
	}

	public containsAll(cells: Cell[]) {}

	public inferActions(): Action[] {
		const flagged = this.cells.filter((c) => c.state.type === 'flagged');
		const hidden = this.cells.filter((c) => c.state.type === 'hidden');

		const actions: Action[] = [];

		if (flagged.length === this.max) {
			actions.push(...hidden.map(Action.reveal));
		}

		if (hidden.length === this.min) {
			actions.push(...hidden.map(Action.flag));
		}

		// console.log({
		// 	min: this.min,
		// 	max: this.max,
		// 	hidden: hidden.length,
		// 	flagged: flagged.length,
		// });

		return actions;
	}

	[dump.impl]() {
		return `{${this.cell ? `${this.cell.x}, ${this.cell.y}` : 'null'}}, [${this.cells.map(({ x, y }) => `{${x}, ${y}}`).join(', ')}, ${this.min}, ${this.max}]`;
	}
}
