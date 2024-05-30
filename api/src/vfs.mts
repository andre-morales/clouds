/**
 * Virtual File System operations layer.
 */
import FS from 'node:fs';
import Path from 'node:path';

import config from './config.mjs';
import * as Files from './files.mjs';
import { ResultCode, FileOperationError } from './files.mjs';

/** Properties of path. Be it a file or folder. */
export interface PathStats {
	size: number;
}

var defs: any = null;

export function init() {
	defs = config.fs;
}

/**
 * Translate a virtual path into a physical one.
 * This function performs no checks if the path provided is valid, it only performs a substitution.
 * @param userId String id of the user performing the translation.
 * @param virtualPath Virtual path to be translated.
 * @returns The physical path mapping, if it exists. Otherwise, null.
 */
export function translate(userId: string, virtualPath: string): string | null {
	// Loops over all mounting points checking if the virtual path belongs to one of them.
	// If so, so does the mapping. 
	for (let mPoint in defs) {
		if (virtualPath.startsWith(mPoint)) {
			// Normalize virtual path
			let nPath = Path.posix.normalize(virtualPath);

			// Trying to escape the mounting point?
			if (nPath.indexOf(mPoint) == -1) {
				return null;
			}

			// Remove mounting point from virtual path
			nPath = nPath.replace(mPoint, "");

			// Retrieve physical location of mounting point
			let phyPoint = defs[mPoint].path;
			phyPoint = phyPoint.replace('$user', userId);

			// Physical path
			let jPath = Path.posix.join(phyPoint, nPath);
			return jPath;
		}
	}

	// If no mapping was found, returns null.
	return null;
}

/**
 * Lists all virtual mounting points accessible to the user as configured in the
 * config/profiles/[user].json
 * @param userId String id of the user
 * @returns An array of mounting points. Each mount point is an array with in the format
 * [virtual] of paths.
 */
export function listMountingPoints(userId: string): Files.DirEntryArray[] {
	let result = Object
	.keys(defs)
	.filter((vmp) => {
		return !defs[vmp].hidden;
	})
	.map((vmp) => {
		let entry: Files.DirEntryArray = [vmp, '', 0];
		return entry;
	});
	return result;
}

// Erases completely the given file or folder
export async function erase(user: string, path: string): Promise<void> { 
	let fPath = translate(user, path);
	if (!fPath) return;

	if (config.log_fs_operations) {
		console.log(`Erasing "${fPath}"`);
	}

	await FS.promises.rm(fPath, { recursive: true });
}

// Moves a path to another, this can move files or folders and give them new names
export async function rename(user: string, path: string, newPath: string): Promise<void> {
	let fPath = translate(user, path);
	let fNewPath = translate(user, newPath);
	if (!fPath || !fNewPath) return;

	if (config.log_fs_operations) {
		console.log(`Renaming "${fPath}" to "${fNewPath}"`);
	}

	await FS.promises.rename(fPath, fNewPath);
}

/**
 * Copies a file to another path, if the target already exists, fails.
 * @param user String id of the user performing the operation.
 * @param srcPath Path to be copied from.
 * @param dstPath Path to be copied into.
 */
export async function copy(user: string, srcPath: string, dstPath: string): Promise<void> {
	// Validate and translate paths
	let fSource = translate(user, srcPath);
	let fDestination = translate(user, dstPath);
	if (!fSource || !fDestination) throw new FileOperationError(ResultCode.NOT_FOUND);

	if (config.log_fs_operations) {
		console.log(`Copying "${fSource}" to "${fDestination}"`);
	}

	// Perform the copy operation safely.
	await Files.copy(fSource, fDestination);
}

/**
 * List in an array format all files present in the given path. Throws FileOperationError.
 * For the path '/', the system mounting points are returned.
 * @param user Id of the user performing the listing.
 * @param path Path to a directory.
 * @returns Array of directory entry arrays.
 */
export async function list(user: string, path: string): Promise<Files.DirEntryArray[]> {
	// If the virtual path is root '/', list the virtual mounting points
	if (path == '/') {
		return listMountingPoints(user);
	}

	// Translate the virtual path to the machine physical path
	let fPath = translate(user, path);
	if (!fPath) {
		throw new FileOperationError(ResultCode.NOT_FOUND);
	}

	// List the directory
	let results = await Files.list(fPath);
	return results;
}

/**
 * Obtains properties from the given path, for example its size. Throws FileOperationError.
 * @param user User performing the operation.
 * @param path Path to a file or directory.
 * @returns The stat properties of the path.
 */
export async function stats(user: string, path: string): Promise<PathStats> {
	let fPath = translate(user, path);
	if (!fPath) throw new FileOperationError(ResultCode.NOT_FOUND);

	let pSize = await Files.size(fPath);

	return {
		size: pSize
	};
}

/**
 * Create a new directory. Throws FileOperationError.
 * @param user User performing the operation. 
 * @param path Path to a directory you want to create.
 */
export async function mkdir(user: string, path: string): Promise<void> {
	// Get physical path
	let fPath = translate(user, path);
	if (!fPath) throw new FileOperationError(ResultCode.NOT_FOUND);

	if (config.log_fs_operations) {
		console.log(`New Directory in "${fPath}"`);
	}

	// Try creating the directory safely.
	try {
		await FS.promises.mkdir(fPath);
	} catch(err) {
		console.error(err);
		throw new FileOperationError(ResultCode.UNKNOWN_ERROR);
	}
}
