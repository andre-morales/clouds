import * as ESBuild from 'esbuild';
import FS from 'fs';

class WriterPlugin implements ESBuild.Plugin {
	name: string;

	constructor() {
		this.name = 'writer-plugin';
	}

	setup(builder: ESBuild.PluginBuild) {
	
		builder.onEnd(async (result) => {
			if (!result.outputFiles) return;
			
			await Promise.all(result.outputFiles.map((file) => {
				let fileSize = (file.contents.byteLength / 1024).toFixed(1);
				console.log(`:: Write (${fileSize} KiB): ${file.path}`);
				return FS.promises.writeFile(file.path, file.contents);
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
