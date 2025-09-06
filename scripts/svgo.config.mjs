export default {
	multipass: true,
	plugins: [
		{
			name: 'preset-default',
			params: {
				overrides: {
					cleanupNumericValues: {
						floatPrecision: 0
					},
					convertPathData: {
						floatPrecision: 1,
						transformPrecision: 0
					},
					convertShapeToPath: false,
					convertTransform: {
						degPrecision: 0,
						floatPrecision: 0,
						transformPrecision: 2,
					},
					mergePaths: {
						floatPrecision: 0
					}
				}
			}
		},
		{
			name: 'cleanupListOfValues',
			params: {
				floatPrecision: 0
			}
		},
		'convertStyleToAttrs',
		'convertOneStopGradients',
	]
}