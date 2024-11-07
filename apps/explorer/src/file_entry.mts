import { RawFileEntry } from "/@sys/bridges/filesystem.mjs";

export class FileEntry {
	public readonly path: string;
	public readonly tags: string;
	public readonly creation: number;
	public readonly size: number;

	public constructor(entry: RawFileEntry) {
		this.path = entry[0];
		this.tags = entry[1] ?? "";
		this.creation = entry[2] ?? 0;
		this.size = entry[3] ?? 0;
	}

	public isFolder() {
		return this.path.endsWith('/');
	}

	public static fromRawEntries(entries: RawFileEntry[]): FileEntry[] {
		return entries.map(entry => new FileEntry(entry));
	}
}