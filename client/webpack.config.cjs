const path = require('path');
const ROOT = path.resolve(__dirname, '../');

module.exports = function(env, args) {
	return {
		mode:    (env.production) ? 'production' : 'development',
		devtool: (env.production) ? 'source-map' : 'eval',

		entry: {
			shared: {
				import: './client/src/client_core.mjs',
				library: {
					name: 'CoreModule',
					type: 'umd'
				}
			},
			public: {
				import: './client/src/public.mjs',
				dependOn: 'shared',
				library: {
					name: 'PublicModules',
					type: 'umd'
				}
			}
		},
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
			},
		},
		output: {
			filename: '[name].bundle.js',
			path: path.resolve(ROOT, 'client/public/pack'),
		}
	}
};