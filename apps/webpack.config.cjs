const Path = require('path');
const Glob = require('glob');
const Webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

const ROOT = Path.resolve(__dirname, '../');

// Find the path to all folders inside the apps directory
let globs = Glob.sync('./apps/*/');

// For each folder, associate the bundle id with the given entry point configuration.
let entries = globs.map((path) => {
	let id = Path.basename(path);

	let entryConfig = {
		import: `./${path}/main.mjs`,
		library: {
			type: 'umd',
			name: 'AppModule_' + id
		}
	};
	return [id, entryConfig] ;
});

// Generate entry points configuration
let entryPoints = Object.fromEntries(entries);

module.exports = function(env) {
	return {
		mode:    (env.production) ? 'production' : 'development',
		devtool: (env.production) ? 'source-map' : 'eval-source-map',
		watch: !env.production,
		cache: {
			type: (env.production) ? 'filesystem' : 'memory'
		},

		entry: entryPoints,
		output: {
			filename: (ctx) => {
				if (ctx.chunk.name == 'platform')
					return '../client/public/pack/platform.chk.js'
				if (ctx.chunk.name == 'runtime')
					return '../client/public/pack/runtime.chk.js'
				return '[name]/dist/app.bundle.mjs'
			},
			path: Path.resolve(ROOT, 'apps'),
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
				},
				{
					test: /\.scss$/i,
					use: [
						MiniCssExtractPlugin.loader,
						"css-loader",
						"sass-loader"
					]
				}
			]
		},
		resolve: {
			extensionAlias: {
				'.mjs': ['.mts', '.mjs']
			}
		},
		externals: {
			runtime: 'runtime',
		},
		optimization: {
			minimize: env.production,
			minimizer: [
				'...',
				new CssMinimizerPlugin()
			],
			runtimeChunk: 'single',
			splitChunks: {
				chunks: 'all',
				cacheGroups: {
				  vendors: {
					test: /[\\/]node_modules[\\/](core-js)[\\/]/,
					name: 'platform',
					chunks: 'all',
					enforce: true,
				  },
				},
			}
		},
		plugins: [
			new Webpack.DefinePlugin({
				'__BUILD_MODE__': JSON.stringify((env.production) ? 'Production' : 'Development')
			}),
			new MiniCssExtractPlugin({
				filename: '[name]/dist/styles.bundle.css'
			})
		]
	}
};