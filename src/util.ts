export function join(a: string[]): string {
	if (a.length === 0) {
		return '';
	} else if (a.length === 1) {
		return a[0];
	} else {
		const last = a.pop();
		return `${a.join(', ')} and ${last}`;
	}
}

/** Checks for missing or useless parameters in an object */
export function checkParams<T, R extends string, O extends string>(
	params: { [k: string]: T },
	requiredParams: readonly R[],
	optionalParams: readonly O[],
	what: (plural: boolean) => string,
	extra?: string
): asserts params is { [k in R]: T } & { [k in O]?: T } {
	const missing = requiredParams.filter(p => !(p in params));
	const useless = Object.keys(params).filter(p => !requiredParams.includes(p as R) && !optionalParams.includes(p as O));

	if (missing.length) {
		throw new Error(
			`Missing required ${what(missing.length !== 1)} ${join(missing.map(p => `"${p}"`))}${extra ? ` ${extra}` : ''}`
		);
	} else if (useless.length) {
		throw new Error(
			`Useless ${what(useless.length !== 1)} ${join(useless.map(p => `"${p}"`))}${extra ? ` ${extra}` : ''}`
		);
	}
}

export function checkUint8(n: number, name: string): number {
	if (isNaN(n)) {
		throw new Error(`${name} is not a number`);
	}
	if (n % 1) {
		throw new Error(`${name} is not an integer`);
	}
	if (n < 0 || n > 255) {
		throw new Error(`${name} is out of range`);
	}
	return n;
}

/** Round up to the next multiple of 3 */
export function ceil3(x: number): number {
	return x + 2 - ((x + 2) % 3);
}

export function parseIntIf(s: string): number;
export function parseIntIf(s: undefined): undefined;
export function parseIntIf(s: string | undefined): number | undefined;
export function parseIntIf(s: string | undefined): number | undefined {
	return s === undefined ? undefined : parseInt(s);
}

export function objMap<T, R>(
	obj: { [k: string]: T },
	cb: (value: T, obj: { [k: string]: T }) => R
): { [k: string]: R } {
	const ret: { [k: string]: R } = {};

	for (const k in obj) {
		ret[k] = cb(obj[k], obj);
	}

	return ret;
}
