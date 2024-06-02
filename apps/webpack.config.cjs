const Path = require('path');
const Glob = require('glob');
const ROOT = Path.resolve(__dirname, '../');

// Find the path to all folders inside the apps directory
let globs = Glob.sync('./apps/*/');

// For each folder, associate the bundle id with the given entry point configuration.
let entries = globs.map((path) => {
	let id = Path.basename(path);
	let entryConfig = {'import': `./${path}/main.mjs`};
	return [id, entryConfig] ;
});

// Generate entry points configuration
let entryPoints = Object.fromEntries(entries);

module.exports = function(env) {
	return {
		mode:    (env.production) ? 'production' : 'development',
		devtool: (env.production) ? 'source-map' : 'eval',
		entry: entryPoints,
		module: {
			rules: [
				{
					test: /\.(?:mts|mjs|cjs|js)$/,
					exclude: /node_modules/,
					use: {
						loader: 'babel-loader',
						options: {
							cacheDirectory: true
						}
					}
				}
			]
		},
		resolve: {
			extensionAlias: {
				'.mjs': ['.mts', '.mjs']
			}
		},
		output: {
			filename: '[name]/app.bundle.mjs',
			path: Path.resolve(ROOT, 'apps'),
			libraryTarget: 'module'
		},
		experiments: {
			outputModule: true
		}
	}
};