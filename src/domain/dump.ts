const dumpName = Symbol('dump.impl');
function dump(obj: unknown) {
	if (obj === null) return 'null';
	if (obj === undefined) return 'undefined';

	if (typeof obj === 'object') {
		if ((obj as any)[dumpName] instanceof Function)
			return ((obj as any)[dumpName] as Function)() as string;
	}

	return JSON.stringify(obj);
}

dump.impl = dumpName;

export default dump as unknown as {
	readonly impl: unique symbol;
	(obj: unknown): string;
};
