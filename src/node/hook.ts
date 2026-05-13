import type { LoadHook } from 'node:module';
import { transform } from '../transform/index.js';

const TRANSFORMABLE_FORMATS = new Set(['module', 'commonjs']);

export const load: LoadHook = async (
	url,
	context,
	nextLoad,
) => {
	const loaded = await nextLoad(url, context);

	if (!loaded.source || !TRANSFORMABLE_FORMATS.has(loaded.format ?? '')) {
		return loaded;
	}

	if (!url.startsWith('file:')) {
		return loaded;
	}

	const code = typeof loaded.source === 'string'
		? loaded.source
		: Buffer.from(loaded.source as ArrayBufferLike).toString('utf8');

	const transformed = transform(code, {
		url,
		moduleType: loaded.format === 'commonjs' ? 'cjs' : 'esm',
	});

	if (transformed === undefined) {
		return loaded;
	}

	return {
		format: loaded.format,
		source: transformed,
		shortCircuit: true,
	};
};
