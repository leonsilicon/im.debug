import fs from 'node:fs';
import Module from 'node:module';
import { pathToFileURL } from 'node:url';
import { transform } from '../transform/index.js';

type Loader = (module: NodeModule, filename: string) => void;

export type Unregister = () => void;

type ExtensionsRecord = Record<string, Loader>;

const EXTENSIONS = ['.js', '.cjs', '.mjs'] as const;

export const register = (): Unregister => {
	const extensions = (Module as unknown as { _extensions: ExtensionsRecord })._extensions;
	const previous: Partial<Record<string, Loader>> = {};

	const make = (defaultLoader: Loader): Loader => (
		module,
		filename,
	) => {
		let source: string;
		try {
			source = fs.readFileSync(filename, 'utf8');
		} catch {
			defaultLoader(module, filename);
			return;
		}

		const transformed = transform(source, {
			url: pathToFileURL(filename).href,
			moduleType: 'cjs',
		});

		if (transformed === undefined) {
			defaultLoader(module, filename);
			return;
		}

		(module as unknown as { _compile: (code: string, filename: string) => void })._compile(
			transformed,
			filename,
		);
	};

	for (const extension of EXTENSIONS) {
		const defaultLoader = extensions[extension] ?? extensions['.js']!;
		previous[extension] = extensions[extension];
		extensions[extension] = make(defaultLoader);
	}

	return () => {
		for (const extension of EXTENSIONS) {
			const original = previous[extension];
			if (original === undefined) {
				delete extensions[extension];
			} else {
				extensions[extension] = original;
			}
		}
	};
};
