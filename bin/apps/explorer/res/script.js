'use strict';

window.ExplorerApp = class ExplorerApp extends App {
	constructor(args) {
		super(args);
		this.window = null;
		this.filesCount = 0;
		this.$files = null;
		this.cwd = null;
		this.selectionMode = 'default';
		this.selectedFiles = [];
		this.selectedElems = [];
		this.favorites = [];
		this.collections = {};
		this.collectionsMap = new Map();
		this.collectionsVisible = [];
		this.closingDeferred = new Deferred();
		this.subs();
		this.history.save();
		this.zoom = 1;
		this.typeAssociations = {
			'mp4': 'sinestesia',
			'webm': 'sinestesia',
			'mkv': 'sinestesia',
			'm4v': 'sinestesia',

			'weba': 'sinestesia',
			'm4a': 'sinestesia',
			'mp3': 'sinestesia',
			'wav': 'sinestesia',
			'ogg': 'sinestesia',
			'png': 'sinestesia',
			'jpg': 'sinestesia',
			'jpeg': 'sinestesia',
			'webp': 'sinestesia',

			'txt': 'notepad'
		}
	}

	async init() {
		if (this.window) return;

		// Require resources
		this.requireStyle('/app/explorer/res/style.css');

		// Create window and fetch app body
		this.window = WebSys.desktop.createWindow();
		this.window.setIcon('/res/img/ftypes/folder128.png');
		this.window.setTitle('File Explorer');
		this.window.on('closereq', () => this.close());
		this.window.on('backnav', () => this.goUp());

		let $app = this.window.$window.find('.window-body');
		this.$app = $app;
		$app.addClass('app-explorer');

		// Fetch explorer body
		await this.window.setContentToUrl('/app/explorer/res/main.html');

		// Query DOM
		this.$files = $app.find('.files');
		this.$addressField = $app.find('.address-field');
		this.$favorites = $app.find('.favorites');
		this.$collections = $app.find('.collections');

		// Setup events
		this.$addressField.on('change', () => {
			this.go(this.$addressField.val());
		});
		$app.find('.back-btn').click(() => this.goBack());
		$app.find('.up-btn').click(() => this.goUp());
		$app.find('.refresh-btn').click(() => this.navigate('.'));
		$app.find('.favorites-btn').click(() => {
			$app.find('aside').toggleClass('hidden');
			this.recalculateIcons();
		});
		$app.find('.search-field').on('change', () => this.searchFiles());
		this.window.on('resize', () => this.recalculateIcons());

		let $filesContainer = $app.find('.files-container');
		WebSys.desktop.addCtxMenuOn($filesContainer, () => CtxMenu([
			CtxItem('Paste', () => this.pasteFile()),
			CtxItem('Upload...', () => this.openUploadDialog())
		]));

		let $sidePanel = $app.find('aside');
		WebSys.desktop.addCtxMenuOn($sidePanel, () => CtxMenu([
			CtxItem('Create collection...', () => this.openCreateCollectionDialog())
		]));

		// Final preparation
		await this.loadFavorites();
		this.refreshFavorites();
		await this.loadCollections();
		this.recreateCollections();

		// Make the window visible
		this.window.bringToCenter();
		this.window.focus();
		this.restoreAppWindowState(this.window);
		this.window.setVisible(true);
		
		await this.goHome();

		this.history.save();

		let hammer = new Hammer.Manager(this.$app.find('.body')[0], {
			recognizers: [
				[Hammer.Pinch, {}]
			]
		});
		hammer.on('pinch', (ev) => {
			this.setZoom(ev.scale);
		});
	}

	async openUploadDialog() {
		let uploader = new ExplorerUploader(this);
		uploader.open();
	}

	async openCreateCollectionDialog() {
		let win = WebSys.desktop.createWindow();
		win.on('closereq', () => win.close());
		
		let $body = win.$window.find('.window-body');
		
		let $input = $('<input>')
		$body.append($input);

		let $save = $('<button>Save</button>')
		$save.click(() => {
			this.createCollection($input.val());
			win.close();
		});
		$body.append($save);

		win.setTitle('Create Collection');
		win.setSize(280, 200);
		win.bringToCenter();
		win.bringToFront();

		win.setVisible(true);
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

	recalculateIcons() {
		let iw = 128 * this.zoom;

		let w = this.$files.width();
		let icons = Math.floor(w / iw); // How many icons fit vertically
		let tm = w - icons * iw - 2;    // Remaining space
		let m = tm / icons / 2;         // Divide remaining space as margin
		this.$files.css('--icon-border', m + 'px');
	}

	searchFiles() {
		let query = this.window.$window.find('.search-field').val();
		if (query.length == 0) {
			this.$files.children().removeClass('hidden');
			return;
		}

		query = query.toLowerCase();
		this.$files.children().each((i, el) => {
			let $el = $(el);
			let fname = $el.find('span').text().toLowerCase();
			if (fname.includes(query)) {
				$el.removeClass('hidden')
			} else {
				$el.addClass('hidden');
			}
		});
	}

	asFileSelector(mode, selectionMode) {
		this.selectionMode = selectionMode;
		let $win = this.window.$window;

		if (mode == 'open') {
			$win.find('.choose-options').addClass('d-block');
			$win.find('.ribbon').addClass('d-none');
			$win.find('.select').click(() => {
				this.doneClicked = true;
				this.close();
			});
		}
		if (mode == 'save') {
			$win.find('.save-options').addClass('d-block');
			$win.find('.ribbon').addClass('d-none');
			$win.find('.save').click(() => {
				let fileName = $win.find('.name-field').val();
				
				this.selectedFiles = [this.cwd + fileName];
				this.doneClicked = true;
				this.close();
			});
		}
	}

	async waitFileSelection() {
		await this.closingDeferred.promise;

		if (this.doneClicked) return this.selectedFiles;
		return null;
	}

	getNavPath(path) {
		if (path == '.') return this.cwd;

		let p = pathJoin(this.cwd, path);
		if (p == '/..') return '/';
		return p;
	}

	async navigate(path) {
		this.go(this.getNavPath(path));
	}

	async go(path) {	
		if (path.startsWith('$')) {
			this.openCollection(path.substring(1));
			return;
		}

		this.$addressField.val(path);

		// Fetching and fetch error handling
		let fres = await fetch('/fs/ls' + path);
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

			WebSys.showErrorDialog(`${msg}\nPath: "${path}"`);
			this.$addressField.val(this.cwd);
			return code;
		}

		this.cwd = path;

		// UI changes		
		this.refreshCollections();

		if (path == '/') {
			this.window.setTitle('File Explorer');
		} else {
			let fname = path;
			if (path.endsWith('/')) fname = path.slice(0, -1)

			fname = fname.slice(fname.lastIndexOf('/') + 1);
			this.window.setTitle(fname);
		}

		// Sort files
		let files = await fres.json();
		this.setFilePanelContent(files);
	}

	async setFilePanelContent(files) {
		this.$files.addClass('d-none');
		this.$files.empty();
		this.filesCount = files.length;

		let val = (e) => {
			if (e.endsWith('/')) return 1;
			return 0;
		};
		files.sort((a, b) => {
			let A = val(a.split('*')[0]);
			let B = val(b.split('*')[0]);
			if (A == B) return a.localeCompare(b);
			return B - A;
		});

		// Make icons
		for (let file of files) {
			let $ic = this.makeFileIcon(file);
			$ic.appendTo(this.$files);
		}	

		// Make the panel visible
		this.$files.removeClass('d-none');
		this.recalculateIcons();
	}

	makeFileIcon(fentry) {
		let [fpath, ftags=""] = fentry.split('*');

		// Get file name between slashes in the entry
		let fname = fpath;
		let ls = fpath.lastIndexOf('/', fpath.length-2);
		if (ls != -1) fname = fpath.substring(ls + 1);
		if (fname.endsWith('/')) fname = fname.slice(0, -1);

		// Absolute path of the entry
		let absPath;
		if (!this.cwd.startsWith('$')) {
			absPath = pathJoin(this.cwd, fpath);
		} else {
			absPath = fpath;
		}

		// Obtain file classes
		let classes = ['file'];
		if (fpath.endsWith('/')) {
			classes.push('dir');
		}
		if (ftags.includes('i')) {
			classes.push('blocked');
		}
		if (ftags.includes('s')) {
			classes.push('symbolic');
		}

		// Get file type given file extension
		let cl = this._getFileClassByExt(fpath);
		if (cl) classes.push(cl);

		// Create thumbnail image if needed
		let $img = null;
		let hasThumb = FileTypes.isVideo(fname) || FileTypes.isPicture(fname);
		if (hasThumb) {
			$img = $(`<img src='/fs/thumb${absPath}' draggable='false'>`);
			classes.push('thumbbed');
		}

		// Create file element
		let $file = $(`<div><span>${fname}</span></div>`, {
			'class': classes.join(' ')
		});

		// Add thumbnail element
		let $ic = $('<i></i>');
		if ($img) {
			$ic.append($img);
			$img.on('error', () => {
				$img.remove();
				$file.removeClass('thumbbed');
			});
		}
		$file.prepend($ic);

		// Clicking behaviour
		$file.click(() => {
			if (WebSys.desktop.contextMenuOpen) return;
			if (this.selectionMode == 'default') {
				this.openHandler(absPath);
				return;
			}

			switch(this.selectionMode) {
			case 'one':
				if ($file.hasClass('selected')) {
					this.selectedFiles = [];
					this.selectedElems = [];
				} else {
					for (let $el of this.selectedElems) {
						$el.removeClass('selected');
					};	
					this.selectedFiles = [absPath];
					this.selectedElems = [$file];
				}
				break;
			case 'many':
				let i = this.selectedFiles.indexOf(absPath);
				if (i == -1) {
					this.selectedFiles.push(absPath);
					this.selectedElems.push($file);
				} else {
					this.selectedFiles.splice(i, 1);
					this.selectedElems.splice(i, 1);
				}
				break;
			}
			$file.toggleClass('selected');
		});
		$file.dblclick(() => {
			if (this.selectionMode != 'default') {
				this.openHandler(absPath);
			}
		});
		WebSys.desktop.addCtxMenuOn($file, () => this.makeFileMenu(absPath));
		//$file.attr('draggable', 'true');
		return $file;
	}

	async goHome() {
		this.history.save('/');
		await this.go('/');
	}

	async pasteFile() {
		let str = Clipboard.object;
		let src = str.replace(/^(\/fs\/q\/\.)/,"");
		let dst = this.cwd;

		fetch(`/fs/cp?from=${encodeURIComponent(src)}&to=${encodeURIComponent(dst)}`);
	}

	async openHandler(path) {
		let qPath = '/fs/q' + path;

		if (path.endsWith('/')) {
			this.go(path);
			this.history.save(path);
			return;
		}

		let i = path.lastIndexOf('.');
		if (i != -1) {
			let ext = path.substring(i + 1);
			let appId = this.typeAssociations[ext];
			if (appId) {
				let app = await WebSys.runApp(appId, [qPath]);
				if (!app.window) return;

				app.window.bringToFront();
				app.window.focus();
				return;
			}
		}

		this.openFileExt(path);	
	}

	makeFileMenu(absPath) {
		let isDir = absPath.endsWith('/');
		let qPath = '/fs/q' + absPath;

		let menu = [
			CtxItem('Open', () => this.openHandler(absPath)),
		];

		if (isDir) {
			menu.push(
				CtxItem('Open in another window', async () => {
					let app = await WebSys.runApp('explorer');
					app.go(absPath);
				}),
				CtxItem('Add to favorites', () => {
					this.addFavorite(absPath)
				})
			);
		} else {
			menu.push(
				CtxMenu([
					CtxItem('With',  () => this.openFileWith(absPath)),
					CtxItem('Outside', () => this.openFileExt(absPath))
				], 'Open...'),
				CtxItem('Download', () => WebSys.downloadUrl(qPath))
			);
		}

		if (this.cwd.startsWith('$')) {
			menu.push(CtxItem('Remove from this collection', () => {
				let colName = this.cwd.substring(1);
				let coll = this.collections[colName];
				arrErase(coll.files, absPath);

				this.saveCollections();
				this.navigate('.');
			}));
		}

		menu.push(CtxMenu(
			this.collectionsVisible.map((cname) => CtxItem(cname, () => {
				this.addFileToCollection(cname, absPath);
			}))
		, 'Add to collection'));

		if (FileTypes.isPicture(absPath)) {
			menu.push(CtxItem('Set as background', () => {
				WebSys.desktop.setBackground(qPath, true);
			}));
		}

		menu.push(
			'-',
			CtxItem('Cut', () => {
				Clipboard.copyObject(qPath, 'cutfile');
			}),
			CtxItem('Copy', () => Clipboard.copyText(qPath)),
			CtxItem('Delete')
		);
		return CtxMenu(menu);
	}

	// Favorites 
	addFavorite(path) {
		this.favorites.push(path);

		this.saveFavorites();
		this.refreshFavorites();
	}

	removeFavorite(path) {
		arrErase(this.favorites, path);

		this.saveFavorites();
		this.refreshFavorites();
	}
	
	refreshFavorites() {
		this.$favorites.empty();

		for (let path of this.favorites) {
			let fname = this._getFileName(path);
			let $item = $('<li>' + fname + '</li>');
			$item.click(() => {
				this.openHandler(path);
			});
			WebSys.desktop.addCtxMenuOn($item, () => CtxMenu([
				CtxItem('Remove', () => this.removeFavorite(path))
			]));
			this.$favorites.append($item);
		}
	}

	async saveFavorites() {
		let data = JSON.stringify(this.favorites);

		await fetch('/fs/ud/usr/favorites.json', {
			method: 'POST',
			body: data,
			headers: {
				'Content-Type': 'text/plain'
			}
		})
	}

	async loadFavorites() {
		let freq = await fetch('/fs/q/usr/favorites.json');
		if (freq.status == 404) {
			this.favorites = [];
			return;
		}
		
		let data = await freq.text();
		this.favorites = JSON.parse(data);
	}

	// Collections
	createCollection(name) {
		this.collections[name] = {};

		this.saveCollections();
		this.recreateCollections();
	}

	destroyCollection(name) {
		delete this.collections[name];

		this.saveCollections();
		this.recreateCollections();
	}
	
	refreshCollections() {
		this.collectionsVisible.length = 0;
		for (let [name, $item] of this.collectionsMap.entries()) {
			let coll = this.collections[name];

			let visible = !coll.exclusive || coll.exclusive == this.cwd;
			$item.toggleClass('hidden_', !visible);
			if (visible) this.collectionsVisible.push(name);
		}
	}

	recreateCollections() {
		let self = this;

		this.$collections.empty();
		this.collectionsMap.clear();

		for (let [name, coll] of Object.entries(this.collections)) {
			let $item = $('<li class="hidden_">' + name + '</li>');
			this.collectionsMap.set(name, $item);

			$item.click(() => {
				this.openCollection(name);
			});

			WebSys.desktop.addCtxMenuOn($item, () => {
				return CtxMenu([
					CtxCheck('Only show here', (c) => {
						coll.exclusive = (c) ? self.cwd : null;
						this.saveCollections();
					}, coll.exclusive == this.cwd),
					CtxItem('Remove', () => this.destroyCollection(name))
				]);
			});
			this.$collections.append($item);
		}

		this.refreshCollections();
	}

	async saveCollections() {
		let data = JSON.stringify(this.collections);

		await fetch('/fs/ud/usr/collections.json', {
			method: 'POST',
			body: data,
			headers: {
				'Content-Type': 'text/plain'
			}
		})
	}

	async loadCollections() {
		let freq = await fetch('/fs/q/usr/collections.json');
		if (freq.status == 404) {
			this.collections = {};
			return;
		}

		let data = await freq.text();
		this.collections = JSON.parse(data);
	}

	openCollection(cname) {
		let col = this.collections[cname];
		if (!col) return;

		this.window.setTitle(`[${cname}]`);
		this.setFilePanelContent(col.files);

		this.cwd = '$' + cname;
		this.history.save(this.cwd);
		this.$addressField.val(this.cwd);
	}

	addFileToCollection(cname, file) {
		let coll = this.collections[cname];
		if (!coll.files) coll.files = [];

		if (coll.files.includes(file)) return;
		
		coll.files.push(file);
		this.saveCollections();
	}

	async openFileWith(path) {
		let hWin = WebSys.desktop.createWindow();
		hWin.on('closereq', () => hWin.close());
		
		await hWin.setContentToUrl('/app/explorer/res/openwith-helper.html');
		hWin.setTitle('Open: ' + path);
		hWin.setSize(280, 280);
		hWin.bringToCenter();
		hWin.bringToFront();

		let $win = hWin.$window;
		$win.find('.window-body').addClass('openwith-helper');
		let $list = $win.find('ul');
		for (let [id, defs] of Object.entries(WebSys.registeredApps)) {
			if (!defs.flags.includes('tool')) continue;

			let $item = $(`<li>${defs.name}</li>`);
			$item.click(async () => {
				let app = await WebSys.runApp(id, ['/fs/q' + path]);
				if (!app.window) return;

				app.window.bringToFront();
				app.window.focus();
				return;
			});
			$list.append($item);
		}

		hWin.setVisible(true);	
	}

	openFileExt(path) {
		window.open('/fs/q' + path, '_blank').focus();
	}

	onClose() {
		this.saveAppWindowState(this.window);
		this.window.close();
		this.closingDeferred.resolve();
	}

	closePromise() {
		return this.closingDeferred.promise;
	}

	_getFileName(path) {
		if (path.endsWith('/')) {
			path = path.slice(0, -1);
		}

		let sl = path.lastIndexOf('/');
		if (sl == -1) return path;
		return path.slice(sl + 1);
	}

	_getFileClassByExt(file) {
		if (FileTypes.isAudio(file)) return 'audio';
		if (FileTypes.isVideo(file)) return 'video';
		if (FileTypes.isText(file)) return 'text';
		return null;
	}

	setZoom(v) {
		this.zoom = v;
		this.$files.css('--icon-width', 128 * v + 'px');
		this.$files.css('--icon-height', 96 * v + 'px');
		this.recalculateIcons();
	}

	subs() {
		let self = this;

		this.history = {
			log: [],
			logIndex: -1,

			save(entry) {
				this.logIndex++;

				if (this.logIndex == this.log.length) {
					this.log.push(entry);
				} else {
					this.log[this.logIndex] = entry;
					this.log.length = this.logIndex+1;
				}
			},

			goBack() {
				if (this.logIndex <= 0) return null;

				return this.log[--this.logIndex];
			}
		}
	}
}