import SinestesiaApp from "./app.mjs";
import { FileSystem, Paths, RawFileEntry } from "/@sys/drivers/filesystem.mjs";
import Utils from "/@sys/utils/utils.mjs";

class Playlist {
	app: SinestesiaApp;
	list: RawFileEntry[];
	dir: string;
	index: number;

	constructor(app: SinestesiaApp) {
		this.app = app;
	}

	async goNext() {
		if (!this.list) {
			await this.convertToPlaylist();
		}

		if (this.list && this.index < this.list.length - 1) {
			this.index++;
			let nextFile = this.list[this.index][0];
			let nextUrl = '/fsv' + this.dir + nextFile;
			this.app.openFile(nextUrl);

			await Utils.sleep(100);
			this.app.player.play();
		}
	}

	async goPrevious() {
		if (!this.list) {
			await this.convertToPlaylist();
		}

		if (this.list && this.index > 0) {
			this.index--;

			let prevFile = this.list[this.index][0];
			let prevUrl = '/fsv' + this.dir + prevFile;

			this.app.openFile(prevUrl);

			await Utils.sleep(100);
			this.app.player.play();
		}
	}

	// Convert the current playthrough into a playlist
	private async convertToPlaylist() {
		if (this.list) return;

		let currentUrl = this.app.player.getCurrentUrl();

		// Files outside the filesystem can't be converted to playlists
		if (!Paths.isFSV(currentUrl)) return;

		// Convert the URL back to path form and remove FS prefix
		let currentPath = Paths.removeFSPrefix(decodeURI(currentUrl));

		// List all files in the same folder, and set them as the playlist
		let folder = Paths.parent(currentPath);
		let files = await FileSystem.list(folder);
		this.dir = folder;
		this.list = files;

		// Find current file in the listing
		let currentFile = Paths.file(currentPath);
		let index = files.findIndex((f) => f[0] == currentFile);

		// Enable auto play when doing playlist conversions
		this.app.setAutoPlay(true);

		if (index != -1) {
			this.index = index;
			return;
		}

		// If for some reason the file itself couldn't be found, use the first file as index
		this.index = 0;
		console.warn("Could't find the file itself in the playlist?");
		console.warn("Files:", files);
		console.warn("Path:", currentPath); 	
	}
}

export { Playlist }