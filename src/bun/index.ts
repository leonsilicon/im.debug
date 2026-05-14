import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { transform } from '../transform/index.js';

type BunLoader = 'js' | 'jsx' | 'ts' | 'tsx';

type OnLoadResult = {
	contents?: string;
	loader?: BunLoader;
};

type OnLoadArgs = {
	path: string;
};

type PluginBuilder = {
	onLoad: (
		filter: {
			filter: RegExp;
			namespace?: string;
		},
		callback: (args: OnLoadArgs) => OnLoadResult | undefined,
	) => void;
};

type BunPlugin = {
	name: string;
	setup: (build: PluginBuilder) => void;
};

type BunGlobal = {
	plugin: (plugin: BunPlugin) => void;
};

const FILTER = /\.[mc]?[jt]sx?$/;

const loaderFor = (filePath: string): BunLoader => {
	if (filePath.endsWith('.tsx')) {
		return 'tsx';
	}
	if (filePath.endsWith('.jsx')) {
		return 'jsx';
	}
	if (/\.[mc]?ts$/.test(filePath)) {
		return 'ts';
	}
	return 'js';
};

const syntaxFor = (filePath: string): 'js' | 'jsx' | 'ts' | 'tsx' => {
	if (filePath.endsWith('.tsx')) {
		return 'tsx';
	}
	if (filePath.endsWith('.jsx')) {
		return 'jsx';
	}
	if (/\.[mc]?ts$/.test(filePath)) {
		return 'ts';
	}
	return 'js';
};

export const imDotDebugBunPlugin: BunPlugin = {
	name: 'im.debug',
	setup(build) {
		build.onLoad({ filter: FILTER }, ({ path }) => {
			let source: string;
			try {
				source = fs.readFileSync(path, 'utf8');
			} catch {
				return {
					contents: '',
					loader: loaderFor(path),
				};
			}

			const transformed = transform(source, {
				url: pathToFileURL(path).href,
				moduleType: path.endsWith('.cjs') || path.endsWith('.cts') ? 'cjs' : 'esm',
				syntax: syntaxFor(path),
			});

			return {
				contents: transformed ?? source,
				loader: loaderFor(path),
			};
		});
	},
};

const bun = (globalThis as { Bun?: BunGlobal }).Bun;
if (bun && typeof bun.plugin === 'function') {
	bun.plugin(imDotDebugBunPlugin);
}

export default imDotDebugBunPlugin;
