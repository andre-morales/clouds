import { ClientClass } from '/@sys/client_core.mjs';
import { FileIcon } from './file_icon.mjs';
import ExplorerApp from './explorer.mjs';
import { ContextMenu } from '/@sys/ui/controls/context_menu/ctx_menu.mjs';
import Arrays from '/@comm/arrays.mjs';
import { FileEntry } from './file_entry.mjs';

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

export enum SortingMode {
	DEFAULT, NAME, DATE, SIZE
}

export class FilePanel {
	private app: ExplorerApp;
	private zoom: number;
	private pointerBehaviors: Map<PointerAction, PointerBehavior>;
	private fileEntries: FileEntry[];
	fileIcons: FileIconMap;
	selectionMode: string;
	selectedFiles: string[];
	selectedIcons: FileIcon[];
	$files: $Element;
	private $filesContainer: $Element;
	private $selectionOptions: $Element;
	private $selectionStatus: $Element;
	private sorting: SortingMode;

	constructor(explorer: ExplorerApp) {
		this.app = explorer;
		this.zoom = 1;
		this.fileEntries = null;
		this.fileIcons = {};
		this.$files = null;
		this.sorting = SortingMode.NAME;
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

	public init() {
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

			let menu = ContextMenu.fromDefinition([
				['-Select all', () => this.selectAll()],
				['|'],
				['-Copy',  () => this.app.copy(getSelectedPaths())],
				['-Cut',   () => this.app.cut(getSelectedPaths())],
				['-Erase', () => this.app.erase(getSelectedPaths())],
			]);

			ClientClass.get().desktop.openCtxMenuAt(menu, ev.clientX, ev.clientY);
		});
	}

	public setContent(files: FileEntry[]) {
		this.fileEntries = files;
		this.fileIcons = {};
		this.$files.addClass('d-none');
		this.$files.empty();
		this.clearSelection();

		// Select the appropriate comparator function based on the criterion
		let comparator = this.getSortingComparator();

		// Invoke the sorting on the files array 
		files.sort((a, b) => {
			let dirA = a.isFolder();
			let dirB = b.isFolder();

			// If one is a file and the other is a folder, have the folder come first
			if (dirA != dirB) return dirA ? -1 : 1;

			// Use the comparator according to the criteria
			return comparator(a, b);
		});

		// Make icons
		for (let file of files) {
			let icon = this.makeFileIcon(file);
			this.fileIcons[file.path] = icon;

			this.$files.append(icon.$icon);
		}	

		// Make the panel visible
		this.$files.removeClass('d-none');
		this.readjustIcons();
	}

	public performSelection(fileIcon: FileIcon, single: boolean) {
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

	public readjustIcons() {
		let iw = 128 * this.zoom;

		let w = this.$files.width();
		let icons = Math.floor(w / iw); // How many icons fit vertically
		let tm = w - icons * iw - 2;    // Remaining space
		let m = tm / icons / 2;         // Divide remaining space as margin
		this.$files.css('--icon-border', m + 'px');
	}

	public setZoom(v: number) {
		if (v < 0.2) v = 0.2;
		if (v > 5) v = 5;
		this.zoom = v;
		this.$files.css('--icon-width', 128 * v + 'px');
		this.$files.css('--icon-height', 96 * v + 'px');
		this.readjustIcons();
	}

	public filter(query: string) {
		// On empty search queries, unhide all file icons
		if (!query) {
			this.$files.children().removeClass('hidden');
			return;
		}

		// Iterate over all file icons, deciding whether they should be hidden or not
		for (let fi of Object.values(this.fileIcons)) {
			let hide = !fi.fileName.includes(query);
			fi.$icon.toggleClass('hidden', hide);
		}
	}

	public sortBy(what: SortingMode) {
		this.sorting = what;
		this.setContent(this.fileEntries);
	}

	private getSortingComparator(): (a: FileEntry, b: FileEntry) => number {
		switch (this.sorting) {
		case SortingMode.NAME:
			return (a, b) => a.path.localeCompare(b.path);
		case SortingMode.DATE:
			return (a, b) => b.creation - a.creation;
		case SortingMode.SIZE:
			return (a, b) => b.size - a.size;
		}
	}

	private updateSelectionStatus() {
		let text = "";
		if (this.selectedIcons.length > 0) {
			text = `${this.selectedIcons.length} items selected`;
		}
		this.$selectionStatus.text(text);
	}

	private makeFileIcon(fEntry: FileEntry) {
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

	private executeBehavior(behavior: PointerBehavior, fileIcon: FileIcon, ev?: MouseEvent) {
		let noSelectedItem = this.selectedIcons.length == 0;
		let onlySelectedItem = Arrays.equals(this.selectedIcons, [fileIcon]);

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
			let menu = fileIcon.makeContextMenu();
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

	private selectAll() {
		this.selectedIcons = [];
		this.selectedFiles = [];
		for (let icon of Object.values(this.fileIcons)) {
			this.selectedIcons.push(icon);
			this.selectedFiles.push(icon.absolutePath);
			icon.$icon.addClass('selected');
		}
		this.updateSelectionStatus();
	}

	private selectIcon(icon: FileIcon) {
		this.selectedIcons.push(icon);
		this.selectedFiles.push(icon.absolutePath);
		icon.$icon.addClass('selected');
		this.updateSelectionStatus();
	}

	private unselectIcon(icon: FileIcon) {
		let i = this.selectedIcons.indexOf(icon);
		if (i != -1) { 
			this.selectedFiles.splice(i, 1);
			this.selectedIcons.splice(i, 1);
			icon.$icon.removeClass('selected');
		}
		this.updateSelectionStatus();
	}

	private clearSelection() {
		this.$selectionOptions.removeClass('visible');
		for (let icon of this.selectedIcons) {
			icon.$icon.removeClass('selected');
		}		
		this.selectedFiles = [];
		this.selectedIcons = [];
	}
}