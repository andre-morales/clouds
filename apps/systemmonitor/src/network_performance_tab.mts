import SystemMonitorApp from "./core.mjs";
import Strings from "/@sys/utils/strings.mjs";

export default class NetworkPerformanceTab {
	private app: SystemMonitorApp;
	private $networkTab: $Element;

	constructor(app: SystemMonitorApp) {
		this.app = app;
		let $app = app.$app;
		this.$networkTab = $app.find('.network-tab');
		this.setup();
	}

	private setup() {
		// For every past and new activity, add new entries
		new PerformanceObserver((entries) => {
			for (let entry of entries.getEntries()) {
				this.trackFetchCall(entry as PerformanceResourceTiming);
			}
		}).observe({type: "resource", buffered: true});
	}

	private trackFetchCall(rt: PerformanceResourceTiming) {
		const $requests = this.$networkTab.find('tbody');

		let $req = $("<tr></tr>");
		let $status = $(`<td>${rt.responseStatus ?? '-'}</td>`);
		let $resource = $(`<td>${new URL(rt.name).pathname}</td>`);
		let $time = $(`<td>${rt.duration.toFixed(0)} ms</td>`).appendTo($req);
		let $size = $(`<td>${this.sizeToText(rt.decodedBodySize)}</td>`).appendTo($req);
		let $transfer = $(`<td>${this.sizeToText(rt.transferSize)}</td>`).appendTo($req);
		
		($req as any).append([$status, $resource, $time, $size, $transfer]);

		// If the content in the table is scrolled to the bottom, we will auto-scroll it again with
		// the new content
		let scroll;
		let cont: HTMLElement = this.$networkTab[0];
		if (cont.scrollTop + cont.offsetHeight >= cont.scrollHeight - 2) {
			scroll = true;
		}
		
		// Add the new line and scroll the table if needed
		$requests.append($req);
		if (scroll) {
			cont.scrollTo(cont.scrollLeft, cont.scrollHeight);
		}
	}

	private sizeToText(size: number): string {
		if (Number.isNaN(size)) return '-';

		return Strings.fromDataSize(size);
	}
}