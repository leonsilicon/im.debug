import { parse, type ParserOptions, type ParserPlugin } from '@babel/parser';
import type {
	CallExpression,
	Node,
	OptionalCallExpression,
} from '@babel/types';
import MagicString from 'magic-string';

export type TransformOptions = {
	url: string;
	moduleType: 'esm' | 'cjs';
	runtimeSpecifier?: string;

	/** Pass `'ts'` / `'tsx'` for TypeScript sources, `'jsx'` for plain JSX. */
	syntax?: 'js' | 'jsx' | 'ts' | 'tsx';
};

const RUNTIME_LOCAL = '__imDotDebugRuntime';
const CALL_LOCAL = `${RUNTIME_LOCAL}.__imDotDebug`;
const NEEDLE = 'import.meta.debug';

const pluginsFor = (syntax: TransformOptions['syntax']): ParserPlugin[] => {
	switch (syntax) {
		case 'ts': {
			return ['typescript'];
		}
		case 'tsx': {
			return ['typescript', 'jsx'];
		}
		case 'jsx': {
			return ['jsx'];
		}
		default: {
			return [];
		}
	}
};

const isImportMetaDebug = (node: Node): boolean => (
	node.type === 'MemberExpression'
	&& !node.computed
	&& node.property.type === 'Identifier'
	&& node.property.name === 'debug'
	&& node.object.type === 'MetaProperty'
	&& node.object.meta.name === 'import'
	&& node.object.property.name === 'meta'
);

type Match = {
	node: CallExpression | OptionalCallExpression;
	line: number;
	column: number;
};

const SKIP_KEYS = new Set(['loc', 'range', 'leadingComments', 'trailingComments']);

const isAstNode = (value: unknown): value is Node => (
	value !== null
	&& typeof value === 'object'
	&& 'type' in (value as Record<string, unknown>)
);

const visitChildren = (node: Node, visit: (child: Node) => void): void => {
	for (const key of Object.keys(node)) {
		if (SKIP_KEYS.has(key)) {
			continue;
		}
		const value = (node as unknown as Record<string, unknown>)[key];
		if (Array.isArray(value)) {
			for (const child of value) {
				if (isAstNode(child)) {
					visit(child);
				}
			}
		} else if (isAstNode(value)) {
			visit(value);
		}
	}
};

const matchAt = (node: Node): Match | undefined => {
	if (node.type !== 'OptionalCallExpression' && node.type !== 'CallExpression') {
		return;
	}
	if (!isImportMetaDebug(node.callee) || !node.loc) {
		return;
	}
	return {
		node,
		line: node.loc.start.line,
		column: node.loc.start.column + 1,
	};
};

const collectMatches = (ast: Node): Match[] => {
	const matches: Match[] = [];
	const visit = (node: Node): void => {
		const match = matchAt(node);
		if (match) {
			matches.push(match);
		}
		visitChildren(node, visit);
	};
	visit(ast);
	return matches;
};

type WithRange = { start: number;
	end: number; };

const rewriteMatch = (
	out: MagicString,
	source: string,
	match: Match,
	urlLiteral: string,
): void => {
	const { node, line, column } = match;
	const { start, end } = node as unknown as WithRange;
	const args = node.arguments;
	const prefix = `${CALL_LOCAL}(${urlLiteral}, ${line}, ${column}`;
	if (args.length === 0) {
		out.overwrite(start, end, `${prefix})`);
		return;
	}
	const firstStart = (args[0] as unknown as WithRange).start;
	const lastEnd = (args.at(-1) as unknown as WithRange).end;
	const argsSource = source.slice(firstStart, lastEnd);
	out.overwrite(start, end, `${prefix}, ${argsSource})`);
};

export const transform = (
	source: string,
	{
		url,
		moduleType,
		runtimeSpecifier = 'im.debug/runtime',
		syntax = 'js',
	}: TransformOptions,
): string | undefined => {
	if (!source.includes(NEEDLE)) {
		return;
	}

	const parserOptions: ParserOptions = {
		sourceType: moduleType === 'cjs' ? 'unambiguous' : 'module',
		allowReturnOutsideFunction: true,
		allowAwaitOutsideFunction: true,
		allowImportExportEverywhere: true,
		allowSuperOutsideMethod: true,
		errorRecovery: true,
		plugins: pluginsFor(syntax),
	};

	let ast: Node;
	try {
		ast = parse(source, parserOptions);
	} catch {
		return;
	}

	const matches = collectMatches(ast);
	if (matches.length === 0) {
		return;
	}

	const out = new MagicString(source);
	const urlLiteral = JSON.stringify(url);

	for (const match of matches) {
		rewriteMatch(out, source, match, urlLiteral);
	}

	const banner = (
		moduleType === 'esm'
			? `import * as ${RUNTIME_LOCAL} from ${JSON.stringify(runtimeSpecifier)};`
			: `var ${RUNTIME_LOCAL}=require(${JSON.stringify(runtimeSpecifier)});`
	);

	const shebangMatch = source.match(/^#![^\n]*\n/);
	if (shebangMatch) {
		out.appendRight(shebangMatch[0].length, `${banner}\n`);
	} else {
		out.prepend(`${banner}\n`);
	}

	return out.toString();
};
