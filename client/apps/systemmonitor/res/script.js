window.SystemMonitorApp = class SystemMonitorApp extends App {
	constructor(...args) {
		super(...args);
		this.window = null;
	}

	async init() {
		// Create window and fetch app body
		this.window = Client.desktop.createWindow(this);
		this.window.setIcon('/res/img/apps/monitor128.png');
		this.window.on('closereq', () => {
			this.window.close();
			this.exit();
		});
		this.window.setTitle('System Monitor');

		let $win = this.window.$window;
		$win.find('.window-body').addClass('app-sysmonitor');

		// Fetch app body
		await this.window.setContentToUrl('/app/systemmonitor/res/main.html');

		// Tab pane behavior
		let $tabPane = $win.find('.tabpane');
		$tabPane.find('button').click((ev) => {
			let tab = ev.target.getAttribute('data-tab');
			$tabPane.find('.header .button').removeClass('selected');
			$tabPane.find('.tab').removeClass('visible');

			ev.target.classList.add('selected');
			$tabPane.find(`.tab[data-tab='${tab}']`).addClass('visible');
		});

		// Apps tab
		let $appTab = $win.find('.tab[data-tab="apps"]');
		let makeAppEntries = () => {
			$appTab.empty();
			for (let app of Client.runningApps) {
				let $app = $(`<div class='app'>${app.classId}</div>`);
				let $endBtn = $('<button class="button">End</button>');
				$endBtn.click(() => {
					app.exit();
				});
				$app.append($endBtn);
				$appTab.append($app);
			}
		};

		Client.on('apps-add', makeAppEntries);
		Client.on('apps-rem', makeAppEntries);

		// Windows tab
		let $windowsTab = $win.find('.tab[data-tab="windows"]');
		let makeWindowsEntries = () => {
			$windowsTab.empty();
			for (let win of Client.desktop.windows) {

				let $win = $(`<div class='win'>${win.title}</div>`);

				let $closeBtn = $('<button class="button">Close</button>');
				$closeBtn.click(() => {
					win.close();
				});
				$win.append($closeBtn);

				let $destroyBtn = $('<button class="button">Destroy</button>');
				$destroyBtn.click(() => {
					Client.desktop.destroyWindow(win);
				});
				$win.append($destroyBtn);

				$windowsTab.append($win);
			}
		};

		Client.desktop.events.on('window-created', makeWindowsEntries);
		Client.desktop.events.on('window-destroyed', makeWindowsEntries);

		makeAppEntries();
		makeWindowsEntries();
		
		// Make the window visible
		this.window.setVisible(true);
	}
}