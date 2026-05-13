import module from 'node:module';
import { isMainThread } from 'node:worker_threads';

export { load } from './hook.js';

// Loaded via `--import imdebug/esm` or `import 'imdebug/esm'`.
// Re-register this module with the loader hooks API so its exported `load`
// hook is wired in. The query string forces a fresh load if registered twice.
if (typeof module.register === 'function' && isMainThread) {
	module.register(
		`${import.meta.url}?imdebug=${Date.now()}`,
	);
}
