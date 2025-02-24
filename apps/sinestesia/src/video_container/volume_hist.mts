import { ContentType } from "../media_player.mjs";
import { VideoContainer } from "./video_container.mjs";
import { Paths } from "/@sys/drivers/filesystem.mjs";

export class VolumeHistogram {
	private container: VideoContainer;
	private volumes: number[];
	private $root: $Element;
	private $canvas: $Element;
	private lastDrawWidth: number;

	constructor(container: VideoContainer) {
		this.container = container;
		this.container.getPlayer().events.on('media-change', async (ev) => {
			if (ev.contentType != ContentType.VIDEO) return;
			this.clear();
			await this.extractVolumes();
			this.draw();
		});

		this.$root = this.container.getRoot();
		this.$canvas = this.$root.find('canvas');
		
		let observer = new ResizeObserver(() => { 
			this.draw();
		});
		observer.observe(this.$root[0]);
	}

	private clear() {
		this.volumes = [];
		this.draw(true);
	}

	private async extractVolumes() {
		let url = this.container.getContentUrl();

		let fUrl = new URL('/fsmx/hist' + Paths.removeFSPrefix(url), window.location.href);
		fUrl.searchParams.set('i', '512');
		let fRes = await fetch(fUrl);
		let volumes = await fRes.json();
		this.volumes = volumes;
	}

	private resizeCanvas() {
		let $parent = $('.progressbar').parent()[0] as HTMLElement;
		let $prog = $('.progressbar')[0] as HTMLElement;
		
		let rectParent = $parent.getBoundingClientRect();
		let rectProg = $prog.getBoundingClientRect();
		
		// Get how spaced the progressbar is related to its parent, and have the canvas match it
		let top = rectProg.top - rectParent.top;
		let right = rectParent.right - rectProg.right;
		let left = rectProg.left - rectParent.left;
			
		let $container = this.$canvas.parent();
		$container.css('left', left + 'px');
		$container.css('right', right + 'px');
		$container.css('bottom', `calc(100% - ${top}px)`);
	}

	private draw(force?: boolean) {
		if (!this.volumes) return;
		if (!this.container.getPlayer().app.isAlive()) return;
			
		this.resizeCanvas();

		const canvas = this.$canvas[0] as HTMLCanvasElement;
		let cw = canvas.clientWidth;
		let ch = canvas.clientHeight;

		// Only redraw canvas if it got bigger, unless it is a forced redraw
		if (force) {
			this.lastDrawWidth = 0;
		} else {
			if (cw < this.lastDrawWidth) return;
			this.lastDrawWidth = cw;
		}

		canvas.width = cw;
		canvas.height = ch;

		const ctx = canvas.getContext('2d');
		ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
		
		let bw = cw / this.volumes.length;
		let x = 0;
		for (let vol of this.volumes) {
			let bh = ch * (0.05 + 0.95 * vol);
			ctx.fillRect(x, ch - bh, bw, bh);
			x += bw;    
		}	  
	}
}