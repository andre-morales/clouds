import LocalClipboard from '/@sys/bridges/clipboard.mjs';
import Dialogs from '/@sys/ui/dialogs.mjs';
import { ContextMenu } from '/@sys/ui/context_menu.mjs';
import { FileSystem, Paths } from '/@sys/bridges/filesystem.mjs';
import { Deferred } from '/@sys/events.mjs';
import App from '/@sys/app.mjs';
import Window from '/@sys/ui/window.mjs';
import { ClientClass } from '/@sys/client_core.mjs';
import { FilePanel } from './file_panel.mjs';
import ExplorerUploader from './uploader.mjs';
import ExplorerDefaultHandler from './open_handler.mjs';
import ExplorerProperties from './properties_dialog.mjs';
import { FileOperation, FileOperationKind } from './file_operation.mjs';
import Arrays from '/@sys/utils/arrays.mjs';
import Utils from '/@sys/utils/utils.mjs';

/** If an operation finished this fast, automatically refresh explorer */
const OPERATION_REFRESH_TIMEOUT = 200;

/** Hide away finished operations after this amount of time */
const OPERATION_HIDE_DELAY = 4000;

/** If trying to delete more files than this, don't show their names */
const LIST_FILES_LIMIT = 32;

var Client: ClientClass;

export type FileEntry = any[];

export default class ExplorerApp extends App {
	window: Window;
	cwd: string;
	typeAssociations: any;
	favorites: any;
	closingDeferred: Deferred;
	history: History;
	panel: FilePanel;
	cancelFetches: boolean;
	canceledFetches: any;
	doneClicked: boolean;
	$app: $Element;
	$filePanel: $Element;
	$addressField: $Element;
	$favorites: $Element;
	$fileOperations: $Element;

	constructor(...args: ConstructorParameters<typeof App>) {	
		super(...args);
		Client = ClientClass.get();
		this.window = null;
		this.cwd = null;
		this.typeAssociations = {};
		this.favorites = [];
		this.closingDeferred = new Deferred();
		this.history = new History();
		this.panel = new FilePanel(this);
		this.cancelFetches = true;
		this.canceledFetches = new Map();
	}

	async init() {
		if (this.window) return;

		// Create window and fetch app body
		this.window = Client.desktop.createWindow(this);
		this.window.setTitle('File Explorer');
		this.window.setVisible(true);

		this.window.on('backnav', () => this.goUp());
		this.window.on('closed', () => this.exit());
		this.on('exit', () => {
			this.closingDeferred.resolve();
		});

		let $app = this.window.$window.find('.window-body');
		this.$app = $app;
		$app.addClass('app-explorer');

		// Fetch explorer body
		await this.window.setContentToUrl('/app/explorer/res/main.html');

		// Query DOM
		this.$filePanel = $app.find('.files-container');
		this.$addressField = $app.find('.address-field');
		this.$favorites = $app.find('.favorites');
		this.$fileOperations = $app.find('.file-operations-list');

		// Setup file panel
		this.panel.init();
		this.window.on('resize', () => this.panel.recalculateIcons());

		// Upper options bar
		this.$addressField.on('change', () => {
			this.go(this.$addressField.val());
		});
		$app.find('.menu-btn').click(() => {
			$app.find('aside').toggleClass('hidden');
			this.panel.recalculateIcons();
		});
		$app.find('.back-btn').click(() => this.goBack());
		$app.find('.up-btn').click(() => this.goUp());
		$app.find('.refresh-btn').click(() => this.refresh());
		$app.find('.search-field').on('change', () => this.searchFiles());
		$app.find('.search-btn').click(() => {
			$app.find('.search-field').focus();
		});

		// Aside links
		$app.find('.dir-context-btn').click((ev: MouseEvent) => {
			let menu = this.getFolderContextMenu();
			ClientClass.get().desktop.openCtxMenuAt(menu, ev.clientX, ev.clientY);
		});
		$app.find('.root-link').click(() => this.go('/'));

		// Context menus
		let $filesContainer = $app.find('.files-container');
		Client.desktop.addCtxMenuOn($filesContainer, () => this.getFolderContextMenu());

		// Read file type associations. Fail silently if the file doesn't exist.
		try {
			this.typeAssociations = await FileSystem.readJson('/usr/.system/ftype_defaults.json');
		} catch (err) {}
		
		// Final preparation
		this.loadFavorites().then(() => {
			this.refreshFavorites();
		});

		// Make the window visible
		this.window.focus();
		this.window.setVisible(true);
		
		// Go to the root directory and save it in history
		await this.goHome();
		this.history.save(this.cwd);
	}

