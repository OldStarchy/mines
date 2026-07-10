import Array2D from './Array2D';
import CellState from './CellState';
import Index2D from './Index2D';

export default class Cell {
	constructor(
		readonly x: number,
		readonly y: number,
		readonly state: CellState,
		readonly isBomb: boolean | null,
	) {}

	with({ state, isBomb }: { state?: CellState; isBomb?: boolean } = {}) {
		return new Cell(
			this.x,
			this.y,
			state !== undefined ? state : this.state,
			isBomb !== undefined ? isBomb : this.isBomb,
		);
	}

	/**
	 * Returns an array of lines representing this cell that can be used to
	 * print the board to console
	 */
	renderToString(
		options:
			| { size: 1; overlay?: string }
			| {
					size: 3;
					cells: Array2D<Cell>;
					overlay?: string;
			  },
	): string[] {
		switch (options.size) {
			case 1:
				if (options.overlay !== undefined) return [options.overlay];
				switch (this.state.type) {
					case 'hidden':
						return ['■'];
					case 'flagged':
						return ['F'];
					case 'revealed': {
						if (this.isBomb) return ['*'];
						if (this.state.number === 0) return [' '];
						return [this.state.number.toFixed(0)];
					}
					default: {
						this.state satisfies never;
						throw null;
					}
				}

			case 3:
				const chr = this.renderToString({ ...options, size: 1 })[0]!;
				const mines =
					this.state.type !== 'revealed'
						? '         '.split('')
						: (
								[
									[-1, -1, '\\'],
									[0, -1, '|'],
									[1, -1, '/'],
									[-1, 0, '-'],
									[0, 0, ' '],
									[1, 0, '-'],
									[-1, 1, '/'],
									[0, 1, '|'],
									[1, 1, '\\'],
								] as const
							).map(
								([x, y, ch]) =>
									(options.cells.atOrNull(
										Index2D.addXy(this, x, y),
									)?.isBomb
										? ch
										: ' ') as string,
							);
				mines[4] = chr;
				const minesStr = mines.join('');

				return [
					minesStr.slice(0, 3),
					minesStr.slice(3, 6),
					minesStr.slice(6, 9),
				];

			default: {
				options satisfies never;
				throw null;
			}
		}
	}
}
