import type { StructEnum } from './StructEnum';

export type BombCount = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const CellState = {
	hidden: { type: 'hidden' },
	flagged: { type: 'flagged' },
	revealed<N extends BombCount>(number: N) {
		return { type: 'revealed', number } as const;
	},
} as const;
type CellState = StructEnum<typeof CellState>;

export default CellState;