	getFolderContextMenu() {
		return ContextMenu.fromDefinition([
			['>Sort by', [
				['-Name', () => this.panel.sortBy('name')],
				['-Date', () => this.panel.sortBy('date')]
			]],
			['|'],
			['-Paste', () => this.paste(), { disabled: !this.canPaste() }],
			['-Upload...', () => this.openUploadDialog()],
			['|'],
			['>Create', [
				['-Directory', () => this.create('dir')],
				['-Text File', () => this.create('text')]
			]],
		]);
	}

	async openUploadDialog() {
		let uploader = new ExplorerUploader(this);
		uploader.open();
	}

	goBack() {
		let path = this.history.goBack();
		if (path) this.go(path);
	}

	goUp() {
		let path = this.getNavPath('..');
		this.go(path);
		this.history.save(path);
	}

	async refresh() {
		await this.navigate('.');
	}

	searchFiles() {
		let query = this.window.$window.find('.search-field').val();
		if (query.length == 0) {
			this.panel.filter("");
			return;
		}

		this.panel.filter(query.toLowerCase());
	}

	asFileSelector(mode, selectionMode) {
		this.panel.selectionMode = selectionMode;
		let $win = this.window.$window;

		if (mode == 'open') {
			$win.find('.choose-options').removeClass('d-none');
			$win.find('.select').click(() => {
				this.doneClicked = true;
				this.window.close();
				this.exit();
			});
		}
		if (mode == 'save') {
			$win.find('.save-options').removeClass('d-none');
			$win.find('.save').click(() => {
				let fileName = $win.find('.name-field').val();
				
				this.panel.selectedFiles = [this.cwd + fileName];
				this.doneClicked = true;
				this.window.close();
				this.exit();
			});
		}
	}

	async waitFileSelection() {
		await this.closingDeferred.promise;

		if (this.doneClicked) return this.panel.selectedFiles;
		return null;
	}

	getNavPath(path) {
		if (path == '.') return this.cwd;

		let p = Paths.join(this.cwd, path);
		if (p == '/..') return '/';
		return p;
	}

	async navigate(path) {
		await this.go(this.getNavPath(path));
	}

	async go(path: string) {
		// If cancel fetches is enabled, remove src attribute of every image
		// but save the sources in another attribute in case the navigation fails.
		if (this.cancelFetches) {
			this.panel.$files.find('img').each((i, el) => {
				let src = el.getAttribute('src');;
				el.dataset.haltSrc = src;
				el.setAttribute('src', '');
				return true;
			});
		}

		this.$addressField.val(path);

		// Fetching and fetch error handling
		let url = Paths.toURL(Paths.toFSV(path));
		let fRes = await fetch(url);
		if (fRes.status != 200) {
			let code = fRes.status;
			let msg = '';
			switch (code) {
				case 400:
					msg = "No mapping."; break;
				case 404:
					msg = "Could't find."; break;
				case 403:
					msg = "Not allowed to access."; break;
				case 500:
					msg = "Failed to query."; break;
			}

			Dialogs.showError(this, "Explorer", `${msg}\nPath: "${path}"`);
			this.$addressField.val(this.cwd);

			// If cancel fetches was enabled, restore thumb image sources on navigation failure
			if (this.cancelFetches) {
				this.panel.$files.find('img').each((i, el) => {
					let src = el.dataset.haltSrc;
					el.setAttribute('src', src);
					return true;
				});
			}
			return code;
		}

		this.cwd = path;
		
		// UI changes		
		if (path == '/') {
			this.window.setTitle('File Explorer');
		} else {
			let fname = path;
			if (path.endsWith('/')) fname = path.slice(0, -1)

			fname = fname.slice(fname.lastIndexOf('/') + 1);
			this.window.setTitle(fname);
		}

		let files: FileEntry[] = await fRes.json();
		this.panel.setContent(files);
	}

