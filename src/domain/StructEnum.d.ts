export type StructEnum<T extends Record<string, {} | (() => {})>> = {
	[K in keyof T]: T[K] extends (...args: any[]) => infer R ? R : T[K];
}[keyof T];
