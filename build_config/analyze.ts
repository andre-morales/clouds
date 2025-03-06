import * as BuildSystem from './esbuild_system.ts';

BuildSystem.joinMetafiles('all.meta.json', 'apps.meta.json', 'core.meta.json');