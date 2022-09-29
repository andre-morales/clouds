import Util from 'util';
import FS from 'fs';

class VFS {
	constructor() {
		this.fsDefs = null;
	}

	loadDefs(file) {
		this.fsDefs = JSON.parse(FS.readFileSync(file));
	}

	translate(userid, vpath) {
		let defs = this.fsDefs;

		for (let mountp in defs) {
			if (vpath.startsWith(mountp)) {
				return defs[mountp].path + vpath.replace(mountp, "");
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
			files = await FS.promises.readdir(path);
		} catch (err) {
			if (err.code == 'EPERM') throw 403;
			if (err.code == 'ENOENT') throw 404;
			throw 500;
		}

		let promises = files.map(async (file) => {
			let type = '';

			try {
				let stats = await FS.promises.stat(path + file);
				if (stats.isDirectory()) {
					file += '/';
				}
			} catch(err) {
				type = '*i';
			}

			return file + type;
		});

		let results = await Promise.all(promises);
		return results;
	}
}

export { VFS };