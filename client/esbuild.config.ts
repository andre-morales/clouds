import * as ESBuild from 'esbuild';
import Babel from 'esbuild-plugin-babel';
import { sassPlugin as Sass } from 'esbuild-sass-plugin';
import { context, runBuild, setBaseConfig, getBaselineTargets } from '../build_config/esbuild_system.ts';

const developmentMode = Boolean(process.env.DEV_MODE);
const watchMode = Boolean(process.env.WATCH_MODE);
const emitMetafile = true;

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
		context({
			entryPoints: [
				'./client/src/boot/entry.mts',
				'./client/src/boot/login.mts'
			],
			outdir: './client/public/pack/'
		}),
		context({
			entryPoints: ['./client/src/client_core.mts'],
			outfile: './client/public/pack/core.chk.js',
			globalName: 'CoreModule',
		}),
		context({
			entryPoints: [
				'./client/src/ui/controls/slider/slider.scss',
				'./client/src/styles/themes/default.scss',
				'./client/src/styles/themes/retro.scss',
			],
			outdir: './client/public/pack/',
		})
	];

	runBuild(contexts, watchMode, emitMetafile ? 'core.meta.json' : undefined);
}

main();
