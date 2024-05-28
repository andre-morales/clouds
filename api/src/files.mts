import FS from 'node:fs';
import Path from 'node:path';

/**
 * Type returned by the file listing operation.
 */
interface DirEntryArray {
	/** Path name */
	0: string;
	/** Attributes */
	1: string;
	/** Creation date */
	2: number;
}

/**
 * Obtain the size of this path. If this path is a folder, calculates its size recursively.
 * @param path A path to a file or directory.
 * @returns The size in bytes of the path.
 */
export async function size(path: string): Promise<number> {
	let stats = await FS.promises.stat(path);

	// If path is a file, just return its size directly
	if (!stats.isDirectory()) {
		return stats.size;
	}

	// Read all of the files inside the directory, including sub-dirs
	let files = await FS.promises.readdir(path, {
		withFileTypes: true,
		recursive: true
	});

	// For each subfile, query the size of the file in a promise
	let promises = files.map(async (entry) => {
		if (!entry.isFile()) return 0;

		let fileName = entry.name;
		let fileParentPath = (entry as any).parentPath;
		let stat = await FS.promises.stat(Path.resolve(path, fileParentPath, fileName));
		return stat.size;
	});

	// Await all of the size queries
	let sizes = await Promise.all(promises);

	// Sum all of the sizes
	let size = sizes.reduce((acc, v) => acc + v, 0);
	return size;
}

/**
 * List all files and their properties in a path.
 * @param path Physical path to be listed.
 * @returns Returns an array of paths. Each path is an array in the format [name, tags, data]
 */
export async function list(path: string): Promise<DirEntryArray[]> {
	if (!path.endsWith('/')) path += '/';
	
	let files;
	try {
		files = await FS.promises.readdir(path, {
			"withFileTypes": true
		});
	} catch (err: any) {
		if (err.code == 'EPERM') throw 403;
		if (err.code == 'ENOENT') throw 404;
		if (err.code == 'ENOTDIR') throw 400;
		else {
			console.error(err);
			throw 500;
		}
	}

	let promises = files.map(async (entry) => {
		let file = entry.name;
		let stype = '';
		let creationTime = 0;

		// If this try-catch fails, we probably have no rights to gather
		// information about the file
		try {
			let stat = await FS.promises.stat(path + file);

			//creationTime = stat.birthtimeMs;
			creationTime = stat.mtimeMs;

			if (stat.isDirectory()) {
				file += '/';
			}

			if (entry.isSymbolicLink()) {
				stype += 's';
			}
		} catch(e) {
			// Add inacessible tag to it
			stype += 'i';
		}

		let result: DirEntryArray = [file, stype, creationTime];
		return result;
	});

	let results = await Promise.all(promises);
	return results; 
}