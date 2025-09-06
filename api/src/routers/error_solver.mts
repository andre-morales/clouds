import Express from 'express';
import sourceMap from 'source-map';
import * as Auth from './auth.mjs';

var cachedSourceMaps: Map<string, Promise<string | null>> = new Map();

export function getRouter(): Express.Router {
	let router = Express.Router();
	router.post('/solve', async (req, res) => {
		let input = JSON.parse(req.body);

		// Find the source map content for this input file.
		let source = await getSourceMapOf(input.file);
		if (!source) {
			res.status(204).json(null);
			return;
		}
		
		// Instantiate a consumer and process the position
		let cons = await new sourceMap.SourceMapConsumer(source);
		let mapping = cons.originalPositionFor({
			line: input.line,
			column: input.column
		});

		// Send the processed mapping
		let result = {
			name: mapping.name,
			source: mapping.source,
			line: mapping.line,
			column: mapping.column
		}
		res.json(result);
	});

	return router;
}

/**
 * Returns a source map for the given source code URL. This will cache the source map.
 */
async function getSourceMapOf(file: string): Promise<string | null> {
	let cached = cachedSourceMaps.get(file);
	if (cached) return cached;

	// We've never tried fetching this source map, do it. 
	let promise = fetchSourceMap(file);
	cachedSourceMaps.set(file, promise);
	return promise;
}

async function fetchSourceMap(file: string): Promise<string | null> {
	try {
		// Get the source code
		let sourceCodeUrl = new URL(file);
		let sourceCode = await fetch(sourceCodeUrl, {
			headers: {
				authorization: Auth.SECRET_TOKEN
			}
		}).then(res => res.text());

		// Try to find source map URL
		let matches = sourceCode.match(/\/\/# sourceMappingURL=(.*)/);
		if (!matches?.[1]) return null;
		let sourceMapURL = new URL(matches[1], sourceCodeUrl);
	
		// Get the content for the source map
		let sourceMapRes = await fetch(sourceMapURL, {
			headers: {
				authorization: Auth.SECRET_TOKEN
			}
		});
		if (sourceMapRes.status != 200)
			return null;

		let sourceMap = await sourceMapRes.text();
		return sourceMap;
	} catch(err) {
		console.error(err);
		return null;
	}
}