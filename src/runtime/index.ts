import { basename } from 'pathe';
import createDebug from '../vendor/debug/index.cjs';

type DebugInstance = ((...args: unknown[]) => void) & { enabled: boolean };

type DebugFactory = (namespace: string) => DebugInstance;

const factory = createDebug as unknown as DebugFactory;

const instanceCache = new Map<string, DebugInstance>();

const fileUrlToPath = (url: string): string => {
	let pathname = url.slice('file://'.length);
	const slash = pathname.indexOf('/');
	if (slash > 0) {
		pathname = pathname.slice(slash);
	}
	return pathname.replace(/%([\da-f]{2})/gi, (_, hex: string) => (
		String.fromCharCode(Number.parseInt(hex, 16))
	));
};

const urlToNamespace = (url: string): string => {
	const raw = url.startsWith('file://') ? fileUrlToPath(url) : url;
	return basename(raw) || raw;
};

const getInstance = (url: string): DebugInstance => {
	let instance = instanceCache.get(url);
	if (!instance) {
		instance = factory(urlToNamespace(url));
		instanceCache.set(url, instance);
	}
	return instance;
};

/**
 * Called by code transformed from `import.meta.debug?.(...)`.
 *
 * The transform injects the source URL plus the line and column of the call
 * site. The first message argument is prefixed with `[file:line:col]` so the
 * location is visible even when the consumer passes a non-string value.
 */
export const __imDotDebug = (
	url: string,
	line: number,
	column: number,
	...args: unknown[]
): void => {
	const debug = getInstance(url);
	if (!debug.enabled) {
		return;
	}

	const location = `[${urlToNamespace(url)}:${line}:${column}]`;
	if (args.length === 0) {
		debug(location);
		return;
	}

	const [first, ...rest] = args;
	if (typeof first === 'string') {
		debug(`${location} ${first}`, ...rest);
	} else {
		debug(location, first, ...rest);
	}
};

export { factory as debug };
