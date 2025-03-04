import * as ESBuild from 'esbuild';
import Path from 'path';
import Glob from 'glob';
import Babel from 'esbuild-plugin-babel';
import { sassPlugin as Sass } from 'esbuild-sass-plugin';
import FS from 'fs';

const baseConfig = {
	bundle: true,
	minify: true,
	format: 'iife',
	target: ['chrome54'],
	define: {
		'__BUILD_MODE__': `'${process.env.DEV_MODE ? 'Development' : 'Production'}'`
	},
	metafile: true
}

async function build(config) {
	let finalConfig = Object.assign(config, baseConfig);
	let result = await ESBuild.build(finalConfig);
	return result;
}

async function main() {
	let allBuilds = Promise.all([
		// Polyfills
		build({
			entryPoints: ['./client/src/boot/base.mts'],
			outfile: './client/public/pack/base.js',
			plugins: [Babel()]
		}),
		build({
			entryPoints: ['./client/src/boot/entry.mts'],
			outfile: './client/public/pack/boot_entry.chk.js',
			globalName: 'EntryModule',
			plugins: [Babel()]
		}),
		build({
			entryPoints: ['./client/src/boot/login.mts'],
			outfile: './client/public/pack/boot_login.chk.js',
			globalName: 'LoginModule',
			plugins: [Babel()]
		}),
		build({
			entryPoints: ['./client/src/client_core.mts'],
			outfile: './client/public/pack/core.chk.js',
			globalName: 'CoreModule',
			external: ['*.png'],
			plugins: [Sass(), Babel()]
		})
	]);
	
	let allResults = await allBuilds;
	let outputText = JSON.stringify(joinResults(...allResults));
	await FS.promises.writeFile('./core.meta.json', outputText);
}

function joinResults(...results) {
	let result = {
		inputs: {},
		outputs: {}
	};
	for (let res of results) {
		if (!res.metafile) continue;

		Object.assign(result.inputs, res.metafile.inputs);
		Object.assign(result.outputs, res.metafile.outputs);
	}

	return result;
}

main();
