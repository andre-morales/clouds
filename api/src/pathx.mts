import Path from 'node:path';

/**
 * Join two paths with an unix separator.
 * @param a First path.
 * @param b Second path.
 * @returns <a>/<b>
 */
export function join(a: string, b: string): string {
	var as = a.endsWith("/");
	var bs = b.startsWith('/'); 
	if(as && bs){
		return a + b.substring(1);
	} else if(as || bs){
		return a + b;
	} else {
		return a + '/' + b;
	}
}

/** Normalizes a path with unix separators (/)
 * @param path the path to be normalized. */
export function normalize(path: string): string {
	return Path.normalize(path).replace(/\\/g, '/');
}

/** Transforms the path given into a filesystem
 * absolute path, such as C:\Users... or /home/.
 * @param path the path to be transformed. */
export function toFullSystemPath(path: string): string {
	return normalize(Path.resolve(path));
}

export function isFileExtVideo(path: string): boolean {
	let extensions = ['.mp4', '.webm', '.mkv', '.m4v'];
	for (let ext of extensions) {
		if (path.endsWith(ext)) return true;
	}
	return false;
}

export function isFileExtPicture(path: string): boolean {
	let extensions = ['.webp', '.png', '.jpg', '.jpeg'];
	for (let ext of extensions) {
		if (path.endsWith(ext)) return true;
	}

	return false;
}
