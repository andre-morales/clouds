window.AudioConf = class AudioConf extends App {
	constructor() {
		super();
		this.window = null;
	}

	async init() {
		const self = this;

		// Require resources
		this.requireStyle('/app/audioconf/res/style.css');

		// Create window and fetch app body
		this.window = WebSys.desktop.createWindow(this);
		this.window.setIcon('/res/img/apps/audio128.png');
		this.window.on('closereq', () => this.close());
		
		this.window.setTitle('Audio System');
		let $win = this.window.$window;
		$win.find('.body').addClass('app-audioconf');
		
		// Fetch explorer body
		await this.window.setContentToUrl('/app/audioconf/res/main.html');

		let $mgain = $win.find('.master-gain');
		let $mrais = $win.find('.master-raiser');

		let change = () => {
			let mg = $mgain.val() ** 2;
			let mr = $mrais.val() ** 5;

			WebSys.audio.final.gain.value = mg * mr;

			$('.master-gain-text').text((mg * 100).toFixed(0) + '%');
			$('.master-raiser-text').text(mr.toFixed(1) + 'x times');
		}

		$mgain.on('input', change);
		$mrais.on('input', change);

		let $eqinf = $win.find('.eq-inf');
		$eqinf.on('input', () => {
			this.eqInfluence = $eqinf.val() ** 2;
			this.recalcEq();

			$win.find('.eq-inf-text').text(this.eqInfluence.toFixed(2));
		});
		$win.find('.eq-apply-btn').click(() => {
			for (let p of this.eqPoints) {
				p[1] *= this.eqInfluence;
			}

			this.eqInfluence = 1;
			$eqinf.val(1);
			$win.find('.eq-inf-text').text('1.00');
			this.redrawEq();
		});
		$win.find('.clip-enable').change(function() {
			WebSys.audio.clipEnabled = this.checked;
		});
		$win.find('.clip-bound').on('input', function() {
			let v = this.value * 1.0;
			$win.find('.clip-bound-text').text(v.toFixed(2));
			WebSys.audio.clipBound = v;
		});


		$win.find('.echo').on('input', function() {
			let v = this.value;
			WebSys.audio.setReverbBalance(v);
		});
		$win.find('.delaygain').on('input', function() {
			let v = this.value;
			WebSys.audio.delayFeedbackGain.gain.value = v;
		});
		$win.find('.stage-title').click(function() {
			$(this).parent().toggleClass('collapsed');
		})
		this.maxEqDb = 12;
		this.eqInfluence = 1.0;
		this.eqPoints = [];

		for (let p of WebSys.audio.eqPoints) {
			let fr = Math.log2(p.frequency.value / 20) / 10;
			let gain = p.gain.value / this.maxEqDb;
			this.eqPoints.push([fr, gain]);
		}
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
		let heldPointI = -1;

		let mdown = (clx, cly) => {
			let rect = this.eqCanvas.getBoundingClientRect();
			let mx = clx - rect.x;
			let my = cly - rect.y;
			let cx = mx / rect.width;
			let cy = my / rect.height * 2 - 1;
			let abs = Math.abs;

			for (let i = 0; i < this.eqPoints.length; i++) {
				let p = this.eqPoints[i];
				if (abs(p[0] - cx) < 0.05 &&
					abs(-p[1] - cy) < 0.05) {
					heldPointI = i;
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
			let pts = this.eqPoints;

			let fr = clampf(mx / rect.width, 0, 1);

			let nextI = heldPointI + 1;
			if (nextI < pts.length && fr > pts[nextI][0]) {
				pts[heldPointI][0] = pts[nextI][0];
				pts[heldPointI][1] = pts[nextI][1];

				heldPointI += 1;
			}

			let prevI = heldPointI - 1;
			if (prevI >= 0 && fr < pts[prevI][0]) {
				pts[heldPointI][0] = pts[prevI][0];
				pts[heldPointI][1] = pts[prevI][1];

				heldPointI -= 1;
			}

			let gain = clampf(-my / rect.height * 2 + 1, -1, 1);
			pts[heldPointI][0] = fr;
			pts[heldPointI][1] = gain;

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
		let controls = WebSys.audio.eqPoints;

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
		let $canvasC = this.window.$window.find('.audio-eq');
		let canvas = this.eqCanvas;
		let gr = this.eqCanvasContext;

		let bounds = $canvasC[0].getBoundingClientRect();
		let scaling = 1;
		let gw = bounds.width * scaling - 1;
		let gh = bounds.height * scaling - 1;
		canvas.width = Math.trunc(gw);
		canvas.height = Math.trunc(gh);

		// Grid
		gr.strokeStyle = '#146';
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
		gr.font = 'bold 11pt sans-serif';
		gr.fillStyle = 'white';
		gr.lineWidth = 1;
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

		gr.fillStyle = '#9BF';
		for (let i = 0; i < points.length; i++) {
			let p = points[i];
			
			let fr = 2 ** (p[0] * 10) * 20;
			let gain = p[1] * this.maxEqDb;

			let frStr;
			if (fr > 1000) {
				frStr = (fr / 1000).toFixed(1) + ' kHz';
			} else if (fr > 500) {
				frStr = Math.round(fr / 10) * 10 + ' Hz';
			} else if (fr > 100) {
				frStr = Math.round(fr / 5) * 5 + ' Hz';
			} else {
				frStr = Math.round(fr) + ' Hz';
			}

			let px = pointsXY[i][0] - 40
			let py = pointsXY[i][1] + 20;
			gr.fillText(`${frStr} | ${gain.toFixed(1)} dB`, px, py);
		}
		
	}

	onClose() {
		this.saveAppWindowState(this.window);
		this.window.close();
	}
}