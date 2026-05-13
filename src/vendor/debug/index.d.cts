declare type DebugInstance = ((...args: unknown[]) => void) & {
	enabled: boolean;
	namespace: string;
	extend: (suffix: string, delimiter?: string) => DebugInstance;
};

declare type DebugFactory = ((namespace: string) => DebugInstance) & {
	enable: (namespaces: string) => void;
	disable: () => string;
	enabled: (namespace: string) => boolean;
};

declare const createDebug: DebugFactory;
export = createDebug;
