window.AudioConf = class AudioConf extends App {
	constructor(webSys) {
		super(webSys);
		this.window = null;
	}

	async init() {
		// Require resources
		this.requireStyle('/app/audioconf/res/style.css');

		// Create window and fetch app body
		this.window = webSys.desktop.createWindow();
		this.window.icon = '/res/img/apps/audio128.png';
		this.window.on('closereq', () => this.close());
		
		this.window.setTitle('Audio System');
		let $win = this.window.$window;
		$win.find('.body').addClass('app-audioconf');
		
		// Fetch explorer body
		await this.window.setContentToUrl('/app/audioconf/res/main.html');

		let $mgain = $win.find('.master-gain');
		let $mrais = $win.find('.master-raiser');

		let change = () => {
			let mg = $mgain.val();
			let mr = $mrais.val() ** 2;

			webSys.audioDestination.gain.value = mg / 100.0 * mr;

			$('.master-gain-text').text(mg + '%');
			$('.master-raiser-text').text(mr + 'x times');
		}

		$mgain.on('input', change);
		$mrais.on('input', change);

		let $eqinf = $win.find('.eq-inf');
		$eqinf.on('input', () => {
			this.eqInfluence = $eqinf.val();
			this.recalcEq();

			$win.find('.eq-inf-text').text(this.eqInfluence);
		});

		this.maxEqDb = 12;
		this.eqInfluence = 1.0;
		this.eqPoints = [[0.1, 0.2], [0.5, 0.5], [0.7, -0.5]];
		this.setupEq();
		
		// Make the window visible
		this.restoreAppWindowState(this.window);
		this.window.setVisible(true);
		this.redrawEq();

		this.window.focus();
	}

	setupEq() {
		let $canvas = this.window.$window.find('.audio-eq canvas');
		this.eqCanvas = $canvas[0];
		this.eqCanvasContext = this.eqCanvas.getContext('2d');
		this.window.on('resize', () => this.redrawEq());

		let held = false;
		let heldPoint = null;

		let mdown = (clx, cly) => {
			let rect = this.eqCanvas.getBoundingClientRect();
			let mx = clx - rect.x;
			let my = cly - rect.y;
			let cx = mx / rect.width;
			let cy = my / rect.height * 2 - 1;
			let abs = Math.abs;

			for (let p of this.eqPoints) {
				if (abs(p[0] - cx) < 0.1 &&
					abs(-p[1] - cy) < 0.1) {
					heldPoint = p;
					held = true;
					break;
				}
			}
		};
		let mmove = (cx, cy) => {
			if (!held) return;

			let rect = this.eqCanvas.getBoundingClientRect();
			let mx = cx - rect.x;
			let my = cy - rect.y;

			heldPoint[0] = mx / rect.width;
			heldPoint[1] = -my / rect.height * 2 + 1;

			this.recalcEq();

			this.redrawEq();
		};

		$canvas.on('mousedown', (e) => {
			mdown(e.clientX, e.clientY);
		});
		$canvas.on("touchstart", (e) => {
			let mx = e.changedTouches[0].pageX;
			let my = e.changedTouches[0].pageY;
			mdown(mx, my);
		});

		$(document).on('mouseup', (e) => {
			held = false;
		});
		$(document).on("touchend", () => {
			held = false;
		});

		$(document).on('mousemove', (e) => {
			mmove(e.clientX, e.clientY);
		});
		$(document).on('touchmove', (e) => {
			let mx = e.changedTouches[0].pageX;
			let my = e.changedTouches[0].pageY;
			mmove(mx, my);
		});
	}

	recalcEq() {
		let points = this.eqPoints;
		let controls = [
			webSys.lowshelf,
			webSys.mids,
			webSys.highshelf
		];

		for (let i = 0; i < points.length; i++) {
			let p = points[i];
			let c = controls[i];

			let fr = 2 ** (p[0] * 10) * 20;
			let dB = p[1] * this.maxEqDb * this.eqInfluence;

			c.gain.value = dB;
			c.frequency.value = fr; 
		}
	}

	redrawEq() {
		let canvas = this.eqCanvas;
		let gr = this.eqCanvasContext;

		let bounds = canvas.getBoundingClientRect();
		let scaling = 1.2;
		let gw = bounds.width * scaling;
		let gh = bounds.height * scaling;
		canvas.width = gw;
		canvas.height = gh;

		// Grid
		gr.strokeStyle = 'gray';
		gr.beginPath()
		gr.moveTo(0, gh / 2);
		gr.lineTo(gw, gh / 2);
		gr.stroke();

		for (let x = 0.1; x < 1; x += 0.1) {
			gr.moveTo(gw * x, 0);
			gr.lineTo(gw * x, gh);
			gr.stroke();
		}

		// Points
		let points = this.eqPoints;
		let pointsXY = points.map((p) => {
			let px = p[0] * gw;
			let py = (-p[1] + 1) / 2 * gh;
			return [px, py];
		});
		gr.strokeStyle = 'white';
		gr.font = '11pt sans-serif';
		gr.fillStyle = 'white';
		gr.lineWidth = 2;
		gr.beginPath();
		gr.moveTo(0, pointsXY[0][1]);
		for (let p of pointsXY) {
			gr.lineTo(p[0], p[1]);
		}
		gr.lineTo(gw, pointsXY[pointsXY.length-1][1]);
		gr.stroke();

		gr.fillStyle = '#7F8';
		for (let p of pointsXY) {
			gr.beginPath();
			gr.arc(p[0], p[1], 5, 0, Math.PI * 2)
			gr.fill();
		}

		gr.fillStyle = '#ACF';
		for (let p of points) {
			let px = p[0] * gw;
			let py = (-p[1] + 1) / 2 * gh;

			let fr = 2 ** (p[0] * 10) * 20;
			let dB = p[1] * this.maxEqDb;
			gr.fillText(fr.toFixed(0) + ' Hz | ' + dB.toFixed(1) + ' dB', px - 40, py+20);
		}
		
	}

	onClose() {
		this.saveAppWindowState(this.window);
		this.window.close();
	}
}