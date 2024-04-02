const path = require('path');

module.exports = {
	mode: 'production',
	devtool: 'source-map',
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
		path: path.resolve(__dirname, 'client/res/js'),
	},
};