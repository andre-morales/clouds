import * as ESBuild from 'esbuild';
import Framon, { writeFileEnsureDir } from './system.ts';
import Chalk from 'chalk';

class WriterPlugin implements ESBuild.Plugin {
	name: string;

	constructor() {
		this.name = 'writer-plugin';
	}

	setup(builder: ESBuild.PluginBuild) {
		builder.onEnd(async (result) => {
			if (!result.outputFiles) return;
			
			await Promise.all(result.outputFiles.map(async (file) => {
				let fileSize = (file.contents.byteLength / 1024).toFixed(1);
				await writeFileEnsureDir(file.path, file.contents);
				Framon.log('i', `${Chalk.white('Wrote')} (${fileSize} KiB): ${file.path}`);
			}));
		});

	}
}

export default () => { 
	let plugin = new WriterPlugin();
	return {
		name: plugin.name,
		setup: (pb: ESBuild.PluginBuild) => plugin.setup(pb)
	}
};
