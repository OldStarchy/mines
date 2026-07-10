import Index2D from './Index2D';
import type { Range2DLike } from './Range2D';
import type { Size2D } from './Size2D';
import type { Slice2D } from './Slice2D';

export default class Array2D<T> {
	get width() {
		return this.size.width;
	}
	get height() {
		return this.size.height;
	}

	constructor(
		readonly size: Size2D,
		private readonly data: T[],
	) {}

	with(index: Index2D, value: T) {
		return new Array2D<T>(
			this.size,
			this.data.with(this.toIndex(index), value),
		);
	}

	toArray(): T[] {
		return this.data.slice();
	}

	static fromData<T>(size: Size2D, data: T[]) {
		if (data.length !== size.width * size.height)
			throw Error('Invalid array size');

		return new Array2D<T>(size, data);
	}

	static from<T>(size: Size2D, init: (index: Index2D) => T): Array2D<T> {
		return new Array2D<T>(
			size,
			Array.from({ length: size.width * size.height }, (_, index) =>
				init(Array2D.toXy(size, index)),
			),
		);
	}

	private wrapXy({ x, y }: Index2D): Index2D {
		x = x % this.width;
		if (x < 0) x += this.width;

		y = y % this.height;
		if (y < 0) y += this.height;

		return { x, y };
	}

	/**
	 * @safety 0 <= index < this.width * this.height
	 */
	private toXy(index: number): Index2D {
		return Array2D.toXy(this.size, index);
	}

	public static toXy(size: Size2D, index: number): Index2D {
		const x = index % size.width;
		const y = Math.floor(index / size.width);

		return { x, y };
	}

	private toIndex(index: Index2D): number {
		return Array2D.toIndex(this.size, index);
	}
	public static toIndex(size: Size2D, { x, y }: Index2D): number {
		return x + y * size.width;
	}

	at(index: Index2D) {
		const index1d = this.toIndex(this.wrapXy(index));

		return this.data[index1d];
	}

	atOrNull(index: Index2D) {
		if (
			index.x < 0 ||
			index.y < 0 ||
			index.x >= this.width ||
			index.y >= this.height
		)
			return null;
		const index1d = this.toIndex(index);

		return this.data[index1d];
	}

	slice(range: Range2DLike): Slice2D<T> {
		let { x = 0, y = 0, width, height } = range;

		if (x < 0) {
			width += x;
			x = 0;
		}
		if (y < 0) {
			height += y;
			y = 0;
		}
		if (x + width > this.width) width = this.width - x;
		if (y + height > this.height) height = this.height - y;

		return new Array2D.Slice(this, x, y, width, height);
	}

	rows(): T[][] {
		return Array.from({ length: this.height }, (_, y) =>
			this.data.slice(y * this.width, (y + 1) * this.width),
		);
	}

	set(index: Index2D, value: T) {
		const index1d = this.toIndex(this.wrapXy(index));
		this.data[index1d] = value;
	}

	map<U>(
		mapper: (value: T, index: { x: number; y: number }) => U,
	): Array2D<U> {
		return new Array2D<U>(
			this.size,
			this.data.map((value, index) => {
				const { x, y } = this.toXy(index);
				return mapper(value, { x, y });
			}),
		);
	}
	private static Slice = class<T> implements Slice2D<T> {
		constructor(
			private owner: Array2D<T>,
			private x: number,
			private y: number,
			private width: number,
			private height: number,
		) {}

		forEach(cb: (value: T, index: { x: number; y: number }) => void): void {
			let index = this.y * this.owner.width + this.x;
			let x = 0;
			let y = 0;

			while (y < this.height) {
				while (x < this.width) {
					cb(this.owner.data[index], {
						x: x + this.x,
						y: y + this.y,
					});

					x += 1;
					index += 1;
				}

				x = 0;
				y += 1;

				index -= this.width;
				index += this.owner.width;
			}
		}

		toArray(): T[] {
			const result = new Array<T>();
			this.forEach((value) => result.push(value));
			return result;
		}
	};
}
