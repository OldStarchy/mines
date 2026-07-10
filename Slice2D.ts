export interface Slice2D<T> {
	forEach(cb: (value: T, index: { x: number; y: number }) => void): void;
	toArray(): T[];
}
