import LocalClipboard from '/res/js/clipboard.mjs';
import Dialogs from '/res/js/ui/dialogs.mjs';
import { CtxMenu, CtxItem, CtxCheck } from '/res/js/ui/context_menu.mjs';
import { FileSystem, Paths } from '/res/js/bridges/filesystem.mjs';
import { Deferred } from '/res/js/events.mjs';
import Util from '/@sys/util.mjs';

import { FilePanel } from './file_panel.mjs';
import ExplorerUploader from './uploader.mjs';
import ExplorerDefaultHandler from './open_handler.mjs';
import ExplorerProperties from './properties.mjs';

export default class ExplorerApp extends App {
	constructor(...args) {	
		super(...args);
		this.window = null;
		this.cwd = null;
		this.typeAssociations = {};
		this.favorites = [];
		this.closingDeferred = new Deferred();
		this.history = new History();
		this.history.save();
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

		this.window.on('closed', () => this.exit());
		this.window.on('backnav', () => this.goUp());

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
		this.$collections = $app.find('.collections');

		// Setup file panel
		this.panel.init();

		// Setup events
		this.$addressField.on('change', () => {
			this.go(this.$addressField.val());
		});
		$app.find('.back-btn').click(() => this.goBack());
		$app.find('.up-btn').click(() => this.goUp());
		$app.find('.refresh-btn').click(() => this.refresh());
		$app.find('.favorites-btn').click(() => {
			$app.find('aside').toggleClass('hidden');
			this.panel.recalculateIcons();
		});
		$app.find('.search-field').on('change', () => this.searchFiles());
		this.window.on('resize', () => this.panel.recalculateIcons());

		// Context menus
		let $filesContainer = $app.find('.files-container');
		Client.desktop.addCtxMenuOn($filesContainer, () => CtxMenu([
			CtxMenu([
				CtxItem('Name', () => this.panel.sortBy('name')),
				CtxItem('Date', () => this.panel.sortBy('date'))
			], "Sort by"),
			'-',
			CtxItem('Paste', () => this.paste()).setEnabled(this.canPaste()),
			CtxItem('Upload...', () => this.openUploadDialog()),
			'-',
			CtxMenu([
				CtxItem('Directory', () => this.create('dir')),
				CtxItem('Text File', () => this.create('text'))
			], "Create"),
		]));

		let $sidePanel = $app.find('aside');

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
		this.history.save();
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

	async go(path) {
		// If cancel fetches is enabled, remove src attribute of every image
		// but save the sources in another attribute in case the navigation fails.
		if (this.cancelFetches) {
			this.panel.$files.find('img').each((i, el) => {
				let src = el.getAttribute('src');;
				el.dataset.haltSrc = src;
				el.setAttribute('src', '');
			});
		}

		if (path.startsWith('$')) {
			this.openCollection(path.substring(1));
			return;
		}

		this.$addressField.val(path);

		// Fetching and fetch error handling
		let fres = await fetch('/fsv' + path);
		if (fres.status != 200) {
			let code = fres.status;
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

		let files = await fres.json();
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
		Util.arrErase(this.favorites, path);

		this.saveFavorites();
		this.refreshFavorites();
	}
	
	refreshFavorites() {
		this.$favorites.empty();

		for (let path of this.favorites) {
			let fname = Paths.file(path).replace('/', '');
			let $item = $('<li>' + fname + '</li>');
			$item.click(() => {
				this.openHandler(path);
			});
			Client.desktop.addCtxMenuOn($item, () => CtxMenu([
				CtxItem('Remove', () => this.removeFavorite(path))
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

	copy(path) {
		LocalClipboard.saveObject('path', { 
			operation: "copy",
			path: path
		});
	}

	cut(path) {
		LocalClipboard.saveObject('path', { 
			operation: "cut",
			path: path
		});
	}

	// Returns whether there is a copy/cut operation in the clipboard
	canPaste() {
		let type = LocalClipboard.getType();
		if (type != 'path') return false;

		let op = LocalClipboard.getObject();
		return op.operation == 'cut' || op.operation == 'copy';
	}

	async paste() {
		if (!this.canPaste()) return;

		let obj = LocalClipboard.getObject();
		let from = obj.path;
		let to = this.cwd + Paths.file(from);

		let op = obj.operation;
		if (op == 'cut') {
			LocalClipboard.clear();

			await FileSystem.rename(from, to);
		} else if (op == 'copy') {
			await FileSystem.copy(from, to);
		}

		this.refresh();
	}

	async create(type) {
		let fileName;

		switch (type) {
		case 'text':
			fileName = 'New Text File.txt';
			await FileSystem.writeText(this.cwd + fileName, '');
			await this.refresh();
			this.panel.enableRename(this.cwd + fileName);
			break;

		case 'dir':
			fileName = 'New Directory/';
			await FileSystem.makeDirectory(this.cwd + fileName);
			await this.refresh();
			this.panel.enableRename(this.cwd + fileName);
			break;
		}
	}

	async erase(path) {
		let file = Paths.file(path);
		let msg;
		if (path.endsWith('/')) {
			msg = `This will permanently delete the folder:\n"${file}"\n and everything inside of it.\n\nAre you sure?`;
		} else {
			msg = `This will permanently delete:\n"${file}".\n\nAre you sure?`;
		}

		let [win, prom] = Dialogs.showOptions(this, "Erase", msg, ['Yes', 'No'], {
			icon: 'warning'
		});

		let opt = await prom;
		if (opt === 0) {
			await FileSystem.erase(path);
			this.refresh();
		}
	}

	openFileProperties(path) {
		let dialog = new ExplorerProperties(this);
		dialog.open(path);
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