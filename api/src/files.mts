/**
 * Physical file and paths handling layer.
 */
import FS from 'node:fs';
import Path from 'node:path';

export enum ResultCode {
	/** A non-specified error ocurred. */
	UNKNOWN_ERROR = -1,
	/** The operation executed successfully. */
	SUCCESS = 0,
	/** The path specified is invalid. */
	NOT_FOUND,
	/** The user has no access to the resource or operation requested. */
	ACCESS_DENIED,
	/** Malformed request. */
	BAD_PARAMETERS
}

/**
 * Type returned by the file listing operation.
 */
export interface DirEntryArray {
	/** Path name */
	0: string;
	/** Attributes */
	1: string;
	/** Creation date */
	2: number;
}

/**
 * Obtain the size of this path. If this path is a folder, calculates its size recursively.
 * Throws FileOperationError.
 * @param path A path to a file or directory.
 * @returns The size in bytes of the path.
 */
export async function size(path: string): Promise<number> {
	let stats;
	try {
		stats = await FS.promises.stat(path);
	} catch(err) {
		throw wrapIOError(err);
	}

	// If path is a file, just return its size directly
	if (!stats.isDirectory()) {
		return stats.size;
	}

	// Read all of the files inside the directory, including sub-dirs
	let files = await FS.promises.readdir(path, {
		withFileTypes: true,
		recursive: true
	});

	// For each sub-file, query the size of the file in a promise
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
 * List all files and their properties in a path. Throws FileOperationError.
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
	} catch (err) {
		throw wrapIOError(err);
	}

	let promises = files.map(async (entry) => {
		let file = entry.name;
		let tags = '';
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
				tags += 's';
			}
		} catch(e) {
			// Add inaccessible tag to it
			tags += 'i';
		}

		let result: DirEntryArray = [file, tags, creationTime];
		return result;
	});

	let results = await Promise.all(promises);
	return results; 
}

/**
 * Copies a file into another path if it doesn't exist. Throws FileOperationError.
 * @param source Source path to a file.
 * @param destination Destination path desired.
 */
export async function copy(source: string, destination: string): Promise<void> {
	try {
		await FS.promises.copyFile(source, destination, FS.constants.COPYFILE_EXCL);
	} catch(err) {
		throw wrapIOError(err);
	}
}

/**
 * Wrap a general IO error within a FileOperationError.
 * @param err IO error with code property.
 * @returns A FileOperationError with status code most closely resembling the error passed.
 */
function wrapIOError(err: any) {
	let code = ResultCode.UNKNOWN_ERROR;

	switch (err.code) {
	case 'EPERM': code = ResultCode.ACCESS_DENIED; break;
	case 'ENOENT': code = ResultCode.NOT_FOUND; break
	case 'ENOTDIR': code = ResultCode.BAD_PARAMETERS; break;
	}

	return new FileOperationError(code);
}

/**
 * Error raised for exceptional cases in any file handling function.
 */
export class FileOperationError extends Error {
	code: ResultCode;

	constructor(status: ResultCode) {
		super(`${getResultName(status)}.`);
		this.name = 'FileOperationError';
		this.code = status;
	}

	getHTTPCode(): number {
		switch(this.code) {
			case ResultCode.SUCCESS:
				return 200;
			case ResultCode.NOT_FOUND:
				return 404;
			case ResultCode.ACCESS_DENIED:
				return 403;
			default:
				return 500;
		}
	}
}

function getResultName(result: ResultCode): string {
	switch(result) {
		case ResultCode.SUCCESS:
			return "Success";
		case ResultCode.NOT_FOUND:
			return "No mapping";
		case ResultCode.ACCESS_DENIED:
			return "Access denied";
		default:
			return "Unknown";
	}
}