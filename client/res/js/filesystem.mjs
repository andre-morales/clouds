import Util from '/res/js/util.mjs';
import { Exception } from '/res/js/faults.mjs';

export class FileSystem {
	static async readText(path) {
		let res = await fetch(Paths.toFSV(path));
		return await res.text();
	}

	static async readJson(path) {
		let url = Paths.toFSV(path);
		try {
			let res = await fetch(url);
			if (res.status != 200) throw new FetchException(`JSON fetch of '${path}' failed with status ${res.status}.`);

			return await res.json();
		} catch (err) {
			throw new FetchException(err);
		}
	}	

	static async writeText(path, text) {
		await fetch(Paths.toFSV(path), {
			method: 'PUT',
			body: text,
			headers: {
				'Content-Type': 'text/plain'
			}
		});
	}

	static async writeJson(path, obj) {
		await FileSystem.writeText(path, JSON.stringify(obj));
	}

	static writeUploadForm(path, form, listeners) {
		let formData = new FormData(form);
		let req = new XMLHttpRequest();
		
		if (listeners) listeners(req);

		req.open('POST', Paths.toFSV(path));
		req.timeout = 40000;
		req.send(formData);

		return req;
	}

	static async list(path) {
		// Convert the path to a list cmd
		if (!path.endsWith('/')) path += '/';
		let cmd = Paths.toFSV(path);

		let fres = await fetch(cmd);
		if (fres.status != 200) {
			throw new FileSystemException(`List operation failed with status ${fres.status}`);
		}

		let result = await fres.json();
		return result;
	}

	static async rename(from, to) {
		let fromPath = Paths.toFSV(from);
		let toPath = Paths.removeFSPrefix(to);

		let cmd = fromPath + "?rename=" + encodeURIComponent(toPath);
		let res = await fetch(cmd, {
			method: 'PATCH'
		});
		if (res.status != 200) {
			throw new FileSystemException(`Rename operation of "${from}" failed with status ${res.status}.`);
		}
	}

	static async copy(from, to) {
		let fromPath = Paths.toFSV(from);
		let toPath = Paths.removeFSPrefix(to);

		let cmd = fromPath + "?copy=" + encodeURIComponent(toPath);
		let res = await fetch(cmd, {
			method: 'PATCH'
		});
		if (res.status != 200) {
			throw new FileSystemException(`Copy operation of "${from}" failed with status ${res.status}.`);
		}
	}

	static async erase(path) {
		// Convert the path
		let cmd = Paths.toFSV(path);

		// Perform the operation
		let fres = await fetch(cmd, {
			method: 'DELETE'
		});
		if (fres.status != 200) {
			throw new FileSystemException(`Erase operation of "${path}" failed with status ${fres.status}.`);
		}
	} 

	static async makeDirectory(path) {
		// Convert the path
		let cmd = Paths.toFSV(path) + '?make';

		// Perform the operation
		let fres = await fetch(cmd, {
			method: 'PUT'
		});
		if (fres.status != 200) {
			throw new FileSystemException(`Mkdir operation in "${path}" failed with status ${fres.status}.`);
		}
	}
}

export class Paths {
	static toFS(path, op) {
		// If it is already a FS path, replace the op	
		if (Paths.isFS(path)) {
			// Remove fs-op prefix and add new one
			let p = path.substring(path.indexOf('/', 4));
			return `/fs/${op}${p}`;
		} else {
			// Make sure path is absolute
			if (!path.startsWith('/')) {
				throw new BadParameterFault("FS path doesn't start with /. Paths must be absolute before being converted.");
			}
			return `/fs/${op}${path}`
		}
	}

	static toFSV(path) {
		// If it is already a FSV path, don't alter anything
		if (Paths.isFSV(path)) return path;

		// If is a FS path, remove the op
		if (Paths.isFS(path)) {
			// Remove fs-op prefix
			let p = path.substring(path.indexOf('/', 4));
			return `/fsv${p}`;
		} else {
			// Make sure path is absolute
			if (!path.startsWith('/')) {
				throw new BadParameterFault("FSV path doesn't start with /. Paths must be absolute before being converted.");
			}
			return `/fsv${path}`
		}
	}

	static isFS(path) {
		return path.startsWith('/fs/');
	}

	static isFSV(path) {
		return path.startsWith('/fsv/');
	}

	// Removes FS or FSV prefix
	static removeFSPrefix(path) {
		if (Paths.isFSV(path)) {
			return path.substring(path.indexOf('/', 1));		
		} else if (Paths.isFS(path)) {
			return path.substring(path.indexOf('/', 4));
		}
		return path;
	}

	static parent(path) {
		if (path.endsWith('/')) {
			return path.substring(0, path.lastIndexOf('/', path.length - 2) + 1);	
		} else {
			return path.substring(0, path.lastIndexOf('/') + 1);
		}
	}

	static file(path) {
		if (path.endsWith('/')) {
			return path.substring(path.lastIndexOf('/', path.length - 2) + 1);	
		} else {
			return path.substring(path.lastIndexOf('/') + 1);
		}
	}

	static join(base, child) {
		let path = "";

		if (child.startsWith("/")) {
			path = child;
		} else if (base.endsWith("/")) {
			path = base + child;
		} else {
			path = base + "/" + child;
		}

		return Paths.resolve(path);
	}

	static resolve(path) {
		// Remove redundant local references
		path = strReplaceAll(path, '/./', '/');

		// Remove redundant local ref
		if (path.endsWith('/.')) path = path.slice(0, -1);

		// Progressively resolve ellipsis
		while (true) {
			// Find the next ellipsis if there is one
			let ellipsis = path.indexOf("/..", 1);
			if (ellipsis == -1) break;

			// Get the slash anterior to the ellipsis,
			// if there isn't one, the ellipsis will be kept
			let slash = path.lastIndexOf("/", ellipsis - 1);
			if (slash < 0) {
				path = "./" + path.slice(ellipsis + 4);
				break;
			}

			// Remove the ellipsis and join the base dir and child dir
			let base_ = path.slice(0, slash + 1);
			let child_ = path.slice(ellipsis + 4);
			if (base_ == "/") {
				path = base_ + child_;
				break;
			} else if (base_ == "") {
				path = "./" + child_;
				break;
			}
			path = base_ + child_;
		}
		return path;
	}
}

export class FileTypes {
	static isDir(path) {
		return path.endsWith('/');
	}

	static isVideo(path) {
		return Util.endsWithAny(path, ['.mp4', '.mkv', '.webm', '.m4v']);
	}

	static isPicture(path) {
		return Util.endsWithAny(path, ['.png', '.jpg', '.jpeg', '.webp']);
	}

	static isAudio(path) {
		return Util.endsWithAny(path, ['.mp3', '.ogg', 'm4a', '.opus', '.weba']);
	}
	
	static isText(path) {
		return Util.endsWithAny(path, ['.txt', '.json']);
	}
	
	static isMedia(path) {
		return FileTypes.isVideo(path) || FileTypes.isPicture(path) || FileTypes.isAudio(path);
	}
}

export class FileSystemException extends Exception {
	constructor(message) {
		super(message);
		this.name = "FileSystemException";
	}
}