if (__BASELINE_CHROME__ < 92) {
	require('core-js/stable/string/at');
	require('core-js/stable/string/replace-all');
	require('core-js/stable/array/flat');
}

if (__BASELINE_CHROME__ < 54) {
	require('core-js/stable/object/entries');
	require('core-js/stable/object/values');
	require('core-js/stable/dom-collections/iterator');

	require('@webcomponents/custom-elements');
	require('@webcomponents/shadydom');
}

import '../styles/base.scss';