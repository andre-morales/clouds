export function equals(a: any[], b: any[]): boolean {
	if (a === b) return true;
	if (a.length !== b.length) return false;

	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}

	return true;
}

export function erase<T>(arr: T[], element: T): number {
	let i = arr.indexOf(element);
	if (i >= 0) {
		arr.splice(i, 1);
	}
	return i;
}

export default { equals, erase };