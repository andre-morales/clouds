import { SourceMapConsumer } from "source-map";
import { FetchCache } from "../fetch_cache.mjs";

var cachedSourceMaps: Map<string, Promise<string | null>> = new Map();
var fetchCache = new FetchCache();

export default class ErrorStack {
	public readonly error: Error;
	public stackEntries: StackEntry[];

	constructor(err: Error) {
		this.error = err;
		this.stackEntries = [];
	
		if (!err.stack) {
			return;
		}

		let lines = err.stack.split('\n');
		for (let entry of lines) {
			if (entry.length == 0) break;

			let [fn, ref] = entry.split('@');

			let ind = ref.lastIndexOf(':');
			let column = ref.substring(ind + 1);

			let indx2 = ref.lastIndexOf(':', ind - 1)
			let line = ref.substring(indx2 + 1, ind);

			let file = ref.substring(0, indx2);

			let loc = new SourceLocation(fn, file, Number(line), Number(column));
			let stackEntry = new StackEntry(loc);
			this.stackEntries.push(stackEntry);
		}
	}

	async mapAll() {
		await Promise.all(this.stackEntries.map(async (entry) => {
			await entry.map();
		}));
	}

	toString() {
		let result = '';
		for (let entry of this.stackEntries) {
			result += entry.toString() + '\n';
		}
		return result;
	}
}

class StackEntry {
	private readonly originalLocation: SourceLocation;
	private mappedLocation: SourceLocation;
	private noSource: boolean;

	constructor(location: SourceLocation) {
		this.originalLocation = location;
	}

	/**
	 * @returns A source-mapped location for this entry if its available, or the original one in its
	 * place if not.
	 */
	public getLocation() {
		if (this.mappedLocation) return this.mappedLocation;
		return this.originalLocation;
	}

	/**
	 * @returns The original location of this entry.
	 */
	public getOriginalLocation() {
		return this.originalLocation;
	}

	/**
	 * @returns The source-mapped location of this entry. If it is not available, returns null.
	 */
	public getMappedLocation() {
		return this.mappedLocation;
	}

	public async map(): Promise<void> {
		if (this.noSource) return null;

		let source = await getSourceMapOf(this.originalLocation.file);
		if (!source) {
			this.noSource = true;
			return;
		}

		let cons = await new sourceMap.SourceMapConsumer(source) as SourceMapConsumer;
		let mapping = cons.originalPositionFor({
			line: this.originalLocation.lineNo,
			column: this.originalLocation.columnNo
		});

		this.mappedLocation = new SourceLocation(mapping.name, mapping.source, mapping.line, mapping.column);
	}

	toString() {
		return this.getLocation();
		//return this.getOriginalLocation().toString() + " -- " + this.getMappedLocation();
	}
}

class SourceLocation {
	public readonly fnName: string;
	public readonly file: string;
	public readonly lineNo: number;
	public readonly columnNo: number;

	constructor(fnName: string, file: string, lineNo: number, columnNo: number) {
		this.fnName = fnName;
		this.file = file;
		this.lineNo = lineNo;
		this.columnNo = columnNo;
	}

	toString() {
		return `${this.fnName}@${this.file}:${this.lineNo}:${this.columnNo}`
	}
}

/**
 * Returns a source map for the given source code URL. This will cache the source map.
 */
async function getSourceMapOf(file: string): Promise<string | null> {
	let cached = cachedSourceMaps.get(file);
	if (cached) return cached;

	// We've never tried fetching this source map, do it. 
	let promise = fetchSourceMap(file);
	cachedSourceMaps.set(file, promise);
	return promise;
}

async function fetchSourceMap(file: string): Promise<string | null> {
	try {
		// Get the source code
		let sourceCodeUrl = new URL(file);
		let sourceCode = await fetchCache.fetch(sourceCodeUrl).then(res => res.text());
		
		// Try to find source map URL
		let matches = sourceCode.match(/\/\/# sourceMappingURL=(.*)/);
		if (!matches[1]) return null;
		let sourceMapURL = new URL(matches[1], sourceCodeUrl);
	
		// Get the content for the source map
		let sourceMap = await fetchCache.fetch(sourceMapURL).then(res => res.text());
		return sourceMap;
	} catch(err) {
		return null;
	}
}