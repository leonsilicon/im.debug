import createDebug from 'debug';

type DebugInstance = ReturnType<typeof createDebug>;

const instanceCache = new Map<string, DebugInstance>();

const fileUrlToPath = (url: string): string => {
	const u = new URL(url);
	return decodeURIComponent(u.pathname);
};

const urlToNamespace = (url: string): string => {
	if (url.startsWith('file://')) {
		try {
			return fileUrlToPath(url);
		} catch {
			return url;
		}
	}
	return url;
};

const getInstance = (url: string): DebugInstance => {
	let instance = instanceCache.get(url);
	if (!instance) {
		instance = createDebug(urlToNamespace(url));
		instanceCache.set(url, instance);
	}
	return instance;
};

/**
 * Same contract as im.debug/runtime — Metro resolves `im.debug/runtime` here
 * because the published runtime bundle uses Node builtins (unsuitable for Hermes).
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

export { createDebug as debug };
