type Index2D = { readonly x: number; readonly y: number };
const Index2D = {
	equals(a: Index2D, b: Index2D) {
		return a.x === b.x && a.y === b.y;
	},
	predicate: {
		equals(a: Index2D): (b: Index2D) => boolean {
			return (b: Index2D) => Index2D.equals(a, b);
		},

		notEquals(a: Index2D): (b: Index2D) => boolean {
			return (b: Index2D) => !Index2D.equals(a, b);
		},
	},
	add(a: Index2D, b: Index2D) {
		return { x: a.x + b.x, y: a.y + b.y };
	},
	addXy(a: Index2D, x: number, y: number) {
		return Index2D.add(a, { x, y });
	},
	key({ x, y }: Index2D): string {
		return `${x},${y}`;
	},
	fromKey(key: string): Index2D {
		const [x, y] = key.split(',').map(Number);
		return { x, y };
	},
} as const;

export default Index2D;
