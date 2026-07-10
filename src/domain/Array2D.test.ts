import { describe, expect, test, vitest } from 'vitest';
import Array2D from './Array2D';
import Index2D from './Index2D';

describe('Array2d', () => {
	describe('static from', () => {
		test('initializes inner data with given callback', () => {
			const arr = Array2D.from({ width: 2, height: 2 }, (index) => index);

			expect(arr.toArray()).toEqual([
				{ x: 0, y: 0 },
				{ x: 1, y: 0 },
				{ x: 0, y: 1 },
				{ x: 1, y: 1 },
			]);
		});
	});

	describe('Array2dSlice', () => {
		describe('slice', () => {
			test('contains the correct cells (parital slice)', () => {
				const arr = Array2D.from(
					{ width: 2, height: 2 },
					(index) => index,
				);

				const slice = arr
					.slice({ x: 0, y: 0, width: 1, height: 1 })
					.toArray();

				expect(slice).toEqual([{ x: 0, y: 0 }]);
			});

			test('contains the correct cells (full slice)', () => {
				const arr = Array2D.from(
					{ width: 2, height: 2 },
					(index) => index,
				);

				const slice = arr.slice({ x: 0, y: 0, ...arr.size }).toArray();

				expect(slice).toEqual([
					{ x: 0, y: 0 },
					{ x: 1, y: 0 },
					{ x: 0, y: 1 },
					{ x: 1, y: 1 },
				]);
			});

			test('contains the correct cells (overlapping x=0 edge)', () => {
				const arr = Array2D.from(
					{ width: 2, height: 2 },
					(index) => index,
				);

				const slice = arr.slice({ x: -1, y: 0, ...arr.size }).toArray();

				expect(slice).toEqual([
					{ x: 0, y: 0 },
					{ x: 0, y: 1 },
				]);
			});

			test('contains the correct cells (overlapping x=width edge)', () => {
				const arr = Array2D.from(
					{ width: 2, height: 2 },
					(index) => index,
				);

				const slice = arr.slice({ x: 1, y: 0, ...arr.size }).toArray();

				expect(slice).toEqual([
					{ x: 1, y: 0 },
					{ x: 1, y: 1 },
				]);
			});
		});

		describe('forEach', () => {
			test('invokes for each cell', () => {
				const arr = Array2D.from(
					{ width: 2, height: 2 },
					(index) => index,
				);

				const slice = arr.slice({ x: 0, y: 0, ...arr.size });

				const fn = vitest.fn((_: Index2D) => {});

				slice.forEach((value) => {
					fn(value);
				});

				expect(fn).toHaveBeenCalledTimes(4);
				expect(fn).toHaveBeenNthCalledWith(1, { x: 0, y: 0 });
				expect(fn).toHaveBeenNthCalledWith(2, { x: 1, y: 0 });
				expect(fn).toHaveBeenNthCalledWith(3, { x: 0, y: 1 });
				expect(fn).toHaveBeenNthCalledWith(4, { x: 1, y: 1 });
			});
		});
	});

	describe('Index2d', () => {
		describe('predicate', () => {
			test('equates only equal indicies', () => {
				const arr = Array2D.from(
					{ width: 2, height: 2 },
					(index) => index,
				);

				const cells = arr
					.toArray()
					.filter(Index2D.predicate.equals({ x: 1, y: 1 }));

				expect(cells).toEqual([{ x: 1, y: 1 }]);
			});
		});
	});
});
