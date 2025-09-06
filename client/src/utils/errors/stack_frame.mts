import SourceLocation from "./source_location.mjs";

interface IErrorMapping {
	name: string,
	source: string,
	line: number,
	column: number
}

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

		// Send a resolve request for this mapping
		let resolvePayload = {
			file: this.originalLocation.file,
			line: this.originalLocation.lineNo,
			column: this.originalLocation.columnNo
		};

		let fRes: Response = await fetch('/err/solve', {
			method: 'POST',
			body: JSON.stringify(resolvePayload)
		}).catch(() => null);

		// If the fetch failed or the source map wasn't found, mark this path
		// as having no mapping.
		if (!fRes || fRes.status != 200) {
			this.noMapping = true;
			return;
		}

		// Check if mapping was found
		let mapping = await fRes.json() as IErrorMapping;
		if (!mapping) {
			this.noMapping = true;
			return;
		}
		
		// Save mapped location
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
