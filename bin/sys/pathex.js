import * as Path from 'path';

/* Join two path locations with an unix seprator */
export function join(a, b){
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
export function normalize(path){
	return Path.normalize(path).replace(/\\/g, '/');
}

/** Transforms the path given into a filesystem
 * absolute path, such as C:\Users... or /home/.
 * @param path the path to be transformed. */
export function toFullSystemPath(path){
	return normalize(Path.resolve(path));
}