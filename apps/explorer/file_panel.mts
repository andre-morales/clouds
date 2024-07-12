import { ClientClass } from '/@sys/client_core.mjs';
import { FileIcon } from './file_icon.mjs';
import ExplorerApp, { FileEntry } from './main.mjs';

var Client: ClientClass;

interface FileIconMap {
	[path: string]: FileIcon;
}

export class FilePanel {
	app: ExplorerApp;
	zoom: number;
	fileEntries: any;
	fileIcons: FileIconMap;
	sorting: string;
	selectionMode: string;
	selectedFiles: any[];
	selectedElems: any[];
	$files: $Element;
	$filesContainer: $Element;

	constructor(explorer: ExplorerApp) {
		Client = ClientClass.get();
		this.app = explorer;
		this.zoom = 1;
		this.fileEntries = null;
		this.fileIcons = {};
		this.$files = null;
		this.sorting = '';
		this.selectionMode = 'default';
		this.selectedFiles = [];
		this.selectedElems = [];
	}

	init() {
		this.$filesContainer = this.app.$app.find('.files-container');
		this.$files = this.app.$app.find('.files');

		// Configure touch gestures
		let hammer = new Hammer.Manager(this.app.$app[0], {
			recognizers: [
				[Hammer.Pinch, {}]
			]
		});

		let beginZoom = 1;
		hammer.on('pinchstart', (ev) => {
			beginZoom = this.zoom;
		});

		hammer.on('pinch', (ev) => {
			this.setZoom(beginZoom * ev.scale);
		});

		this.$filesContainer.on('wheel', (ev: WheelEvent) => {
			if (!ev.ctrlKey) return;
			
			let scale = ev.deltaY / 1000.0;
			this.setZoom(this.zoom - scale);

			ev.preventDefault();
		});
	}

	setContent(files: FileEntry[]) {
		this.fileEntries = files;
		this.fileIcons = {};
		this.$files.addClass('d-none');
		this.$files.empty();

		let isDir = (en) => {
			return (en[0].endsWith('/'))? 1 : 0;
		}

		// Sort files 
		switch (this.sorting) {
		case 'date':
			files.sort((a, b) => {
				let dirA = isDir(a);
				let dirB = isDir(b);
				if (dirA == dirB) {
					return b[2] - a[2];
				} else {
					return dirA ? -1 : 1;
				}
			});
			break;

		// By default, sort alphabetically
		default:
			files.sort((a, b) => {
				let A = isDir(a);
				let B = isDir(b);
				if (A == B) return a[0].localeCompare(b[0]);
				return B - A;
			});
		}

		// Make icons
		for (let file of files) {
			let icon = this.makeFileIcon(file);
			this.fileIcons[file[0]] = icon;

			this.$files.append(icon.$icon);
		}	

		// Make the panel visible
		this.$files.removeClass('d-none');
		this.recalculateIcons();
	}

	makeFileIcon(fEntry: FileEntry) {
		let fileIcon = new FileIcon(this.app, fEntry);

		// Clicking behavior
		fileIcon.$icon.click(() => {
			if (Client.desktop.contextMenuOpen) return;
			if (this.selectionMode == 'default') {
				this.app.openHandler(fileIcon.absolutePath);
				return;
			}

			switch(this.selectionMode) {
			case 'one':
				if (fileIcon.$icon.hasClass('selected')) {
					this.selectedFiles = [];
					this.selectedElems = [];
				} else {
					for (let $el of this.selectedElems) {
						$el.removeClass('selected');
					};	
					this.selectedFiles = [fileIcon.absolutePath];
					this.selectedElems = [fileIcon.$icon];
				}
				break;
			case 'many':
				let i = this.selectedFiles.indexOf(fileIcon.absolutePath);
				if (i == -1) {
					this.selectedFiles.push(fileIcon.absolutePath);
					this.selectedElems.push(fileIcon.$icon);
				} else {
					this.selectedFiles.splice(i, 1);
					this.selectedElems.splice(i, 1);
				}
				break;
			}
			fileIcon.$icon.toggleClass('selected');
		});

		fileIcon.$icon.dblclick(() => {
			if (this.selectionMode != 'default') {
				this.app.openHandler(fileIcon.absolutePath);
			}
		});

		Client.desktop.addCtxMenuOn(fileIcon.$icon, () => fileIcon.createContextMenu());
		return fileIcon;
	}

	recalculateIcons() {
		let iw = 128 * this.zoom;

		let w = this.$files.width();
		let icons = Math.floor(w / iw); // How many icons fit vertically
		let tm = w - icons * iw - 2;    // Remaining space
		let m = tm / icons / 2;         // Divide remaining space as margin
		this.$files.css('--icon-border', m + 'px');
	}

	setZoom(v: number) {
		if (v < 0.2) v = 0.2;
		if (v > 5) v = 5;
		this.zoom = v;
		this.$files.css('--icon-width', 128 * v + 'px');
		this.$files.css('--icon-height', 96 * v + 'px');
		this.recalculateIcons();
	}

	filter(query: string) {
		if (!query) {
			this.$files.children().removeClass('hidden');
			return;
		}
		this.$files.children().each((i, el) => {
			let $el = $(el);
			let fname = $el.find('span').text().toLowerCase();
			if (fname.includes(query)) {
				$el.removeClass('hidden')
			} else {
				$el.addClass('hidden');
			}
			return true;
		});
	}

	sortBy(what: string) {
		this.sorting = what;
		this.setContent(this.fileEntries);
	}
}