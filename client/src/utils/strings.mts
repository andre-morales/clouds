export function endsWithAny(str: string, arr: string[]): boolean {
	for (let end of arr) {
		if (str.endsWith(end)) return true;
	}
	return false;
}

export function fromDataSize(n: number) {
	const units = ['B', 'KiB', 'MiB', 'GiB'];

	let unit: string;
	for(let u of units) {
		unit = u;
		if (n <= 1024) break;	

		n /= 1024;
	}

	return n.toFixed((unit == 'B') ? 0 : 2) + ' ' + unit;
}

export default { endsWithAny, fromDataSize };