window.ConsoleApp = class ConsoleApp extends App {
	constructor(...args) {
		super(...args);
		this.window = null;
		this.commandHistory = [];
		this.commandHistoryIndex = 0;
		this.currentInput = "";
	}

	async init() {
		// Create window and fetch app body
		this.window = WebSys.desktop.createWindow(this);
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
			if (ev.key == 'ArrowUp') {
				this.goBackHistory();
				ev.preventDefault();
			} else if (ev.key == 'ArrowDown'){
				this.goForwardHistory();
				ev.preventDefault();
			}
		});
		this.$cmdField.on('keypress', (ev) => {
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
		WebSys.desktop.addCtxMenuOn(this.$app, () => ctxMenu);
	}

	sendCmd() {
		let cmd = this.$cmdField.val();
		Client.log("> " + cmd);
		
		this.commandHistory.push(cmd);
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
		this.$content.append($span);
	}

	stringifyObject(obj) {
		if (obj === undefined) return "undefined";
		if (obj === null) return "null";

		let properties = "";
		for (let property in obj) {
			properties += `\n${property}: ${obj[property]}`;
		}
		properties = properties.replaceAll('\n', '\n  ');
		return `${obj.constructor.name}: {${properties}\n}`;
	}
}