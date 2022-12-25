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
