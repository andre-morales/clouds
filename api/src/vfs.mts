import FS from 'node:fs';
import Path from 'node:path';

import config from './config.mjs';
import * as Files from './files.mjs';

interface MountingPoint {
	/** Virtual mounting point. */
	0: string;
}

interface PathStats {
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
export function listMountingPoints(userId: string): MountingPoint[] {
	let result: MountingPoint[] = Object
	.keys(defs)
	.filter((vmp) => {
		return !defs[vmp].hidden;
	})
	.map((vmp) => {
		return [vmp];
	});
	return result;
}

// Erases completely the given file or folder
export async function erase(user: string, path: string) { 
	let fpath = translate(user, path);
	if (!fpath) return;

	if (config.log_fs_operations) {
		console.log(`Erasing "${fpath}"`);
	}

	await FS.promises.rm(fpath, { recursive: true });
}

// Moves a path to another, this can move files or folders and give them new names
export async function rename(user: string, path: string, newPath: string) {
	let fPath = translate(user, path);
	let fNewPath = translate(user, newPath);
	if (!fPath || !fNewPath) return;

	if (config.log_fs_operations) {
		console.log(`Renaming "${fPath}" to "${fNewPath}"`);
	}

	await FS.promises.rename(fPath, fNewPath);
}

// Copies a file to another path, if the target already exists, fails.
export async function copy(user: string, srcPath: string, dstPath: string) {
	let fSource = translate(user, srcPath);
	let fDestination = translate(user, dstPath);
	if (!fSource || !fDestination) return;

	if (config.log_fs_operations) {
		console.log(`Copying "${fSource}" to "${fDestination}"`);
	}

	await FS.promises.copyFile(fSource, fDestination, FS.constants.COPYFILE_EXCL);
}

export async function list(user: string, path: string) {
	// If the virtual path is root '/', list the virtual mounting points
	if (path == '/') {
		return listMountingPoints(user);
	}

	// Translate the virtual path to the machine physical path
	let fPath = translate(user, path);
	if (!fPath) {
		throw 404;
	}

	// List the directory
	let results = await Files.list(fPath);
	return results;
}

/**
 * Obtains properties from the given path, for example its size.
 * @param user User performing the operation.
 * @param path Path to a file or directory.
 * @returns The stats of the path, or null if it is inacessible.
 */
export async function stats(user: string, path: string): Promise<PathStats | null> {
	let fPath = translate(user, path);
	if (!fPath) return null;

	let pSize = await Files.size(fPath);

	return {
		size: pSize
	};
}

/**
 * @param user User performing the operation. 
 * @param path Path to a directory you want to create.
 */
export async function mkdir(user: string, path: string): Promise<void> {
	let fPath = translate(user, path);
	if (!fPath) return;

	if (config.log_fs_operations) {
		console.log(`New Directory in "${fPath}"`);
	}

	await FS.promises.mkdir(fPath);
}
