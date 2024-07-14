import { ClientClass } from '/@sys/client_core.mjs';
import { FileIcon } from './file_icon.mjs';
import ExplorerApp, { FileEntry } from './explorer.mjs';
import Util from '/@sys/util.mjs';
import { CtxMenuClass } from '/@sys/ui/context_menu.mjs';

interface FileIconMap {
	[path: string]: FileIcon;
}

enum PointerAction {
	CLICK,
	DBL_CLICK,
	R_CLICK
}

enum PointerBehavior {
	NOTHING,
	/** Open the clicked file regardless of selection status. */
	OPEN,

	/**
	 * Open the file if no other files are selected. Replace the selection with this file.
	 * Additionally, add this file to the selection if CTRL is pressed.
	 */
	OPEN_OR_SELECT_ONE,

	/**
	 * Open the file if no other files are selected. If there is an active selection, a single 
	 * click will add a file to the selection.
	 */
	OPEN_OR_SELECT_MANY,

	/** Replace the current selection with this file, or add it to the selection if the user is
	 * holding CTRL. */
	SELECT_ONE,

	/** Add this file to the selection. */
	SELECT_MANY,

	/** Open the context menu for this file. */
	CTX_MENU
}

export class FilePanel {
	app: ExplorerApp;
	zoom: number;
	pointerBehaviors: Map<PointerAction, PointerBehavior>;
	fileEntries: any;
	fileIcons: FileIconMap;
	sorting: string;
	selectionMode: string;
	selectedFiles: string[];
	selectedIcons: FileIcon[];
	$files: $Element;
	$filesContainer: $Element;
	$selectionOptions: $Element;
	$selectionStatus: $Element;

	constructor(explorer: ExplorerApp) {
		this.app = explorer;
		this.zoom = 1;
		this.fileEntries = null;
		this.fileIcons = {};
		this.$files = null;
		this.sorting = '';
		this.selectionMode = 'default';
		this.selectedFiles = [];
		this.selectedIcons = [];
		this.pointerBehaviors = new Map<PointerAction, PointerBehavior>();
		
		// PC
		/*this.pointerBehaviors.set(PointerAction.CLICK, PointerBehavior.SELECT_ONE_OR_MANY);
		this.pointerBehaviors.set(PointerAction.R_CLICK, PointerBehavior.CTX_MENU);
		this.pointerBehaviors.set(PointerAction.DBL_CLICK, PointerBehavior.OPEN);*/

		// Phone
		/*this.pointerBehaviors.set(PointerAction.CLICK, PointerBehavior.OPEN_OR_SELECT);
		this.pointerBehaviors.set(PointerAction.R_CLICK, PointerBehavior.SELECT_MANY);
		this.pointerBehaviors.set(PointerAction.DBL_CLICK, PointerBehavior.NOTHING);*/

		// Hybrid
		this.pointerBehaviors.set(PointerAction.CLICK, PointerBehavior.OPEN_OR_SELECT_MANY);
		this.pointerBehaviors.set(PointerAction.R_CLICK, PointerBehavior.CTX_MENU);
		this.pointerBehaviors.set(PointerAction.DBL_CLICK, PointerBehavior.OPEN);
	}

	init() {
		this.$filesContainer = this.app.$app.find('.files-container');
		this.$files = this.app.$app.find('.files');
		this.$selectionOptions = this.app.$app.find('.selection-options');
		this.$selectionStatus = this.$selectionOptions.find('.selection-status');

		// Configure touch gestures
		let hammer = new Hammer.Manager(this.app.$app[0], {
			recognizers: [
				[Hammer.Pinch, {}]
			]
		});

		// Zoom on pinch
		let beginZoom = 1;
		hammer.on('pinchstart', (ev) => {
			beginZoom = this.zoom;
		});

		hammer.on('pinch', (ev) => {
			this.setZoom(beginZoom * ev.scale);
		});

		// Zoom on mouse wheel
		this.$filesContainer.on('wheel', (ev: WheelEvent) => {
			if (!ev.ctrlKey) return;
			
			let scale = ev.deltaY / 1000.0;
			this.setZoom(this.zoom - scale);

			ev.preventDefault();
		});

		this.$selectionOptions.find('.clear-selection-btn').click(() => {
			this.clearSelection();
		});

		this.$selectionOptions.find('.context-btn').click((ev: MouseEvent) => {
			// Returns an array of the absolute paths of all the files selected
			let getSelectedPaths = () => this.selectedIcons.map(icon => icon.absolutePath);

			let menu = CtxMenuClass.fromEntries([
				['-Select all', () => this.selectAll()],
				['|'],
				['-Copy',  () => this.app.copy(getSelectedPaths())],
				['-Cut',   () => this.app.cut(getSelectedPaths())],
				['-Erase', () => this.app.erase(getSelectedPaths())],
			]);

			ClientClass.get().desktop.openCtxMenuAt(menu, ev.clientX, ev.clientY);
		});
	}

