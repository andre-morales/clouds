import * as ESBuild from 'esbuild';
import Babel from 'esbuild-plugin-babel';
import { sassPlugin as Sass } from 'esbuild-sass-plugin';
import { context, runBuild, setBaseConfig, getBaselineTargets } from '../build_config/esbuild_system.ts';

const developmentMode = Boolean(process.env.DEV_MODE);
const watchMode = Boolean(process.env.DEV_MODE);
const emitMetafile = true;
const baseline = getBaselineTargets();

const baseConfig: ESBuild.BuildOptions = {
	bundle: true,
	external: ['*.png'],
	format: 'iife',
	minify: !developmentMode,
	sourcemap: developmentMode ? 'inline' : 'linked',
	define: {
		'__BUILD_MODE__': `'${developmentMode ? 'Development' : 'Production'}'`
	},
	plugins: [Sass({embedded: true}), Babel()],
	metafile: emitMetafile
}

function main() {
	setBaseConfig(baseConfig);

	let contexts = [
		// Polyfills
		context({
			entryPoints: ['./client/src/boot/base.mts'],
			outfile: './client/public/pack/base.chk.js',
		}),
		context({
			entryPoints: ['./client/src/boot/entry.mts'],
			outfile: './client/public/pack/boot_entry.chk.js',
			globalName: 'EntryModule',
		}),
		context({
			entryPoints: ['./client/src/boot/login.mts'],
			outfile: './client/public/pack/boot_login.chk.js',
			globalName: 'LoginModule',
		}),
		context({
			entryPoints: ['./client/src/client_core.mts'],
			outfile: './client/public/pack/core.chk.js',
			globalName: 'CoreModule',
		}),
		context({
			entryPoints: ['./client/src/ui/controls/slider/slider.scss'],
			outfile: './client/public/pack/slider.chk.css',
		})
	];

	runBuild(contexts, watchMode, emitMetafile ? 'core.meta.json' : undefined);
}

main();
