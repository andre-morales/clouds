export default class ConsoleApp extends App {
	constructor(...args) {
		super(...args);
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

		this.logListener = Client.on('log', (msg) => {
			this.updateLog(msg);
		});
		this.on('exit', () => {	
			Client.off('log', this.logListener);
		});

		this.updateLog(Client.logHistory, true);

		$app.find('.send-btn').click(() => {
			this.sendCmd();
		});
		this.$cmdField.on('keydown', (ev) => {
			//Client.log('kd: ' + ev.key);
			if (ev.key == 'ArrowUp') {
				this.goBackHistory();
				ev.preventDefault();
			} else if (ev.key == 'ArrowDown'){
				this.goForwardHistory();
				ev.preventDefault();
			}
		});
		this.$cmdField.on('keypress', (ev) => {
			//Client.log('kp: ' + ev.key);
			if (ev.key == 'Enter') {
				this.sendCmd();
			}
		});

		// Make the window visible
		this.window.setVisible(true);
	}

	createContextMenu() {
		let ctxMenu = CtxMenu([
			CtxItem('Clear', () => this.clear())
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

	updateLog(msg, noNewLine) {
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
		if (obj === undefined) return "undefined";

		if (obj === null) return "null";

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

		if (typeof obj === 'string') return `"${obj}"`;
		
		if (!isNaN(obj)) return "" + obj;

		if (depth <= 0) return obj.constructor.name;

		let properties = "";
		for (let property in obj) {
			properties += `\n${property}: ${obj[property]}`;
		}
		properties = strReplaceAll(properties, '\n', '\n  ');
		return `${obj.constructor.name}: {${properties}\n}`;
	}
}