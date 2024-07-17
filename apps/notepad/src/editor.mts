import * as Languages from "./languages.mjs";
import NotepadApp from "./notepad.mjs";
import ranges from "./ranges.mjs";

declare var Prism: any;

/* Text area internal padding. This is OS-dependent. Increasing it will make the editor think the
area is smaller. */
const PADDING_ADJUST = 5;

export class Editor {
	app: NotepadApp;
	lineWrapping: boolean;
	tabWidth: number;
	fontSize: number;
	tabReplacement: string;
	grContext: CanvasRenderingContext2D;

	$editor: $Element;
	$textArea: $Element;
	$preCode: $Element;
	$code: $Element;
	$lineNumbers: $Element;

	constructor(app: NotepadApp) {
		this.app = app;
		this.tabWidth = 4;
		this.lineWrapping = false;
		this.fontSize = 12;

		let $editor = this.app.$app.find('.editor');
		this.$editor = $editor;
		this.$textArea = $editor.find('textarea');
		this.$preCode = $editor.find('pre');
		this.$code = $editor.find('code');
		this.$lineNumbers = $editor.find('.line-numbers');

		this.tabReplacement = new Array(this.tabWidth + 1).join(' ');
		this.#makeGraphicsContext();

		// Track events to synchronize the line numbers, the syntax code tag and the hidden textarea
		this.app.window.on('resize', () => {
			this.#updateLineNumbers();
		});

		this.$textArea.on('input', () => {
			this.#updateLineNumbers();
			this.#highlightText();
			this.#syncScroll();
		});

		this.$textArea.on('scroll', () => {
			this.#syncScroll();
		});
		
		this.setLineWrapping(this.lineWrapping);
		this.setFontSize(this.fontSize);
		Languages.registerLanguages();
	}

	setContent(text: string) {
		this.$textArea.val(text);
		this.$textArea[0].setSelectionRange(0, 0);
		this.#highlightText();
		this.#updateLineNumbers();
	}

	setLineWrapping(wrapping: boolean) {
		this.lineWrapping = wrapping;
		this.$editor.toggleClass('wrapping', wrapping);
		this.#updateLineNumbers();
	}

	setLanguage(lang: string) {
		this.$code[0].className = 'language-' + lang;
		this.#highlightText();
	}

	setFontSize(size: number) {
		if (size < 5) size = 5;
		if (size > 72) size = 72;

		this.fontSize = size;
		this.$editor.css('font-size', size + 'pt');
		let styles = window.getComputedStyle(this.$textArea[0]);
		this.grContext.font = styles.font;
		this.#updateLineNumbers();
		this.#syncScroll();
	}

	/**
	 * Find a Range into the highlighted \<code\> element corresponding with the begin and
	 * end positions given.
	 * @param begin Position of the first character in the text to be included in the range.
	 * @param end Position after the last character in the text to be included in the range.
	 */
	getHighlightedRange(begin: number, end: number) {
		return ranges.findWithBounds(this.$code, begin, end);
	}

	#highlightText() {
		let content = this.$textArea.val();

		// Add a space if the last character is a newline to handle scroll sync issues.
		if(content[content.length - 1] == '\n') {
			content += " ";
		}

		this.$code.text(content);
		Prism.highlightElement(this.$code[0]);
	}

	#syncScroll() {
		this.$lineNumbers[0].scrollTop = this.$textArea[0].scrollTop;
		this.$preCode[0].scrollTop = this.$textArea[0].scrollTop;
		this.$preCode[0].scrollLeft = this.$textArea[0].scrollLeft;
	}

	#makeGraphicsContext() {
		// Create graphics context trough canvas
		let canvas = document.createElement('canvas');
		this.grContext = canvas.getContext('2d');
	}

	#updateLineNumbers() {
		// For each line number in the array, make a div element
		let numbers = this.#makeLineNumbers();
		let content = numbers.map(n => `<div>${n || '&nbsp;'}</div>`).join('');
		this.$lineNumbers.html(content);
	}

	#calculateNumLines(sentence: string) {
		// If line wrapping is disabled, a sentence always takes a line
		if (!this.lineWrapping) return 1;

		// We must replace all tabs in the sentence. Canvas does not take into account tab sizes
		// properly.
		sentence = sentence.replaceAll('\t', this.tabReplacement);
		const parseValue = (v) => v.endsWith('px') ? parseInt(v.slice(0, -2), 10) : 0;

		// Get all CSS properties in the textarea and set the context font
		const fieldStyles = window.getComputedStyle(this.$textArea[0]);
		this.grContext.font = fieldStyles.font;

		// Discover the true size of the text area
		let paddingLeft = parseValue(fieldStyles.paddingLeft);
		let paddingRight = parseValue(fieldStyles.paddingRight);
		let fieldWidth = this.$textArea[0].getBoundingClientRect().width - paddingLeft - paddingRight - PADDING_ADJUST;

		let lineCount = 0;
		let currentLine = '';
		let words = sentence.split(' ');
		for (let word of words) {
			let wordWidth = this.grContext.measureText(word + ' ').width;
			let lineWidth = this.grContext.measureText(currentLine).width;
			let sumWidth = lineWidth + wordWidth;
			//let sumWidth = this.grContext.measureText(currentLine + word + ' ').width;
			if (sumWidth > fieldWidth) {
				lineCount++;
				currentLine = word + ' ';
			} else {
				currentLine += word + ' ';
			}
		}

		if (currentLine.trim() !== '') {
			lineCount++;
		}
		return lineCount;
	}

	#makeLineNumbers() {
		// Calculate how many lines there are in each true line of the content.
		let textLines = this.$textArea.val().split('\n');
		let lineCounts = textLines.map((line) => this.#calculateNumLines(line));
		
		let numbers = [];

		// For every line count, we'll populate numbers with the correct index or empty padding
		// holes.
		for (let i = 0; i < lineCounts.length; i++) {
			numbers.push(i + 1);
			
			// Create empty holes as necessary
			let num = lineCounts[i];
			for (let j = 1; j < num; j++) {
				numbers.push('');
			}
		}
	
		return numbers;
	}
}
