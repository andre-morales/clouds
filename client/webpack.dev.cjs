const path = require('path');
const ROOT = path.resolve(__dirname, '../');

module.exports = {
	mode: 'development',
	devtool: 'eval',
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
				test: /\.(?:js|mjs|cjs)$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
					options: {
						cacheDirectory: true,
						presets: [
							['@babel/preset-env', {
								targets: {
									chrome: 79
								},
								useBuiltIns: 'usage',
								corejs: '^3.36.1'
							}]
						]
					}
				}
			}
		]
	},
	output: {
		filename: '[name].bundle.js',
		path: path.resolve(ROOT, 'client/res/pack'),
	}
};