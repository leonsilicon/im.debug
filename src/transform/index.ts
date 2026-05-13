/**
 * Rewrites `import.meta.debug?.(...)` calls into `__imdebug(url, line, col, ...args)`
 * and prepends an import/require for the runtime when at least one call is found.
 *
 * The scanner walks the source character by character so it can skip over
 * string literals, template literals, regex literals, and comments — those
 * never contain a real `import.meta.debug?.(...)` call.
 */
export type TransformOptions = {
	url: string;
	moduleType: 'esm' | 'cjs';
	runtimeSpecifier?: string;
};

const RUNTIME_LOCAL = '__imdebugRuntime';
const CALL_LOCAL = `${RUNTIME_LOCAL}.__imdebug`;
const NEEDLE = 'import.meta.debug';

const computeLineCol = (
	source: string,
	index: number,
) => {
	let line = 1;
	let col = 1;
	for (let i = 0; i < index; i += 1) {
		if (source.charCodeAt(i) === 10) {
			line += 1;
			col = 1;
		} else {
			col += 1;
		}
	}
	return { line, column: col };
};

const skipString = (
	source: string,
	start: number,
	quote: string,
) => {
	let i = start + 1;
	while (i < source.length) {
		const ch = source[i];
		if (ch === '\\') {
			i += 2;
			continue;
		}
		if (ch === quote) {
			return i + 1;
		}
		i += 1;
	}
	return i;
};

const skipTemplate = (
	source: string,
	start: number,
) => {
	let i = start + 1;
	while (i < source.length) {
		const ch = source[i];
		if (ch === '\\') {
			i += 2;
			continue;
		}
		if (ch === '`') {
			return i + 1;
		}
		if (ch === '$' && source[i + 1] === '{') {
			i = skipBalanced(source, i + 1, '{', '}');
			continue;
		}
		i += 1;
	}
	return i;
};

const skipBalanced = (
	source: string,
	start: number,
	open: string,
	close: string,
) => {
	let depth = 0;
	let i = start;
	while (i < source.length) {
		const ch = source[i];
		if (ch === '/' && source[i + 1] === '/') {
			i = source.indexOf('\n', i);
			if (i === -1) {
				return source.length;
			}
			continue;
		}
		if (ch === '/' && source[i + 1] === '*') {
			const end = source.indexOf('*/', i + 2);
			i = end === -1 ? source.length : end + 2;
			continue;
		}
		if (ch === '"' || ch === '\'') {
			i = skipString(source, i, ch);
			continue;
		}
		if (ch === '`') {
			i = skipTemplate(source, i);
			continue;
		}
		if (ch === open) {
			depth += 1;
		} else if (ch === close) {
			depth -= 1;
			if (depth === 0) {
				return i + 1;
			}
		}
		i += 1;
	}
	return i;
};

const isIdentifierChar = (code: number) => (
	(code >= 48 && code <= 57) // 0-9
	|| (code >= 65 && code <= 90) // A-Z
	|| (code >= 97 && code <= 122) // a-z
	|| code === 95 // _
	|| code === 36 // $
);

type Replacement = {
	start: number;
	end: number;
	text: string;
};

export const transform = (
	source: string,
	{
		url,
		moduleType,
		runtimeSpecifier = 'imdebug/runtime',
	}: TransformOptions,
): string | undefined => {
	if (!source.includes(NEEDLE)) {
		return;
	}

	const replacements: Replacement[] = [];
	let i = 0;

	while (i < source.length) {
		const ch = source[i];

		if (ch === '/' && source[i + 1] === '/') {
			const newline = source.indexOf('\n', i);
			i = newline === -1 ? source.length : newline;
			continue;
		}

		if (ch === '/' && source[i + 1] === '*') {
			const end = source.indexOf('*/', i + 2);
			i = end === -1 ? source.length : end + 2;
			continue;
		}

		if (ch === '"' || ch === '\'') {
			i = skipString(source, i, ch);
			continue;
		}

		if (ch === '`') {
			i = skipTemplate(source, i);
			continue;
		}

		// Look for "import.meta.debug" at this position, but only as a fresh identifier
		if (ch === 'i' && source.startsWith(NEEDLE, i)) {
			const before = i === 0 ? '' : source[i - 1];
			const beforeCode = before ? before.charCodeAt(0) : 0;
			if (before && (isIdentifierChar(beforeCode) || before === '.')) {
				i += 1;
				continue;
			}

			let cursor = i + NEEDLE.length;
			// Allow whitespace before "?."
			while (cursor < source.length && /\s/.test(source[cursor]!)) {
				cursor += 1;
			}
			if (source[cursor] !== '?' || source[cursor + 1] !== '.') {
				i += 1;
				continue;
			}
			cursor += 2;
			while (cursor < source.length && /\s/.test(source[cursor]!)) {
				cursor += 1;
			}
			if (source[cursor] !== '(') {
				i += 1;
				continue;
			}

			const callOpen = cursor;
			const callClose = skipBalanced(source, callOpen, '(', ')');
			const argsSource = source.slice(callOpen + 1, callClose - 1);

			const { line, column } = computeLineCol(source, i);
			const prefix = `${CALL_LOCAL}(${JSON.stringify(url)}, ${line}, ${column}`;
			const replacement = (
				argsSource.trim().length === 0
					? `${prefix})`
					: `${prefix}, ${argsSource})`
			);

			replacements.push({
				start: i,
				end: callClose,
				text: replacement,
			});

			i = callClose;
			continue;
		}

		i += 1;
	}

	if (replacements.length === 0) {
		return;
	}

	let output = '';
	let cursor = 0;
	for (const { start, end, text } of replacements) {
		output += source.slice(cursor, start) + text;
		cursor = end;
	}
	output += source.slice(cursor);

	const banner = (
		moduleType === 'esm'
			? `import * as ${RUNTIME_LOCAL} from ${JSON.stringify(runtimeSpecifier)};`
			: `var ${RUNTIME_LOCAL}=require(${JSON.stringify(runtimeSpecifier)});`
	);

	// Preserve leading shebang and "use strict" so the banner stays valid
	const shebangMatch = output.match(/^#![^\n]*\n/);
	if (shebangMatch) {
		const offset = shebangMatch[0].length;
		return output.slice(0, offset) + banner + '\n' + output.slice(offset);
	}
	return banner + '\n' + output;
};
