window.RemoteShellApp = class RemoteShellApp extends App {
	constructor(...args) {
		super(...args);
		this.window = null;
		this.shellId = null;
	}

	async init() {
		let fres = await fetch('/shell/0/init');
		if (fres.status != 200) {
			Client.showErrorDialog('Error', 'Shell creation failed.');
			this.exit();
			return;
		}

		this.shellId = await fres.json();

		// Require resources
		await this.requireStyle('/app/remoteshell/res/style.css');

		// Create window and fetch app body
		this.window = Client.desktop.createWindow(this);
		this.window.on('closing', () => this.doCleanup());
		
		this.window.setTitle('Remote Shell');
		let $app = this.window.$window.find('.window-body');
		$app.addClass('app-remoteshell');

		// Fetch explorer body
		await this.window.setContentToUrl('/app/remoteshell/res/main.html');

		this.$content = $app.find('.content');

		let $field = $app.find('input');
		$field.on('keypress', (ev) => {
			if (ev.key != 'Enter') return;
			
			let cmd = $field.val();
			fetch('/shell/' + this.shellId + '/send', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
			    },
				body: JSON.stringify({'cmd': cmd})
			});
			$field.val('');
		})

		let call = async () => {
			let fres = await fetch('/shell/' + this.shellId + '/stdout_new', {
				cache: "no-cache"
			});
			if (fres.status != 200) {
				console.error('Fetch n returned: ' + fres.status);
				return;
			}

			let content = await fres.text();
			this.updateLog(content);

			if (!this.fetchTimeout__) return;
			this.fetchTimeout__ = setTimeout(call);
		};	

		this.fetchTimeout__ = setTimeout(call, 1);

		this.pingInterval__ = setInterval(async () => {
			fetch('/shell/' + this.shellId + '/ping');
		}, 10000)

		// Make the window visible
		this.window.setVisible(true);
		await sleep(0);
		$field.focus();
	}

	updateLog(content) {
		let cont = this.$content[0];

		let onBottom;
		if (cont.scrollTop + cont.offsetHeight >= cont.scrollHeight - 2) {
			onBottom = true;
		}

		let $msg = $(`<span></span>`)
		$msg.text(content);

		this.$content.append($msg);

		if (onBottom) {
			cont.scrollTo(0, cont.scrollHeight);
		}
	}

	doCleanup() {
		clearInterval(this.pingInterval__);
		clearTimeout(this.fetchTimeout__);
		this.fetchTimeout__ = null;

		if (this.shellId) fetch('/shell/' + this.shellId + '/kill');

		this.exit();
	}
}