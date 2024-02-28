export class FilePanel {
	constructor(explorer) {
		this.app = explorer;
		this.zoom = 1;
		this.$files = null;
		this.sorting = '';
		this.selectionMode = 'default';
		this.selectedFiles = [];
		this.selectedElems = [];
	}

	init() {
		this.$files = this.app.$app.find('.files');
	}

	async setContent(files) {
		this.files = files;
		this.$files.addClass('d-none');
		this.$files.empty();
		this.filesCount = files.length;

		// Sort files 
		switch (this.sorting) {
		case 'date':
			files.sort((a, b) => {
				let A = a[2];
				let B = b[2];
				return B - A;
			});
			break;

		// By default, sort alphabetically
		default:
			let val = (e) => {
				if (e.endsWith('/')) return 1;
				return 0;
			};

			files.sort((a, b) => {
				let A = val(a[0]);
				let B = val(b[0]);
				if (A == B) return a[0].localeCompare(b[0]);
				return B - A;
			});
		}

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
		let [fpath, ftags="", fcreation=0] = fentry;

		// Get file name between slashes in the entry
		let fname = fpath;
		let ls = fpath.lastIndexOf('/', fpath.length-2);
		if (ls != -1) fname = fpath.substring(ls + 1);
		if (fname.endsWith('/')) fname = fname.slice(0, -1);

		// Absolute path of the entry
		let absPath;
		if (!this.app.cwd.startsWith('$')) {
			absPath = Paths.join(this.app.cwd, fpath);
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
		let cl = getFileClassByExt(fpath);
		if (cl) classes.push(cl);

		// Create thumbnail image if needed
		let $img = null;
		let hasThumb = FileTypes.isVideo(fname) || FileTypes.isPicture(fname);
		if (hasThumb) {
			$img = $(`<img src='/fsv${absPath}?thumb' draggable='false'>`);
			classes.push('thumbbed');
		}

		// Create file element itself
		let iconText = fname;
		if (fname.length > 20) {
			iconText = fname.substring(0, 20) + "…";
		}
		
		let $file = $(`<div><span>${iconText}</span></div>`, {
			'class': classes.join(' ')
		});

		// Add thumbnail element
		let $ic = $('<i></i>');
		if ($img) {
			$ic.append($img);
			$img.on('error', () => {
				// If image loading was just halted, don't remove anything.
				if ($img[0].dataset.haltSrc) return;

				// Remove image and thumb class to allow loading of regular file icon
				$img.remove();
				$file.removeClass('thumbbed');
			});
		}
		$file.prepend($ic);

		// Clicking behaviour
		$file.click(() => {
			if (Client.desktop.contextMenuOpen) return;
			if (this.selectionMode == 'default') {
				this.app.openHandler(absPath);
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
				this.app.openHandler(absPath);
			}
		});
		Client.desktop.addCtxMenuOn($file, () => this.makeFileMenu(absPath));
		return $file;
	}

	makeFileMenu(absPath) {
		let isDir = absPath.endsWith('/');
		let fsPath = Paths.toFSV(absPath);

		let menu = [
			CtxItem('Open', () => this.openHandler(absPath)),
		];

		if (isDir) {
			menu.push(
				CtxItem('Open in another window', async () => {
					let app = await Client.runApp('explorer');
					app.go(absPath);
				}),
				CtxItem('Add to favorites', () => {
					this.app.addFavorite(absPath)
				})
			);
		} else {
			menu.push(
				CtxMenu([
					CtxItem('With',  () => this.app.openFileWith(absPath)),
					CtxItem('Outside', () => this.app.openFileExt(absPath))
				], 'Open...'),
				CtxItem('Download', () => Client.downloadUrl(fsPath))
			);
		}

		if (this.app.cwd.startsWith('$')) {
			menu.push(CtxItem('Remove from this collection', () => {
				let colName = this.app.cwd.substring(1);
				let coll = this.app.collections[colName];
				arrErase(coll.files, absPath);

				this.app.saveCollections();
				this.app.navigate('.');
			}));
		}

		menu.push(CtxMenu(
			this.app.collectionsVisible.map((cname) => CtxItem(cname, () => {
				this.app.addFileToCollection(cname, absPath);
			}))
		, 'Add to collection'));

		if (FileTypes.isPicture(absPath)) {
			menu.push(CtxItem('Set as background', () => {
				Client.desktop.setBackground(fsPath, true);
			}));
		}

		menu.push(
			'-',
			CtxItem('Copy', () => { this.app.copy(absPath) }),
			CtxItem('Cut', () => { this.app.cut(absPath) }),
			CtxItem('Erase', () => { this.app.erase(absPath) })
		);
		return CtxMenu(menu);
	}

	recalculateIcons() {
		let iw = 128 * this.zoom;

		let w = this.$files.width();
		let icons = Math.floor(w / iw); // How many icons fit vertically
		let tm = w - icons * iw - 2;    // Remaining space
		let m = tm / icons / 2;         // Divide remaining space as margin
		this.$files.css('--icon-border', m + 'px');
	}

	setZoom(v) {
		this.zoom = v;
		this.$files.css('--icon-width', 128 * v + 'px');
		this.$files.css('--icon-height', 96 * v + 'px');
		this.recalculateIcons();
	}

	filter(query) {
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
		});
	}

	sortBy(what) {
		this.sorting = what;
		this.setContent(this.files);
	}
}

function getFileClassByExt(file) {
	if (FileTypes.isAudio(file)) return 'audio';
	if (FileTypes.isVideo(file)) return 'video';
	if (FileTypes.isText(file)) return 'text';
	return null;
}