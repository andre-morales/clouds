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
	output: {
		filename: '[name].bundle.js',
		path: path.resolve(ROOT, 'client/res/pack'),
	},
};