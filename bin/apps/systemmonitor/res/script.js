window.SystemMonitorApp = class SystemMonitorApp extends App {
	constructor() {
		super();
		this.window = null;
	}

	async init() {
		// Require resources
		await this.requireStyle('/app/systemmonitor/res/style.css');

		// Create window and fetch app body
		this.window = WebSys.desktop.createWindow();
		this.window.setIcon('/res/img/apps/monitor128.png');
		this.window.on('closereq', () => this.close());
		this.window.setTitle('System Monitor');

		let $win = this.window.$window;
		$win.find('.body').addClass('app-sysmonitor');

		// Fetch explorer body
		await this.window.setContentToUrl('/app/systemmonitor/res/main.html');

		let $tabPane = $win.find('.tabpane');
		$tabPane.find('button').click((ev) => {
			let tab = ev.target.getAttribute('data-tab');
			$tabPane.find('.header .btn').removeClass('selected');
			$tabPane.find('.tab').removeClass('visible');

			ev.target.classList.add('selected');
			$tabPane.find(`.tab[data-tab='${tab}']`).addClass('visible');
		});

		let $appTab = $win.find('.tab[data-tab="apps"]');
		let makeAppEntries = () => {
			$appTab.empty();
			for (let app of WebSys.runningApps) {
				let $app = $(`<div class='app'>${app.classId}</div>`);
				let $endBtn = $('<button>End</button>');
				$endBtn.click(() => {
					app.close();
				});
				$app.append($endBtn);
				$appTab.append($app);
			}
		};
		makeAppEntries();
		WebSys.on('apps-add', makeAppEntries);
		WebSys.on('apps-rem', makeAppEntries);

		// Make the window visible
		this.window.setVisible(true);
	}

	onClose() {
		this.window.close();
	}
}