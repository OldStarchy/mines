import Index2D from './Index2D';
import type { StructEnum } from './StructEnum';

const Action = {
	reveal({ x, y }: Index2D) {
		return { type: 'reveal', index: { x, y } } as const;
	},
	placeBombsAndReveal({ x, y }: Index2D, bombCount: number) {
		return {
			type: 'placeBombsAndReveal',
			index: { x, y },
			bombCount,
		} as const;
	},
	flag({ x, y }: Index2D) {
		return { type: 'flag', index: { x, y } } as const;
	},
	unflag({ x, y }: Index2D) {
		return { type: 'unflag', index: { x, y } } as const;
	},
} as const;
type Action = StructEnum<typeof Action>;

export default Action;
