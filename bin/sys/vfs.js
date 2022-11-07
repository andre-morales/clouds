import Util from 'util';
import FS from 'fs';
import Path from 'path';

class VFS {
	constructor() {
		this.fsDefs = null;
	}

	loadDefs(defs) {
		this.fsDefs = defs;
	}

	translate(userid, vpath) {
		let defs = this.fsDefs;

		for (let mountp in defs) {
			if (vpath.startsWith(mountp)) {
				let phyPoint = defs[mountp].path;
				phyPoint = phyPoint.replace('$user', userid);
				return phyPoint + vpath.replace(mountp, "");
			}
		}

		return null;
	}

	listVMPoints(userid) {
		return Object.keys(this.fsDefs)
		.filter((vmp) => {
			return !this.fsDefs[vmp].hidden;
		});
	}

	async listPDir(path) {
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
			let stype = '*i';

			try {
				if (entry.isSymbolicLink()) {
					stype = '*si';

					let stat = await FS.promises.stat(path + file);
					if (stat.isDirectory()) {
						file += '/';
					}
					stype = '*s';
				} else {
					stype = '';
					if (entry.isDirectory()) {
						file += '/';
					}
				}
			} catch(e) {}
			return file + stype;
		});

		let results = await Promise.all(promises);
		return results; 
	}
}

export { VFS };