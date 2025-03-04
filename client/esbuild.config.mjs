import * as ESBuild from 'esbuild';
import Path from 'path';
import Glob from 'glob';
import Babel from 'esbuild-plugin-babel';
import { sassPlugin as Sass } from 'esbuild-sass-plugin';

ESBuild.build({
	entryPoints: ['./client/src/boot/polys.mts'],
	bundle: true,
	outfile: './client/public/pack/polyfills.js',
	format: 'iife',
	target: ['chrome54'],
	globalName: 'ModulePolyfills',
	minify: true,
	plugins: [
		Babel()
	]
});
