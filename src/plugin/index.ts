import { pathToFileURL } from 'node:url';
import type { NodePath, PluginObj, PluginPass } from '@babel/core';
import type * as BabelTypes from '@babel/types';

export type PluginOptions = {

	/** Module format to emit. Defaults to `'esm'`. */
	module?: 'esm' | 'cjs';

	/** Module specifier for the runtime. Defaults to `'im.debug/runtime'`. */
	runtimeSpecifier?: string;

	/**
	 * Override the source URL baked into each call. By default the plugin
	 * derives a `file://` URL from `state.filename`.
	 */
	url?: string;
};

const DEFAULT_RUNTIME = 'im.debug/runtime';
const RUNTIME_LOCAL_HINT = '_imDotDebugRuntime';

const isImportMetaDebug = (callee: BabelTypes.Node): boolean => (
	callee.type === 'MemberExpression'
	&& !callee.computed
	&& callee.property.type === 'Identifier'
	&& callee.property.name === 'debug'
	&& callee.object.type === 'MetaProperty'
	&& callee.object.meta.name === 'import'
	&& callee.object.property.name === 'meta'
);

const resolveUrl = (
	state: PluginPass,
	override: string | undefined,
): string | undefined => {
	if (override !== undefined) {
		return override;
	}
	const { filename } = state;
	if (filename === undefined || filename === '') {
		return;
	}
	if (/^[a-z]+:/i.test(filename)) {
		return filename;
	}
	return pathToFileURL(filename).href;
};

type State = PluginPass & {
	imDebugUrl?: string;
	imDebugRuntimeLocal?: string;
	imDebugMatched?: boolean;
};

type BabelApi = { types: typeof BabelTypes };

const transformImportMetaDebug = ({ types: t }: BabelApi): PluginObj<State> => ({
	name: 'transform-import-meta-debug',

	visitor: {
		Program: {
			enter(programPath, state): void {
				const options = (state.opts as PluginOptions | undefined) ?? {};
				const url = resolveUrl(state, options.url);
				if (url === undefined) {
					return;
				}
				state.imDebugUrl = url;
				state.imDebugRuntimeLocal = programPath.scope.generateUid(RUNTIME_LOCAL_HINT);
				state.imDebugMatched = false;
			},
			exit(programPath, state): void {
				if (state.imDebugMatched !== true || state.imDebugRuntimeLocal === undefined) {
					return;
				}
				const options = (state.opts as PluginOptions | undefined) ?? {};
				const moduleType = options.module ?? 'esm';
				const specifier = options.runtimeSpecifier ?? DEFAULT_RUNTIME;
				const local = t.identifier(state.imDebugRuntimeLocal);
				const specifierLiteral = t.stringLiteral(specifier);
				const declaration = (
					moduleType === 'cjs'
						? t.variableDeclaration('var', [
							t.variableDeclarator(
								local,
								t.callExpression(t.identifier('require'), [specifierLiteral]),
							),
						])
						: t.importDeclaration(
							[t.importNamespaceSpecifier(local)],
							specifierLiteral,
						)
				);
				programPath.unshiftContainer('body', declaration);
			},
		},

		CallExpression(callPath, state): void {
			rewrite(t, callPath, state);
		},

		OptionalCallExpression(callPath, state): void {
			rewrite(t, callPath, state);
		},
	},
});

const rewrite = (
	t: typeof BabelTypes,
	callPath: NodePath<BabelTypes.CallExpression> | NodePath<BabelTypes.OptionalCallExpression>,
	state: State,
): void => {
	const { node } = callPath;
	if (!isImportMetaDebug(node.callee)) {
		return;
	}
	const url = state.imDebugUrl;
	const local = state.imDebugRuntimeLocal;
	if (url === undefined || local === undefined) {
		return;
	}
	const { loc } = node;
	if (!loc) {
		return;
	}

	const newCall = t.callExpression(
		t.memberExpression(t.identifier(local), t.identifier('__imDotDebug')),
		[
			t.stringLiteral(url),
			t.numericLiteral(loc.start.line),
			t.numericLiteral(loc.start.column + 1),
			...node.arguments,
		],
	);

	callPath.replaceWith(newCall);
	state.imDebugMatched = true;
};

export default transformImportMetaDebug;
