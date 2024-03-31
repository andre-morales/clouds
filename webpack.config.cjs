const path = require('path');

module.exports = {
	entry: './client/src/client_core.mjs',
	mode: 'development',
	output: {
		filename: 'main.js',
		library: 'CoreModule',
		path: path.resolve(__dirname, 'client/res/js'),
	},
};