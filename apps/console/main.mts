import { CtxMenuClass } from '/@sys/ui/context_menu.mjs';
import Util from '/@sys/util.mjs';
import App from '/@sys/app.mjs';
import Window from '/@sys/ui/window.mjs';
import { ClientClass } from '/@sys/client_core.mjs';

var Client: ClientClass;

export default class ConsoleApp extends App {
	window: Window;
	commandHistory: string[];
	commandHistoryIndex: number;
	currentInput: string;
	logListener: Function;
	$app: $Element;
	$content: $Element;
	$cmdField: $Element;
	$suggestions: $Element;

	constructor(...args: ConstructorParameters<typeof App>) {
		super(...args);
		Client = ClientClass.get();
		this.window = null;
		this.commandHistory = [];
		this.commandHistoryIndex = 0;
		this.currentInput = "";
	}

	async init() {
		// Create window and fetch app body
		this.window = Client.desktop.createWindow(this);
		this.window.setTitle('Console');
		this.window.setCloseBehavior('exit');

		// Fetch app body
		await this.window.setContentToUrl('/app/console/main.html');
		let $app = this.window.$window.find('.window-body');
		this.$app = $app;
		$app.addClass('app-console');

		this.createContextMenu();
		this.$content = $app.find('.content');
		this.$cmdField = $app.find('.cmd-field');
		this.$suggestions = $app.find('.suggestions');

		this.logListener = Client.events.on('log', (msg) => {
			this.updateLog(msg);
		});
		this.on('exit', () => {	
			Client.events.off('log', this.logListener);
		});

		this.updateLog(Client.logHistory, true);

		$app.find('.send-btn').click(() => {
			this.sendCmd();
		});
		this.$cmdField.on('keydown', (ev: KeyboardEvent) => {
			if (ev.key == 'ArrowUp') {
				this.goBackHistory();
				ev.preventDefault();
			} else if (ev.key == 'ArrowDown'){
				this.goForwardHistory();
				ev.preventDefault();
			}

			this.doSuggestions();
		});
		this.$cmdField.on('keypress', (ev: KeyboardEvent) => {
			if (ev.key == 'Enter') {
				this.sendCmd();
			}
		});

		// Make the window visible
		this.window.setVisible(true);
		this.$cmdField.focus();
	}

	async doSuggestions() {
		// Wait a cycle for input field update
		await Util.sleep(0);

		// Clear the current suggestions. If the field is empty, don't suggest anything
		this.$suggestions.empty();
		let text = this.$cmdField.val();
		if (text.length == 0) return;
		
		// Split the text on the last dot. Anything behind the dot is the name of an
		// object and everything after it is the property we are trying to auto-complete.
		let objectName = 'window';
		let property;

		let dot = text.lastIndexOf('.');
		if (dot != -1) {
			objectName = text.substring(0, dot);
			property = text.substring(dot + 1);
		} else {
			property = text;
		}

		// Get the object itself and list the properties that start with the same name
		let object = Util.getObjectByName(objectName);
		let suggestionAmount = 0;
		for (let key in object) {
			if (suggestionAmount > 5) break;
			if (!key.startsWith(property)) continue;

			// Insert a suggestion into the box
			suggestionAmount++;
			let $suggestion = $(`<span>${key}</span>`);
			this.$suggestions.append($suggestion);

			$suggestion.click(() => {
				this.$cmdField.val(objectName + '.' + key);
				this.doSuggestions();
			});
		}
	}

	createContextMenu() {
		let ctxMenu = CtxMenuClass.fromEntries([
			['-Clear', () => this.clear()]
		]);
		Client.desktop.addCtxMenuOn(this.$app, () => ctxMenu);
	}

	sendCmd() {
		let cmd = this.$cmdField.val();
		Client.log("> " + cmd);
		
		this.commandHistory.push(cmd);
		this.commandHistoryIndex = 0;
		this.currentInput = '';
		this.$cmdField.val("");
		let result = eval(cmd);

		let msg = "< " + this.stringifyObject(result);
		this.updateLog(msg);
	}

	goBackHistory() {
		if (this.commandHistoryIndex == this.commandHistory.length) return;

		this.commandHistoryIndex++;
		if (this.commandHistoryIndex == 1) {
			this.currentInput = this.$cmdField.val();
		}

		let cmd = this.commandHistory[this.commandHistory.length - this.commandHistoryIndex];
		this.$cmdField.val(cmd);
	}

	goForwardHistory() {
		if (this.commandHistoryIndex == 0) return;

		this.commandHistoryIndex--;

		let cmd;
		if (this.commandHistoryIndex == 0) {
			cmd = this.currentInput;
		} else {
			cmd = this.commandHistory[this.commandHistory.length - this.commandHistoryIndex];
		}

		this.$cmdField.val(cmd);
	}

	clear() {
		this.$content.empty();
	}

	updateLog(msg: string, noNewLine?: boolean) {
		let $span = $('<span class="msg">');
		if (!noNewLine) {
			msg += '\n';
		}
		$span.text(msg);

		let cont = this.$content[0];

		// If the content is scrolled to the bottom, scroll it again with the new content
		let scroll;
		if (cont.scrollTop + cont.offsetHeight >= cont.scrollHeight - 2) {
			scroll = true;
		}

		this.$content.append($span);
		if (scroll) {
			cont.scrollTo(0, cont.scrollHeight);
		}
	}

	stringifyObject(obj, depth = 1) {	
		// Specials
		if (obj === undefined) return "undefined";
		if (obj === null) return "null";

		// Strings
		if (typeof obj === 'string') return `"${obj}"`;
		
		// Numbers
		if (!Array.isArray(obj) && !isNaN(obj)) return "" + obj;

		if (depth <= 0) return obj.constructor.name;

		// Arrays
		if (Array.isArray(obj)) {
			let str = "["
			for (let i = 0; i < obj.length; i++) {
				str += this.stringifyObject(obj[i], depth - 1);
				if (i < obj.length - 1) {
					str += ', ';
				}
			}
			str += ']';
			return str;
		}

		// Object
		let properties = "";
		for (let key in obj) {
			let value = obj[key];
			properties += `\n${key}: ${this.stringifyObject(value, depth - 1)}`;
		}
		properties = properties.replaceAll('\n', '\n  ');
		return `${obj.constructor.name}: {${properties}\n}`;
	}
}