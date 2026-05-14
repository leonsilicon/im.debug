const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const { resolver } = config;
const originalResolveRequest = resolver.resolveRequest;

resolver.resolveRequest = (context, moduleName, platform) => {
	if (moduleName === 'im.debug/runtime') {
		return {
			type: 'sourceFile',
			filePath: path.resolve(__dirname, 'src/im-debug-runtime.ts'),
		};
	}
	if (originalResolveRequest) {
		return originalResolveRequest(context, moduleName, platform);
	}
	return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
