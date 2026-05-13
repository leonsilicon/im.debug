/* eslint-disable @typescript-eslint/triple-slash-reference */
/* eslint-disable @typescript-eslint/consistent-type-definitions */
/* eslint-disable unicorn/require-module-specifiers */
/// <reference types="debug" />

import type * as debug from 'debug';

declare global {
	interface ImportMeta {
		readonly debug?: debug.Debugger;
	}
}

export {};
/* eslint-enable @typescript-eslint/triple-slash-reference */
/* eslint-enable @typescript-eslint/consistent-type-definitions */
/* eslint-enable unicorn/require-module-specifiers */
