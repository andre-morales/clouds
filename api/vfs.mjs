import Util from 'util';
import FS from 'fs';
import Path from 'path';
import config from './config.mjs';

var defs = null;

export function init() {
	defs = config.fs;
}

export function translate(userid, vpath) {
	for (let mountp in defs) {
		if (vpath.startsWith(mountp)) {
			let phyPoint = defs[mountp].path;
			phyPoint = phyPoint.replace('$user', userid);
			return phyPoint + vpath.replace(mountp, "");
		}
	}

	return null;
}

export function listVMPoints(userid) {
	return Object.keys(defs)
	.filter((vmp) => {
		return !defs[vmp].hidden;
	})
	.map((vmp) => {
		return [vmp];
	});
}

export async function listPDir(path) {
	if (!path.endsWith('/')) path += '/';

	let files;
	try {
		files = await FS.promises.readdir(path, {
			"withFileTypes": true
		});
	} catch (err) {
		if (err.code == 'EPERM') throw 403;
		if (err.code == 'ENOENT') throw 404;
		throw 500;
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

		return [file, stype, creationTime];
	});

	let results = await Promise.all(promises);
	return results; 
}
