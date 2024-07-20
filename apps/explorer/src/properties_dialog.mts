import { FileSystem, Paths } from '/@sys/bridges/filesystem.mjs';
import { ClientClass } from '/@sys/client_core.mjs';
import Window from '/@sys/ui/window.mjs';
import ExplorerApp from '../main.mjs';

var Client: ClientClass;

export default class ExplorerProperties {
	explorer: any;
	window: Window;
	$win: $Element;

	constructor(explorer: ExplorerApp) {
		Client = ClientClass.get();
		this.explorer = explorer;
	}

	static openPath(app: ExplorerApp, path: string) {
		let helper = new ExplorerProperties(app);
		helper.open(path);
	}

	async open(path: string) {
		let statsProm = FileSystem.stats(path);
		
		this.window = Client.desktop.createWindow(this.explorer);
		this.window.setOwner(this.explorer.window);
		
		await this.window.setContentToUrl('/app/explorer/res/properties-win.html');
		this.window.setTitle('Properties');
		this.window.setSize(380, 270);
		this.window.bringToCenter();
		this.window.bringToFront();

		let $win = this.window.$window.find(".window-body");
		this.$win = $win;
		$win.addClass("properties-win");
		
		this.window.setVisible(true);
		this.window.focus();
		
		$win.find('.name').text(Paths.file(path));

		let stats = await statsProm;
		let $size = $win.find('.size');
		$size.text(this.toDataSize(stats.size));
	}

	toDataSize(bytes) {
		if (bytes < 1024) return bytes.toFixed(0) + " B";

		let kib = bytes / 1024;
		if (kib < 1024) return kib.toFixed(1) + " KiB";

		let mib = kib / 1024;
		if (mib < 1024) return mib.toFixed(1) + " MiB";

		let gib = mib / 1024.0;
		return gib.toFixed(1) + ' GiB';
	}
}