	async goHome() {
		this.history.save('/');
		await this.go('/');
	}

	async openHandler(path) {
		// If it's a folder
		if (path.endsWith('/')) {
			this.go(path);
			this.history.save(path);
			return;
		}

		let fsPath = '/fsv' + path;

		// Query file extension if it has one
		let i = path.lastIndexOf('.');
		if (i != -1) {
			// Find the app associated based on the extension
			let ext = path.substring(i + 1);
			let appId = this.typeAssociations[ext];

			if (appId) {
				let app = await Client.runApp(appId, [fsPath]);
				
				// If the app launch failed, do nothing, as the user will already be notified of any errors
				if (!app) return;

				// If the app launched with a main window, bring it to front
				if (!app.mainWindow) return;
				app.mainWindow.bringToFront();
				app.mainWindow.focus();
				return;
			}
		}

		// If there was no extension or no app associated with this file, open file handler dialog
		this.openDefaultHandler(path);
	}

	// Favorites 
	addFavorite(path) {
		this.favorites.push(path);

		this.saveFavorites();
		this.refreshFavorites();
	}

	removeFavorite(path) {
		Arrays.erase(this.favorites, path);

		this.saveFavorites();
		this.refreshFavorites();
	}
	
	refreshFavorites() {
		this.$favorites.empty();

		for (let path of this.favorites) {
			let fname = Paths.file(path).replace('/', '');
			let $item = $('<li>' + fname + '</li>', {
				class: 'link'
			});
			$item.click(() => {
				this.openHandler(path);
			});
			Client.desktop.addCtxMenuOn($item, () => ContextMenu.fromDefinition([
				['-Remove', () => this.removeFavorite(path)]
			]));
			this.$favorites.append($item);
		}
	}

	async saveFavorites() {
		await FileSystem.writeJson('/usr/.system/favorites.json', this.favorites);
	}

	async loadFavorites() {
		try {
			this.favorites = await FileSystem.readJson('/usr/.system/favorites.json');
		} catch (err) {
			this.favorites = [];
		}
	}

	/**
	 * Puts in the clipboard an array of paths to copy.
	 * @param paths An array of absolute paths to copy.
	 */
	copy(paths: string[]) {
		LocalClipboard.saveObject('path-array', { 
			operation: "copy",
			paths: paths
		});
	}

	cut(paths: string[]) {
		LocalClipboard.saveObject('path-array', { 
			operation: "cut",
			paths: paths
		});
	}

	// Returns whether there is a copy/cut operation in the clipboard
	canPaste() {
		let type = LocalClipboard.getType();
		if (type != 'path' && type != 'path-array') return false;

		let op = LocalClipboard.getObject();
		return op.operation == 'cut' || op.operation == 'copy';
	}

	async paste() {
		if (!this.canPaste()) return;

		let cliType = LocalClipboard.getType();
		let cliObj = LocalClipboard.getObject();

		let paths = cliObj.paths;
		let operationType = cliObj.operation;

		if (cliType !== 'path-array') return;

		let operation = new FileOperation(paths);
		if (operationType == 'copy') {
			operation.copyTo(this.cwd);
		} else if (operationType == 'cut'){
			operation.cutTo(this.cwd);
			LocalClipboard.clear();
		}

		this.doFileOperation(operation);	
	}

	async create(type: string) {
		let fileName: string;
		switch (type) {
		case 'text': 
			fileName = 'New Text File.txt';
			await FileSystem.writeText(this.cwd + fileName, '');
			break;
		case 'dir':
			fileName = 'New Directory/';
			await FileSystem.makeDirectory(this.cwd + fileName);
			break;
		}

		await this.refresh();
		let icon = this.panel.fileIcons[fileName];
		icon.enableRename();
	}

