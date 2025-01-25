// Publicly available core modules accessible from these variables.
// Webpack will make these modules available in a super module called PublicModules.
export * as ClientCoreM from './client_core.mjs';
export * as AppM from './app.mjs';
export * as FileSystemM from './bridges/filesystem.mjs';
export * as EventsM from './events.mjs';
export * as ClipboardM from './bridges/clipboard.mjs';
export * as BrowserM from './utils/browser.mjs';
export * as UtilsM from './utils/utils.mjs';
export * as WindowM from './ui/window.mjs';
export * as UIFullscreenM from './ui/fullscreen.mjs';
export * as UIDialogsM from './ui/dialogs.mjs';
export * as UICtxMenuM from './ui/context_menu.mjs';
export * as UtilsObjectsM from './utils/objects.mjs';
export * as UtilsStringsM from './utils/strings.mjs';

import * as DeferredM from '/@comm/deferred.mjs';
export { DeferredM as '::/@comm/deferred.mjs' }

import * as ArraysM from '/@comm/arrays.mjs';
export { ArraysM as '::/@comm/arrays.mjs' }
