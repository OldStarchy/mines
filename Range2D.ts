import Index2D from './Index2D';
import { Size2D } from './Size2D';

export interface Range2DLike extends Index2D, Size2D {}
export default class Range2D implements Range2DLike {
	get x() {
		return this.start.x;
	}
	get y() {
		return this.start.y;
	}
	get width() {
		return this.size.width;
	}
	get height() {
		return this.size.height;
	}

	private constructor(
		readonly start: Index2D,
		readonly size: Size2D,
	) {}

	static around(index: Index2D) {
		return new Range2D(
			{
				x: index.x - 1,
				y: index.y - 1,
			},
			{
				width: 3,
				height: 3,
			},
		);
	}

	forEach(cb: (index: Index2D) => void): void {
		for (let y = 0; y < this.height; y++)
			for (let x = 0; x < this.width; x++)
				cb({ x: this.x + x, y: this.y + y });
	}
}
