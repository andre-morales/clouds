import * as ESBuild from "esbuild";
import Path from 'node:path';

export interface InitialSourceMap {
	kind: 'empty' | 'included' | 'file';
	file?: ESBuild.OutputFile;
	url?: string;
	reason?: string;
}

export default function findESBuildSourceMap(file: ESBuild.OutputFile, outputs?: ESBuild.OutputFile[]): InitialSourceMap {
	if (!outputs) 
		return { kind: 'empty'};

	// Find the reference to a source map in the output file, if there is one
	// For single line comments
	let matchesSL = file.text.match(/\/\/\s*#\s*sourceMappingURL=([^\s]+)/);
		
	// For multi-line comments
	let matchesML = file.text.match(/\/\*\s*#\s*sourceMappingURL=([^\s\*]+)\s*\*\//);

	let match = (matchesSL?.[1]) ?? (matchesML?.[1]);
	if (!match) {
		return { kind: 'empty'};
	}

	// If the source map uses a data: url, it means it's an inline
	let sourceMapRef = match;
	if (sourceMapRef.startsWith('data:'))
		return { kind: 'included' };

	// Use the sourcemap url found to figure out the path to the map file
	let sourceMapPath = resolveSourceMapURL(file, sourceMapRef);

	// Try finding the map file in the output files of ESBuild
	let mapFile = outputs.find(v => v.path === sourceMapPath);
	if (!mapFile) {
		return { kind: 'empty', reason: `Couldn't find source map of "${this.file.path}" in output files.
	//Tried to look for "${sourceMapPath}" because the file contained a reference to "${sourceMapRef}".`};
	}

	// If the source map file was found in the build, return it
	return { kind: 'file', file: mapFile, url: sourceMapRef };
}

/**
 * From the sourceMappingURL, resolve the url back to a local computer path.
 */
function resolveSourceMapURL(file: ESBuild.OutputFile, sourceMapRef: string) {
	return Path.join(Path.dirname(file.path), sourceMapRef);
}
