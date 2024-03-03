class Mathx {
	static clamp(value, min, max) {
		if (value > max) return max;
		if (value < min) return min;
		return value;
	}	
}

function createSlider(slider){
	slider.attr('data-ready', true);

	// Creating handles
	let $lower = slider.find('.lower');
	if (!$lower.length) {
		$lower = $('<span class="lower"></span>');
		slider.append($lower);
	}

	let $thumb = slider.find('.thumb');
	if (!$thumb.length) {
		$thumb = $('<span class="thumb"></span>');
		slider.append($thumb);
	}

	let attrOr = (elem, attr, def) => {
		let v = elem.attr(attr);
		if (v === 0) return 0;
		if (!v) return def;
		return v; 
	};

	let min = attrOr(slider, "data-min", 0);
	let max = attrOr(slider, "data-max", 100);
	
	let valueChange = (coff, fireEv) => {
		coff = Mathx.clamp(coff, 0, 1);
		let value = min + (max - min) * coff;

		if(slider[0].value == value) return;
		slider[0].value = value;

		$lower.css("width", `${coff * 100}%`);
		$thumb.css("left", `${coff * slider.width() - $thumb.width()/2}px`);
		
		if(fireEv) slider.trigger('change');
	};

	let dragX = (ev) => {
		let mx = ev.pageX;

		let touches = ev.changedTouches;
		if (touches && touches[0]) {
			mx = touches[0].pageX;
		}
		return (mx - slider.offset().left) / slider.width();
	};

	// Event handling
	let held = false;
	$(document).on('mousemove touchmove', (ev) => {
		if(!held) return

		valueChange(dragX(ev), true);	
	});
	
	slider.on('mousedown touchstart', (ev) => {
		held = true;
		valueChange(dragX(ev), true);
	});
	$thumb.on('mousedown touchstart', () => {
		held = true;
	});

	$(document).on('mouseup', (ev) => {
		if(!held) return;

		valueChange(dragX(ev), true);
		held = false;
	});

	// Properties
	slider[0].setValue = (value, fireEv) => {
		valueChange((value-min)/(max-min), fireEv);
	};
	
	// Initial value
	var initval = attrOr(slider, "data-value", 0);
	setTimeout(() => {
		valueChange(Mathx.clamp(initval, min, max));
	}, 0)	
}

function prepareSliders(){
	var sliders = $(".slider");

	for(let i = 0; i < sliders.length; i++){
		let $slider = $(sliders[i]);
		
		if (!$slider.attr('data-ready')) {
			createSlider($slider);	
		}
	}
}