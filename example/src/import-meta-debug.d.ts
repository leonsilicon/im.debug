import type * as debug from 'debug';

declare global {
	interface ImportMeta {
		readonly debug?: debug.Debugger;
	}
}

export {};
