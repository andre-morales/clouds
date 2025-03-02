const Path = require('path');
const Webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

const ROOT = Path.resolve(__dirname, '../');

module.exports = function(env, args) {
	return {
		mode:    (env.production) ? 'production' : 'development',
		devtool: (env.production) ? 'source-map' : 'inline-source-map',
		watch: !env.production,
		cache: {
			type: (env.production) ? 'filesystem' : 'memory'
		},
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
			},
			desktop: {
				import: './client/src/styles/main_desktop.scss'
			},
			ui: {
				import: './client/src/styles/main_ui.scss'
			}
		},
		output: {
			filename: '[name].chk.js',
			path: Path.resolve(ROOT, 'client/public/pack'),
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
						{ loader: MiniCssExtractPlugin.loader },
						{ 
							loader: "css-loader",
							options: {
								url: false
							}
						},
						{ loader: "sass-loader" }						
					]
				}
			]
		},
		resolve: {
			extensionAlias: {
				'.mjs': ['.mts', '.mjs']
			},
		},
		optimization: {
			runtimeChunk: 'single',
			minimizer: [
				'...',
				new CssMinimizerPlugin()
			]
		},
		plugins: [
			new Webpack.DefinePlugin({
				'__BUILD_MODE__': JSON.stringify((env.production) ? 'Production' : 'Development')
			}),
			,
			new MiniCssExtractPlugin({
				filename: '[name].chk.css'
			})
		]
	}
};