import * as ESBuild from 'esbuild';
import Babel from 'esbuild-plugin-babel';
import { sassPlugin as Sass } from 'esbuild-sass-plugin';
import { context, runBuild, setBaseConfig } from '../build_config/esbuild_system.ts';

const developmentMode = Boolean(process.env.DEV_MODE);
const watchMode = Boolean(process.env.DEV_MODE);
const emitMetafile = false;

const baseConfig: ESBuild.BuildOptions = {
	bundle: true,
	external: ['*.png'],
	target: ['chrome54'],
	format: 'iife',
	minify: !developmentMode,
	sourcemap: developmentMode ? 'inline' : 'linked',
	define: {
		'__BUILD_MODE__': `'${developmentMode ? 'Development' : 'Production'}'`
	},
	metafile: emitMetafile
}

function main() {
	setBaseConfig(baseConfig);

	let contexts = [
		// Polyfills
		context({
			entryPoints: ['./client/src/boot/base.mts'],
			outfile: './client/public/pack/base.js',
			plugins: [Babel()],
		}),
		context({
			entryPoints: ['./client/src/boot/entry.mts'],
			outfile: './client/public/pack/boot_entry.chk.js',
			globalName: 'EntryModule',
			plugins: [Babel()]
		}),
		context({
			entryPoints: ['./client/src/boot/login.mts'],
			outfile: './client/public/pack/boot_login.chk.js',
			globalName: 'LoginModule',
			plugins: [Babel()]
		}),
		context({
			entryPoints: ['./client/src/client_core.mts'],
			outfile: './client/public/pack/core.chk.js',
			globalName: 'CoreModule',
			plugins: [Sass({
				embedded: true
			}), Babel()]
		})
	];

	runBuild(contexts, watchMode, emitMetafile ? 'core.meta.json' : undefined);
}

main();
