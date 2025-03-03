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
		const callback = (entries: PerformanceEntryList) => {
			// For every past and new activity, add new entries
			for (let entry of entries) {
				this.trackFetchCall(entry as PerformanceResourceTiming);
			}
		}

		// Method 1 of instantiating.
		try {
			new PerformanceObserver(e => callback(e.getEntries()))
				.observe({type: "resource", buffered: true});
			return;
		} catch(err) {
			console.error("PerformanceObserver() failed.", err);
		}

		// Method 2 of instantiating in case 1 isn't supported.
		try {
			new PerformanceObserver(e => callback(e.getEntries()))
				.observe({ entryTypes: ['resource'] });

			// Emit past resource entries
			let entries = performance.getEntriesByType('resource');
			callback({ getEntries: () => entries} as any );
			return;
		} catch(err) {
			console.error("PerformanceObserver() failed.", err);
		}

		this.$networkTab.text("Not available.");
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