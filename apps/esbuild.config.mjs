import * as ESBuild from 'esbuild';
import Path from 'path';
import Glob from 'glob';
import Babel from 'esbuild-plugin-babel';
import { sassPlugin as Sass } from 'esbuild-sass-plugin';

// Find the path to all folders inside the apps directory
let globs = Glob.sync('./apps/*/');

// For each folder, associate the bundle id with the given entry point configuration.
let entries = globs.map((path) => {
	let id = Path.basename(path);

	ESBuild.build({
		entryPoints: ['./apps/' + id + '/main.mts'],
		bundle: true,
		outfile: './apps/' + id + '/dist/app.pack.js',
		format: 'iife',
		target: ['chrome54'],
		globalName: 'AppModule_' + id,
		define: {
			'__BUILD_MODE__': `'${process.env.DEV_MODE ? 'Development' : 'Production'}'`
		},
		minify: !process.env.DEV_MODE,
		sourcemap: process.env.DEV_MODE ? 'inline' : 'linked',
		external: ['*.png'],
		plugins: [
			Sass(),
			Babel(),
		],
		tsconfig: './apps/tsconfig.json'
	});
});
