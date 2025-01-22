import FetchesTab from "./fetches_tab.mjs";
import NetworkPerformanceTab from "./network_performance_tab.mjs";
import ResourcesTab from "./resources_tab.mjs";
import App from "/@sys/app.mjs";
import { ClientClass } from "/@sys/client_core.mjs";
import Window from "/@sys/ui/window.mjs";
import Strings from "/@sys/utils/strings.mjs";
import { FetchEvent, WatsonTools } from "/@sys/watson_tools.mjs";

var Client: ClientClass;

export default class SystemMonitorApp extends App {
	private window: Window;
	private currentTab: string;	
	private fetchesTab: FetchesTab;
	private networkPerformanceTab: NetworkPerformanceTab;
	private resourcesTab: ResourcesTab;
	public $app: $Element;

	constructor(...args: ConstructorParameters<typeof App>) {
		super(...args);
		Client = ClientClass.get();
		this.window = null;
		this.currentTab = '';
	}

	async init() {
		// Create window and fetch app body
		this.window = Client.desktop.createWindow(this);
		this.window.on('closing', () => {
			this.resourcesTab.exit();
			this.exit();
		});
		this.window.setTitle('System Monitor');

		let $win = this.window.$window;
		let $app = $win.find('.window-body').addClass('app-sysmonitor');
		this.$app = $app;

		// Fetch app body
		await this.window.setContentToUrl('/app/systemmonitor/res/main.html');

		this.fetchesTab = new FetchesTab(this);
		this.networkPerformanceTab = new NetworkPerformanceTab(this);
		this.resourcesTab = new ResourcesTab(this);

		// Configure tab pane behavior
		let $tabPane = $app.find('ui-tabs');
		$tabPane[0].onTabChanged = (tab: string) => {
			if (tab == 'resources') {
				this.resourcesTab.focus();
			} else {
				this.resourcesTab.unfocus();
			}
		};

		// Apps tab
		let $appTab = $win.find('.ui-tab[data-tab="apps"]');
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

		Client.events.on('apps-add', makeAppEntries);
		Client.events.on('apps-rem', makeAppEntries);

		// Windows tab
		let $windowsTab = $win.find('.ui-tab[data-tab="windows"]');
		let makeWindowsEntries = () => {
			$windowsTab.empty();
			for (let win of Client.desktop.getWindowManager().getWindows()) {

				let $win = $(`<div class='win'>${win.getTitle()}</div>`);

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