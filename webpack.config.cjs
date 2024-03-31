const path = require('path');

module.exports = {
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
				name: 'PublicModule',
				type: 'umd'
			}
		}
	},
	mode: 'development',
	output: {
		filename: '[name].bundle.js',
		path: path.resolve(__dirname, 'client/res/js'),
	},
};