/**
 * im.debug Babel plugin entry for Expo / Metro.
 * @see https://github.com/leonsilicon/im.debug
 */
const transformImportMetaDebug = require('im.debug/plugin');

const plugin = transformImportMetaDebug.default ?? transformImportMetaDebug;

/** @type {import('@babel/core').PluginItem[]} */
module.exports = [
	[
		plugin,
		{
			module: 'esm',
			// Default specifier is im.debug/runtime; metro.config.js aliases it to
			// src/im-debug-runtime.ts (Hermes-safe; dist/runtime targets Node).
		},
	],
];
