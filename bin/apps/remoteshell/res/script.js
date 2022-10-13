window.RemoteShellApp = class RemoteShellApp extends App {
	constructor() {
		super();
		this.window = null;
		this.shellId = null;
	}

	async init() {
		let fres = await fetch('/shell/0/init');
		if (fres.status != 200) {
			WebSys.showErrorDialog('Shell creation failed.');
			this.close();
			return;
		}

		this.shellId = await fres.json();

		// Require resources
		await this.requireStyle('/app/remoteshell/res/style.css');

		// Create window and fetch app body
		this.window = WebSys.desktop.createWindow();
		this.window.icon = '/res/img/apps/terminal128.png';
		this.window.on('closereq', () => this.close());
		
		this.window.setTitle('Remote Shell');
		let $win = this.window.$window;
		$win.addClass('app-remoteshell');

		// Fetch explorer body
		await this.window.setContentToUrl('/app/remoteshell/res/main.html');

		let $field = $win.find('input');
		$field.on('keydown', (ev) => {
			if (ev.which != 13) return;
			
			let cmd = $field.val();
			fetch('/shell/' + this.shellId + '/send', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
			    },
				body: JSON.stringify({'cmd': cmd})
			});
		})

		let $content = $win.find('.content');

		let call = async () => {
			let fres = await fetch('/shell/' + this.shellId + '/stdout_new', {
				cache: "no-cache"
			});
			if (fres.status != 200) {
				console.error('Fetch n returned: ' + fres.status);
				return;
			}
			let content = await fres.text();
			content = content.replaceAll('\n', '<br>');

			$content.html($content.html() + content);

			if (!this.fetchTimeout__) return;
			this.fetchTimeout__ = setTimeout(call);
		};	

		this.fetchTimeout__ = setTimeout(call, 1);

		this.pingInterval__ = setInterval(async () => {
			fetch('/shell/' + this.shellId + '/ping');
		}, 10000)

		// Make the window visible
		this.window.setVisible(true);
	}

	onClose() {
		clearInterval(this.pingInterval__);
		clearTimeout(this.fetchTimeout__);
		this.fetchTimeout__ = null;

		if (this.shellId) fetch('/shell/' + this.shellId + '/kill');
		if (this.window) this.window.close();
	}
}