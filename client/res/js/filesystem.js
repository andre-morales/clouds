class Files {
	static getPath(path) {
		return '/fs/q' + path;
	}

	static async getJson(path) {
		let res = await fetch(Files.getPath(path));
		return await res.json();
	}

	static async getText(path) {
		let res = await fetch(Files.getPath(path));
		return await res.text();
	}

	static upPath(path) {
		return '/fs/ud' + path;
	}

	static async upText(path, text) {
		await fetch(Files.upPath(path), {
			method: 'POST',
			body: text,
			headers: {
				'Content-Type': 'text/plain'
			}
		});
	}
}

class Paths {
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

class FileTypes {
	static isDir(path) {
		return path.endsWith('/');
	}

	static isVideo(path) {
		return endsWithArr(path, ['.mp4', '.mkv', '.webm', '.m4v']);
	}

	static isPicture(path) {
		return endsWithArr(path, ['.png', '.jpg', '.jpeg', '.webp']);
	}

	static isAudio(path) {
		return endsWithArr(path, ['.mp3', '.ogg', 'm4a', '.opus', '.weba']);
	}
	
	static isText(path) {
		return endsWithArr(path, ['.txt', '.json']);
	}
	
	static isMedia(path) {
		return FileTypes.isVideo(path) || FileTypes.isPicture(path) || FileTypes.isAudio(path);
	}
}