	setContent(files: FileEntry[]) {
		this.fileEntries = files;
		this.fileIcons = {};
		this.$files.addClass('d-none');
		this.$files.empty();
		this.clearSelection();

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
		
		// Behaviors
		fileIcon.$icon.click((ev: MouseEvent) => {
			this.executeBehavior(this.pointerBehaviors.get(PointerAction.CLICK), fileIcon, ev);
		});
		fileIcon.$icon.dblclick((ev: MouseEvent) => {
			this.executeBehavior(this.pointerBehaviors.get(PointerAction.DBL_CLICK), fileIcon, ev);
		});
		fileIcon.$icon.on('contextmenu', (ev: MouseEvent) => {
			this.executeBehavior(this.pointerBehaviors.get(PointerAction.R_CLICK), fileIcon, ev);
			ev.preventDefault();
			ev.stopPropagation();
		});
		return fileIcon;
	}

	executeBehavior(behavior: PointerBehavior, fileIcon: FileIcon, ev?: MouseEvent) {
		let noSelectedItem = this.selectedIcons.length == 0;
		let onlySelectedItem = Util.arrEquals(this.selectedIcons, [fileIcon]);

		switch(behavior) {
		case PointerBehavior.OPEN:
			this.app.openHandler(fileIcon.absolutePath);
			break;
		case PointerBehavior.OPEN_OR_SELECT_ONE: {
			if (!ev.ctrlKey && (noSelectedItem || onlySelectedItem)) {
				this.app.openHandler(fileIcon.absolutePath);
			} else {
				this.performSelection(fileIcon, !ev.ctrlKey);
			}
			break;
		}
		case PointerBehavior.OPEN_OR_SELECT_MANY:
			if (!ev.ctrlKey && noSelectedItem) {
				this.app.openHandler(fileIcon.absolutePath);
			} else {
				this.performSelection(fileIcon, false);
			}
			break;
		case PointerBehavior.CTX_MENU:
			let menu = fileIcon.createContextMenu();
			ClientClass.get().desktop.openCtxMenuAt(menu, ev.clientX, ev.clientY);
			break;
		case PointerBehavior.SELECT_ONE:
			this.performSelection(fileIcon, !ev.ctrlKey);
			break;
		case PointerBehavior.SELECT_MANY:
			this.performSelection(fileIcon, false);
			break;
		}
	}

	selectAll() {
		this.selectedIcons = [];
		this.selectedFiles = [];
		for (let icon of Object.values(this.fileIcons)) {
			this.selectedIcons.push(icon);
			this.selectedFiles.push(icon.absolutePath);
			icon.$icon.addClass('selected');
		}
		this.#updateSelectionStatus();
	}

	performSelection(fileIcon: FileIcon, single: boolean) {
		// On single selection mode, only keep a single file selected
		if (single || this.selectionMode == 'one') {
			this.clearSelection();
			this.selectIcon(fileIcon);
		} else {
			// On multi-selection mode, flip the selection status
			if (this.selectedIcons.includes(fileIcon)) {
				this.unselectIcon(fileIcon);
			} else {
				this.selectIcon(fileIcon);
			}			
		}
		
		// The options bar should be visible if at least one item is selected
		this.$selectionOptions.toggleClass('visible', (this.selectedIcons.length > 0));
	}

	selectIcon(icon: FileIcon) {
		this.selectedIcons.push(icon);
		this.selectedFiles.push(icon.absolutePath);
		icon.$icon.addClass('selected');
		this.#updateSelectionStatus();
	}

	unselectIcon(icon: FileIcon) {
		let i = this.selectedIcons.indexOf(icon);
		if (i != -1) { 
			this.selectedFiles.splice(i, 1);
			this.selectedIcons.splice(i, 1);
			icon.$icon.removeClass('selected');
		}
		this.#updateSelectionStatus();
	}

	clearSelection() {
		this.$selectionOptions.removeClass('visible');
		for (let icon of this.selectedIcons) {
			icon.$icon.removeClass('selected');
		}		
		this.selectedFiles = [];
		this.selectedIcons = [];
	}

	#updateSelectionStatus() {
		let text = "";
		if (this.selectedIcons.length > 0) {
			text = `${this.selectedIcons.length} items selected`;
		}
		this.$selectionStatus.text(text);
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