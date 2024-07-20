import NotepadApp from "./notepad.mjs";
import { ClientClass } from "/@sys/client_core.mjs";
import Window, { CloseBehavior } from "/@sys/ui/window.mjs";
import Util from "/@sys/util.mjs";

export class FindHelper {
	app: NotepadApp;
	window: Window;
	wrapAround: boolean;
	searchedBackwards: boolean;
	$input: $Element;
	$findResult: $Element;

	constructor(app: NotepadApp) {
		this.app = app;
		this.window = ClientClass.get().desktop.createWindow(app);
		this.window.setTitle('Find text');
		this.window.$window.addClass('notepad-find');
		this.window.setInitialPosition('center');
		this.window.setCloseBehavior(CloseBehavior.HIDE_WINDOW);
	}

	async init() {
		const self = this;
		await this.window.setContentToUrl('/app/notepad/pages/find-window.html');

		let $win = this.window.$window;
		this.$findResult = $win.find('.find-result');
		this.$input = $win.find('.search-field');

		this.$input.keydown(async (ev: KeyboardEvent) => {
			// Enter pressed, do search in the same direction as the previous search
			await Util.sleep(0);
			if (ev.which == 13) {
				this.find(this.searchedBackwards);
			}
		});

		$win.find('.wrap-around').change(function () {
			self.wrapAround = this.checked;
		});
		$win.find('.prev-btn').click(() => this.find(true));
		$win.find('.next-btn').click(() => this.find(false));

		await this.window.pack();
	}

	find(backwards: boolean) {
		const query = this.$input.val();

		this.searchedBackwards = backwards;

		let index: number;
		if (backwards) {
			index = this.findPrevious(query);
		} else {
			index = this.findNext(query);
		}
		
		if (index == -1) {
			this.$findResult.text("No match!");
			return;
		}
		this.$findResult.text(" ");

		// Select the text in the 'textarea' tag and on the highlighted 'code' element.
		// This has the effect of scrolling to the selection, saving the caret positions on the
		// textarea and creating a visible lasting selection on the text, even when the element
		// loses focus.
		this.selectAreaText(index, index + query.length);
		this.selectCodeText(index, index + query.length);

		// Keep our window on top
		this.window.bringToFront();
	}

	findNext(query: string): number {
		const $textArea: HTMLTextAreaElement = this.app.$textArea[0];
		const text = this.app.$textArea.val();
		
		// Current caret position. We'll look for text after the current selection.
		let caretEnd = $textArea.selectionEnd;

		// Find the query forwards, and if no match is found and wrapping around is enabled, try
		// finding the query from the beginning of the text.
		let index = text.indexOf(query, caretEnd);
		if (index == -1 && this.wrapAround) {
			index = text.indexOf(query);
		}

		return index;
	}
	
	findPrevious(query: string): number {
		const $textArea: HTMLTextAreaElement = this.app.$textArea[0];
		const text = this.app.$textArea.val();
		
		// Current caret position. We'll look for text before the current selection.
		let caretStart = $textArea.selectionStart - 1;

		// Find the query backwards, and if no match is found and wrapping around is enabled, try
		// finding the query from the end of the text.
		let index = -1;
		if (caretStart >= 0)
			index = text.lastIndexOf(query, caretStart);
		if (index == -1 && this.wrapAround) {
			index = text.lastIndexOf(query);
		}

		return index;
	}

	/**
	 * Select the portion of text in the front-facing textarea element. This will scroll the editor
	 * to the selection.
	 */
	selectAreaText(begin: number, end: number) {
		let $textArea = this.app.editor.$textArea[0];
		$textArea.setSelectionRange(begin, begin);
		$textArea.focus();
		$textArea.setSelectionRange(begin, end);
	}

	/**
	 * Select the portion of text in the backing highlighted 'code' element.
	 * Contrary to the textarea selection, this selection is kept even when the editor loses focus,
	 * and will only lose visibility when focusing another text element.
	 */
	selectCodeText(begin: number, end: number) {
		let range = this.app.editor.getHighlightedRange(begin, end);
		if (!range) return;

		let selection = document.getSelection();
		selection.removeAllRanges();
		selection.addRange(range);
	}

	async show() {
		await this.window.setVisible(true);
		this.window.bringToFront();
		this.$input.focus();
	}
}