	async erase(paths: string[]) {
		const count = paths.length;

		// Make sure all files come from the same directory, otherwise, don't allow operation.
		let parent = Paths.parent(paths[0]);
		for (let p of paths) {
			if (parent != Paths.parent(p)) throw new Error("Bad file operation! Erase shouldn't erase files from different directories!");
		}

		// Determine the message that will show up in the confirmation box
		let msg: string;
		if (count == 1) {
			let file = paths[0];
			if (file.endsWith('/')) {
				msg = `This will permanently delete the folder:\n"${file}"\n and everything inside of it.\n\nAre you sure?`;
			} else {
				msg = `This will permanently delete:\n"${file}".\n\nAre you sure?`;
			}	
		} else if (count <= LIST_FILES_LIMIT) {
			// Sort the file names making sure directories always appear on top
			let fileNames = paths.map(p => Paths.file(p));
			fileNames.sort((a, b) => {
				let aDir = a.endsWith('/');
				let bDir = b.endsWith('/');
				if (aDir != bDir) return aDir ? -1 : 1;
				return a.localeCompare(b);
			});

			// Append the file names to the message, directories appear in bold and italics.
			msg = `This will permanently delete these ${count} items:\n`;
			for (let name of fileNames) {
				if (name.endsWith('/')) {
					msg += `<b><i>\n${name}</i></b>`;
				} else {
					msg += `\n${name}`;
				}
			}
			msg += '\n\nAre you sure?';
		} else {
			msg = `This will permanently delete ${count} items.\n\nAre you sure?`;
		}

		let [prom] = Dialogs.showOptions(this, "Delete", msg, ['Yes, delete', 'Cancel'], {
			icon: 'warning'
		});

		// Await for the user to confirm the operation.
		let opt = await prom;
		if (opt !== 0) return;

		let operation = new FileOperation(paths);
		operation.erase();
		this.doFileOperation(operation);
	}

	doFileOperation(operation: FileOperation) {
		operation.getCompletionPromise(OPERATION_REFRESH_TIMEOUT)
		.then(() => this.refresh())
		.catch(() => {});

		// Text description for the operation
		let description = "";
		switch(operation.kind) {
			case FileOperationKind.COPY: description += 'Copy'; break;
			case FileOperationKind.CUT: description += 'Cut'; break;
			case FileOperationKind.ERASE: description += 'Delete'; break;
			default: description += "? ";
		}
		description += ` ${operation.sources.length} items`;

		// Create list item element
		let $operation = $(`<li class='file-operation'></li>`);
		let $description = $(`<span>${description}</span>`).appendTo($operation);
		let $progress = $('<progress></progress>').appendTo($operation);
		this.$fileOperations.prepend($operation);

		// Update progress as sub-operations continue
		operation.onProgress = (v) => { $progress.val(v); };

		// Hide and remove the item once the operation is finished
		operation.wholePromise.then(async () => {
			$description.text(description + ". Done!");
			await Utils.sleep(OPERATION_HIDE_DELAY);
			$operation.addClass('hide');
			await Utils.sleep(500);
			$operation.remove();
		});		
	}

	openDefaultHandler(path) {
		let dialog = new ExplorerDefaultHandler(this);
		dialog.open(path);
	}

	openFileWith(path) {
		let dialog = new ExplorerDefaultHandler(this);
		dialog.openFileWith(path);
	}

	openFileExt(path) {
		window.open(Paths.toFSV(path), '_blank').focus();
	}

	closePromise() {
		return this.closingDeferred.promise;
	}
}	

class History {
	log: string[];
	logIndex: number;

	constructor() {
		this.log = [];
		this.logIndex = -1;		
	}

	save(entry) {
		this.logIndex++;

		if (this.logIndex == this.log.length) {
			this.log.push(entry);
		} else {
			this.log[this.logIndex] = entry;
			this.log.length = this.logIndex+1;
		}
	}

	goBack() {
		if (this.logIndex <= 0) return null;

		return this.log[--this.logIndex];
	}
}