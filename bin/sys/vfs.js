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

		let results = [];
		let readdirf = Util.promisify(FS.readdir);
		let files;

		try {
			files = await readdirf(path);
		} catch (err) {
			return 404;
		}
		
		for (let file of files) {
			try { 
				let stats = await FS.promises.lstat(path + file);
				if (stats.isDirectory()) file += '/';
				
				results.push(file);
			} catch(err) {}	
		}

		return results;
	}
}

export { VFS };