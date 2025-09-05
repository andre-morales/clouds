import { SourceMapConsumer } from "source-map";
import { FetchCache } from "../fetch_cache.mjs";
import SourceLocation from "./source_location.mjs";
import Browser from "../browser.mjs";

var cachedSourceMaps: Map<string, Promise<string | null>> = new Map();
var fetchCache = new FetchCache();

export class StackFrame {
	private readonly originalLocation: SourceLocation;
	private mappedLocation: SourceLocation;
	private noMapping: boolean;

	public constructor(location: SourceLocation) {
		this.originalLocation = location;
	}

	/**
	 * @returns A source-mapped location for this entry if its available, or the original one in its
	 * place if not.
	 */
	public getLocation() {
		const og = this.originalLocation;
		const mp = this.mappedLocation;

		// If no mapping is available whatsoever, use the original location
		if (!mp) return og;
		
		// If the mapping is complete, use it
		if (mp.functionName) return mp;

		// Mix the two mappings to get most information out
		return new SourceLocation(og.description, og.functionName, mp.file, mp.lineNo, mp.columnNo);
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
		if (this.noMapping) return null;

		// Can't map locations without a valid line number
		if (!(this.originalLocation.lineNo >= 1)) {
			this.noMapping = true;
			return;
		}

		if (!await enableSourceMaps()) {
			this.noMapping = true;
			return;
		}

		let source = await getSourceMapOf(this.originalLocation.file);
		if (!source) {
			this.noMapping = true;
			return;
		}

		let cons = await new sourceMap.SourceMapConsumer(source) as SourceMapConsumer;
		let mapping = cons.originalPositionFor({
			line: this.originalLocation.lineNo,
			column: this.originalLocation.columnNo
		});

		this.mappedLocation = new SourceLocation(
			this.originalLocation.description,
			mapping.name,
			mapping.source,
			mapping.line,
			mapping.column
		);
	}

	toString() {
		return this.getLocation();
	}
}

var whenSourceMapsAvailable: Promise<boolean>;
async function enableSourceMaps() {
	if (whenSourceMapsAvailable) 
		return whenSourceMapsAvailable;

	whenSourceMapsAvailable = (async () => {
		// This library depends on web assembly.
		if (!window.WebAssembly) return false;

		await Browser.addScript('/res/lib/source-map/source-map.js');

		if (!window.sourceMap) return false;

		window.sourceMap.SourceMapConsumer.initialize({
			"lib/mappings.wasm": "https://unpkg.com/source-map@0.7.3/lib/mappings.wasm"
		});
		return true;
	})();
	
	return whenSourceMapsAvailable;
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
		console.error(err);
		return null;
	}
}