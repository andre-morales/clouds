import { BadParameterFault, FetchException, Exception } from '../faults.mjs';
import { Timeout } from '../utils/timeout.mjs';
import Strings from '../utils/strings.mjs';

const UPLOAD_TIMEOUT = 30000;

export class FileSystem {
	static async readText(path: string): Promise<string> {
		let url = Paths.toURL(Paths.toFSV(path));
		let res = await fetch(url);
		return await res.text();
	}

	static async readBlob(path: string): Promise<Blob> {
		let url = Paths.toURL(Paths.toFSV(path));
		let res = await fetch(url);
		return await res.blob();
	}

	static async readJson(path: string) {
		let url = Paths.toURL(Paths.toFSV(path));
		try {
			let res = await fetch(url);
			if (res.status != 200) throw new FetchException(`JSON fetch of '${path}' failed with status ${res.status}.`);

			return await res.json();
		} catch (err: any) {
			throw new FetchException(err);
		}
	}	

	static async writeText(path: string, text: string): Promise<void> {
		let url = Paths.toURL(Paths.toFSV(path));
		await fetch(url, {
			method: 'PUT',
			body: text,
			headers: {
				'Content-Type': 'text/plain'
			}
		});
	}

	static async writeJson(path: string, obj: object): Promise<void> {
		await FileSystem.writeText(path, JSON.stringify(obj));
	}

	static writeUploadForm(path: string, form: HTMLFormElement, prepareFn: (req: XMLHttpRequest) => void): XMLHttpRequest {
		const url = Paths.toURL(Paths.toFSV(path));

		// Create request objects
		let formData = new FormData(form);
		let req = new XMLHttpRequest();

		// Invoke prepare callback
		if (prepareFn) prepareFn(req);

		// Prepare a timeout to abort the request in case too much time has elapsed.
		let timeout = new Timeout(UPLOAD_TIMEOUT, () => req.abort());
		
		// Open the fetch operation
		req.open('POST', url);

		// When progress occurs, reset the timeout.
		req.upload.addEventListener('progress', () => timeout.set());
		req.upload.addEventListener('loadend', () => timeout.stop());

		req.send(formData);
		return req;
	}

	static async list(path: string): Promise<any> {
		// Convert the path to a list cmd
		if (!path.endsWith('/')) path += '/';
		let url = Paths.toURL(Paths.toFSV(path));

		let fRes = await fetch(url);
		if (fRes.status != 200) {
			throw new FileSystemException(`List operation failed with status ${fRes.status}`);
		}

		let result = await fRes.json();
		return result;
	}

	static async rename(from: string, to: string): Promise<void> {
		let fromPath = Paths.toURL(Paths.toFSV(from));
		let toPath = Paths.removeFSPrefix(to);

		let cmd = fromPath + "?rename=" + encodeURIComponent(toPath);
		let res = await fetch(cmd, {
			method: 'PATCH'
		});
		if (res.status != 200) {
			throw new FileSystemException(`Rename operation of "${from}" failed with status ${res.status}.`);
		}
	}

	static async copy(from: string, to: string): Promise<void> {
		let fromPath = Paths.toURL(Paths.toFSV(from));
		let toPath = Paths.removeFSPrefix(to);

		let cmd = fromPath + "?copy=" + encodeURIComponent(toPath);
		let res = await fetch(cmd, {
			method: 'PATCH'
		});
		if (res.status != 200) {
			throw new FileSystemException(`Copy operation of "${from}" failed with status ${res.status}.`);
		}
	}

	static async erase(path: string): Promise<void> {
		// Convert the path
		let cmd = Paths.toURL(Paths.toFSV(path));

		// Perform the operation
		let fRes = await fetch(cmd, {
			method: 'DELETE'
		});
		if (fRes.status != 200) {
			throw new FileSystemException(`Erase operation of "${path}" failed with status ${fRes.status}.`);
		}
	} 

	static async stats(path: string): Promise<any> {
		// Convert the path
		let cmd = Paths.toURL(Paths.toFSV(path)) + '?stats';

		let fRes = await fetch(cmd);
		if (fRes.status != 200) {
			throw new FileSystemException(`Stats operation failed with status ${fRes.status}`);
		}

		let result = await fRes.json();
		return result;
	}

	static async makeDirectory(path: string): Promise<void> {
		// Convert the path
		let cmd = Paths.toURL(Paths.toFSV(path)) + '?make';

		// Perform the operation
		let fRes = await fetch(cmd, {
			method: 'PUT'
		});
		if (fRes.status != 200) {
			throw new FileSystemException(`Mkdir operation in "${path}" failed with status ${fRes.status}.`);
		}
	}
}

export class Paths {
	static toURL(path: string): string {
		return path.split('/')
			.map(piece => encodeURIComponent(piece))
			.join('/');
	}

	static toFSV(path: string) {
		// If it is already a FSV path, don't alter anything
		if (Paths.isFSV(path)) return path;

		// Make sure path is absolute
		if (!path.startsWith('/')) {
			throw new BadParameterFault("FSV path doesn't start with /. Paths must be absolute before being converted.");
		}
		return `/fsv${path}`
	}

	static isFSV(path: string) {
		return path.startsWith('/fsv/');
	}

	// Removes FS or FSV prefix
	static removeFSPrefix(path: string) {
		if (Paths.isFSV(path)) {
			return path.substring(path.indexOf('/', 1));		
		}
		return path;
	}

	static parent(path: string) {
		if (path.endsWith('/')) {
			return path.substring(0, path.lastIndexOf('/', path.length - 2) + 1);	
		} else {
			return path.substring(0, path.lastIndexOf('/') + 1);
		}
	}

	static file(path: string) {
		if (path.endsWith('/')) {
			return path.substring(path.lastIndexOf('/', path.length - 2) + 1);	
		} else {
			return path.substring(path.lastIndexOf('/') + 1);
		}
	}

	static getExtension(path: string) {
		let file = Paths.file(path);
		let i = file.lastIndexOf('.');
		if (i == -1) return null;

		return file.substring(i + 1);
	}

	static join(base: string, child: string) {
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

	static resolve(path: string) {
		// Remove redundant local references
		path = path.replaceAll('/./', '/');

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
	static isDir(path: string) {
		return path.endsWith('/');
	}

	static isVideo(path: string) {
		return Strings.endsWithAny(path, ['.mp4', '.mkv', '.webm', '.m4v']);
	}

	static isPicture(path: string) {
		return Strings.endsWithAny(path, ['.png', '.jpg', '.jpeg', '.webp']);
	}

	static isAudio(path: string) {
		return Strings.endsWithAny(path, ['.mp3', '.ogg', 'm4a', '.opus', '.weba']);
	}
	
	static isText(path: string) {
		return Strings.endsWithAny(path, ['.txt', '.json']);
	}
	
	static isMedia(path: string) {
		return FileTypes.isVideo(path) || FileTypes.isPicture(path) || FileTypes.isAudio(path);
	}
}

export class FileSystemException extends Exception {
	constructor(message: string) {
		super(message);
		this.name = "FileSystemException";
	}
}