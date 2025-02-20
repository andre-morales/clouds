export function endsWithAny(str: string, arr: string[]): boolean {
	for (let end of arr) {
		if (str.endsWith(end)) return true;
	}
	return false;
}

/**
 * Splits a string starting from its end into subsections as determined by the separator.
 * @param limit If specified, the array returned will contain at most this amount of elements.
 * If the limit is smaller than it would take to store all splits, the rest of the string is left
 * as is.
 */
export function splitFromEnd(text: string, sep: string, limit?: number): string[] {
	let array = [];
	if (limit <= 0)
		return array;

	if (limit === undefined)
		limit = Number.MAX_SAFE_INTEGER;

	let end = text.length;
	for (let i = 0; i < limit - 1; i++) {
		// If string is over
		if (end <= 0) break;

		// Get section from the separator we found to the current end, if there are no
		// more separators, stop.
		let idx = text.lastIndexOf(sep, end - 1);
		if (idx == -1) break;
		
		// Add section from the separator we found to the current end
		array.push(text.substring(idx + 1, end));
		end = idx;
	}	

	// Add the rest of the string
	array.push(text.substring(0, end));

	return array.reverse();
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

export function escapeHTML(text: string): string {
	return text.replace(/[<>]/g, match => ({
		'<': '&lt;',
		'>': '&gt;'
	}[match]));
}

export default { endsWithAny, fromDataSize: byteSize, escapeHTML, splitFromEnd };