// Publicly available core modules accessible from these variables.
// Webpack will make these modules available in a super module called PublicModules.

export * as AppM from './app.mjs';
export * as ClientCoreM from './client_core.mjs';
export * as EventsM from './events.mjs';
import * as UserM from './user.mjs';
export { UserM as '::/@sys/user.mjs' };

export * as BrowserM from './utils/browser.mjs';
export * as UtilsM from './utils/utils.mjs';
export * as WindowM from './ui/window.mjs';
export * as UIFullscreenM from './ui/fullscreen.mjs';
export * as UIDialogsM from './ui/dialogs.mjs';
export * as UtilsObjectsM from './utils/objects.mjs';
export * as UtilsStringsM from './utils/strings.mjs';

import * as FileSystemM from './drivers/filesystem.mjs';
export { FileSystemM as '::/@sys/drivers/filesystem.mjs'};

import * as ClipboardM from './drivers/clipboard.mjs';
export { ClipboardM as '::/@sys/drivers/clipboard.mjs'};

import * as UICtxMenuM from './ui/controls/context_menu/ctx_menu.mjs';
export { UICtxMenuM as '::/@sys/ui/controls/context_menu/ctx_menu.mjs'};

import * as UICtxMenuCheckboxM from './ui/controls/context_menu/ctx_checkbox.mjs';
export { UICtxMenuCheckboxM as '::/@sys/ui/controls/context_menu/ctx_checkbox.mjs'};

import * as DeferredM from '/@comm/deferred.mjs';
export { DeferredM as '::/@comm/deferred.mjs' }

import * as ArraysM from '/@comm/arrays.mjs';
export { ArraysM as '::/@comm/arrays.mjs' }
