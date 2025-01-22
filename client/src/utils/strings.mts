export function endsWithAny(str: string, arr: string[]): boolean {
	for (let end of arr) {
		if (str.endsWith(end)) return true;
	}
	return false;
}

export function byteSize(n: number): string {
	return withUnits(['B', 'KiB', 'MiB', 'GiB'], 1024, 1024, 2)(n);
}

export function bitsSize(n: number): string {
	return withUnits(['b', 'kb', 'Mb', 'Gb'], 1000, 1000, 2)(n);
}

export function withUnits(units: string[], threshold: number, divider: number, decimals: number): (x: number) => string {
	return (n: number): string => {
		let u = 0;
		for(; u < units.length; u++) {
			if (n <= threshold) break;	
	
			n /= divider;
		}
		
		return n.toFixed((u == 0) ? 0 : decimals) + ' ' + units[u];
	}
}

export default { endsWithAny, fromDataSize: byteSize };