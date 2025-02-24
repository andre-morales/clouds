import ExplorerApp from "./explorer.mjs";
import ExplorerProperties from "./properties_dialog.mjs";
import { FileTypes, Paths } from "/@sys/drivers/filesystem.mjs";
import { ClientClass } from "/@sys/client_core.mjs";
import { ContextMenu } from "/@sys/ui/controls/context_menu/ctx_menu.mjs";
import { FileSystem } from "/@sys/drivers/filesystem.mjs";
import Util from "/@sys/utils/browser.mjs";
import { FileEntry } from "./file_entry.mjs";
import { CtxEntry } from "/@sys/ui/controls/context_menu/shorthand.mjs";

export class FileIcon {
	public readonly path: string;
	public readonly absolutePath: string;
	public readonly fileName: string;
	public readonly $icon: $Element;
	private readonly app: ExplorerApp;

	constructor(app: ExplorerApp, entry: FileEntry) {
		this.app = app;
		this.path = entry.path;
		this.absolutePath = Paths.join(this.app.cwd, entry.path);
		this.fileName = this.getFileName();

		// Obtain file classes
		let classes = this.getIconClasses(entry.tags);

		// Limit text under icon if too large
		let iconText = this.getDisplayName();

		// Create thumbnail image if needed
		let $img = null;
		let hasThumb = FileTypes.isVideo(this.fileName) || FileTypes.isPicture(this.fileName);
		if (hasThumb) {
			let thumbURL = Paths.toURL(Paths.toFSV(this.absolutePath));
			$img = $(`<img src='/fsmx/thumb${this.absolutePath}' draggable='false'>`);
			classes.push('thumbbed');
		}
		
		// Create file element itself
		this.$icon = $(`<div><span>${iconText}</span></div>`, {
			title: this.fileName,
			class: classes.join(' ')
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
				this.$icon.removeClass('thumbbed');
			});
		}
		this.$icon.prepend($ic);		
	}

	public makeContextMenu() {
		let absPath = this.absolutePath;

		let isDir = absPath.endsWith('/');
		let fsPath = Paths.toFSV(absPath);

		let menu: CtxEntry[] = [
			['-Select', () => this.select()],
			['|'],
			['-Open', () => this.app.openHandler(absPath)],
		];

		if (isDir) {
			menu.push(
				['-Open in another window', async () => {
					let app = await ClientClass.get().runApp('explorer') as any;
					app.go(absPath);
				}],
				['-Add to favorites', () => {
					this.app.addFavorite(absPath)
				}]
			);
		} else {
			menu.push(
				['>Open...', [
					['-With',  () => this.app.openFileWith(absPath)],
					['-Outside', () => this.app.openFileExt(absPath)]
				]],
				['-Download', () => Util.downloadUrl(fsPath)]
			);
		}

		if (FileTypes.isPicture(absPath)) {
			menu.push(['-Set as background', () => {
				ClientClass.get().desktop.setBackground(fsPath);
			}]);
		}

		menu.push(
			['|'],
			['-Copy', () => { this.app.copy([absPath]) }],
			['-Cut', () => { this.app.cut([absPath]) }],
			['|'],
			['-Rename', () => { this.enableRename() }],
			['-Erase', () => { this.app.erase([absPath]) }],
			['|'],
			['-Properties', () => { ExplorerProperties.openPath(this.app, absPath)}]
		);
		return ContextMenu.fromDefinition(menu);
	}

	/** Enable renaming the file in the UI */
	public enableRename() {
		let file = Paths.file(this.path);

		let removed = false;
		let isFolder = this.absolutePath.endsWith('/');
		let currentName = file.replace('/', '');

		// Hide icon text with the file name
		let $name = this.$icon.find('span');
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
			let newPath = Paths.parent(this.absolutePath) + newName + ((isFolder)?'/':'');
			await FileSystem.rename(this.absolutePath, newPath);

			// Set the new name on the span
			$name.text(newName);

			this.app.refresh();
		};

		// When leaving the input, perform the rename op
		$input.on('focusout', () => {
			doRename();
		});

		$input.on('keydown', (ev: KeyboardEvent) => {
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

	public select() {
		this.app.panel.performSelection(this, false);
	}

	/** Get file name between slashes in the entry */
	private getFileName() {
		let fName = this.path;
		let ls = this.path.lastIndexOf('/', this.path.length - 2);
		if (ls != -1) fName = this.path.substring(ls + 1);
		if (fName.endsWith('/')) fName = fName.slice(0, -1);
		return fName;
	}

	private getDisplayName() {
		let iconText = this.fileName;
		if (this.fileName.length > 20) {
			iconText = this.fileName.substring(0, 20) + "…";
		}
		return iconText;
	}

	private getIconClasses(tags: string): string[] {
		let classes = ['file'];
		if (this.absolutePath.endsWith('/')) {
			classes.push('dir');
		}
		if (tags.includes('i')) {
			classes.push('blocked');
		}
		if (tags.includes('s')) {
			classes.push('symbolic');
		}

		// Get file type given file extension
		let cl = getFileClassByExt(this.absolutePath);
		if (cl) classes.push(cl);
		return classes;
	}
}

function getFileClassByExt(file: string): string {
	if (FileTypes.isAudio(file)) return 'audio';
	if (FileTypes.isVideo(file)) return 'video';
	if (FileTypes.isText(file)) return 'text';
	return null;
}