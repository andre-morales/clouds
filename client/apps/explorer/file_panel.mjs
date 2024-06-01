import { CtxMenu, CtxItem, CtxCheck } from '/res/js/ui/context_menu.mjs';
import { FileSystem, Paths, FileTypes } from '/res/js/filesystem.mjs';
import Util from '/@sys/util.mjs';

export class FilePanel {
	constructor(explorer) {
		this.app = explorer;
		this.zoom = 1;
		this.files = null;
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

		this.$filesContainer.on('wheel', (ev) => {
			if (!ev.ctrlKey) return;
			
			let scale = ev.deltaY / 1000.0;
			this.setZoom(this.zoom - scale);

			ev.preventDefault();
		});
	}

	setContent(files) {
		this.files = files;
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
			let $ic = this.makeFileIcon(file);
			this.fileIcons[file[0]] = $ic;
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

		Client.desktop.addCtxMenuOn($file, () => this.makeFileMenu(absPath, $file));
		return $file;
	}

	makeFileMenu(absPath, $file) {
		let isDir = absPath.endsWith('/');
		let fsPath = Paths.toFSV(absPath);

		let menu = [
			CtxItem('Open', () => this.app.openHandler(absPath)),
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
				CtxItem('Download', () => 	Util.downloadUrl(fsPath))
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
				Client.desktop.setBackground(fsPath);
				Client.desktop.saveConfigs();
			}));
		}

		menu.push(
			'-',
			CtxItem('Copy', () => { this.app.copy(absPath) }),
			CtxItem('Cut', () => { this.app.cut(absPath) }),
			'-',
			CtxItem('Rename', () => { this.enableRename(absPath) }),
			CtxItem('Erase', () => { this.app.erase(absPath) }),
			'-',
			CtxItem('Properties', () => {this.app.openFileProperties(absPath)})
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
		if (v < 0.2) v = 0.2;
		if (v > 5) v = 5;
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

	enableRename(path) {
		let file = Paths.file(path);
		let $file = this.fileIcons[file];

		let removed = false;
		let isFolder = path.endsWith('/');
		let currentName = file.replace('/', '');

		// Hide icon text with the file name
		let $name = $file.find('span');
		$name.addClass('d-none');

		// Add a text input replacing the file name
		let $nameContainer = $name.parent();
		let $input = $(`<input class='field rename-field' value='${currentName}'/>`);
		$nameContainer.append($input);
		let input = $input[0];

		// When clicking the field, do not open the file/folder
		$input.click((ev) => {
			ev.stopPropagation();
		});

		// Function that performs the actual renaming
		let doRename = async () => {
			// If the input was removed, do nothing
			if (removed) return;
			removed = true;

			// Get new name, remove the field and redisplay the file label
			let newName = $input.val();
			$input.remove();
			$name.removeClass('d-none');

			// Do the actual path renaming
			let newPath = Paths.parent(path) + newName + ((isFolder)?'/':'');
			await FileSystem.rename(path, newPath);

			// Set the new name on the span
			$name.text(newName);

			this.app.refresh();
		};

		// When leaving the input, perform the rename op
		$input.on('focusout', () => {
			doRename();
		});

		$input.on('keydown', (ev) => {
			switch (ev.key) {
			case 'Enter':
				doRename();
				break;
			case 'Escape':
				// Cancel renaming
				removed = true;
				$input.remove();
				$name.removeClass('d-none');
				break;
			}
		});

		// Make the file name selected by default
		$input.focus();
		setTimeout(() => {
			input.selectionStart = 0;
			
			let i = input.value.lastIndexOf('.');
			if (!isFolder && i != -1) {
				input.selectionEnd = i;
			} else {
				input.selectionEnd = input.value.length;
			}
		}, 0);
	}
}

function getFileClassByExt(file) {
	if (FileTypes.isAudio(file)) return 'audio';
	if (FileTypes.isVideo(file)) return 'video';
	if (FileTypes.isText(file)) return 'text';
	return null;
}