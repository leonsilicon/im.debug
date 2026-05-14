<!-- Published as im.debug — npm rejected the name imdebug as too similar to debug. -->

# im.debug

`import.meta.debug?.(...)` — zero-config debug logging with the file path, line, and column of the call site baked in.

`im.debug` registers a Node.js module loader hook that rewrites every

```js
import.meta.debug?.('user resolved', user)
```

into a call to [`debug`](https://github.com/debug-js/debug), with the namespace derived from the source file's URL. The location is added to the log line so a single `DEBUG=*` shows exactly which file, line, and column emitted each message.

## Install

```sh
npm install im.debug debug
```

`debug` is a peer dependency, so install it alongside `im.debug`.

## Usage

Enable the hooks before any of your application code runs.

Node.js (ESM — preferred, `import.meta.debug` is ESM-only syntax):

```sh
node --import im.debug/node ./app.mjs
```

or from inside an entry file:

```js
import 'im.debug/node'
import './app.mjs'
```

Node.js (CommonJS / mixed-mode):

```sh
node --require im.debug/cjs ./app.js
```

Bun:

```sh
bun --preload im.debug/bun ./app.ts
```

Then sprinkle `import.meta.debug?.(...)` anywhere in your ESM source:

```js
// src/auth.mjs
export const authenticate = (user) => {
    import.meta.debug?.('authenticating %o', user)
    // ...
}
```

Run with the standard `debug` env-var conventions:

```sh
DEBUG='*' node --import im.debug/node ./app.mjs
# 2026-01-01T00:00:00.000Z src/auth.mjs [src/auth.mjs:3:2] authenticating { id: 1 }

DEBUG='src/auth*' node --import im.debug/node ./app.mjs
```

## TypeScript

`im.debug` ships ambient typings that augment `ImportMeta` with an optional
`debug` callable. Reference it once anywhere in your project (e.g. in a
`globals.d.ts` or your entry file):

```ts
/// <reference types="im.debug/types" />
```

Now `import.meta.debug?.('hello', { user })` is type-checked everywhere.

## How it works

When a JavaScript module is loaded, `im.debug`'s loader hook scans the source for `import.meta.debug?.(...)` and rewrites each call to:

```js
__imDotDebugRuntime.__imDotDebug(url, line, col, ...originalArgs)
```

A single import of the runtime is prepended to the file so the rewrite is self-contained. The runtime lazily creates one `debug` instance per source URL (namespace = path relative to `cwd`, or the absolute path if outside `cwd`).

Because the optional-chain (`?.`) is preserved in the original syntax, files that load without `im.debug` registered keep working — every `import.meta.debug?.(...)` is simply `undefined?.()`, which evaluates to `undefined` and is a no-op.

## Why a build-time transform?

Reading the call-site line/column at runtime requires throwing an `Error` and parsing its stack on every call — even when debug is disabled. By baking the location in at load time, disabled calls cost nothing beyond a check on `debug.enabled`.

## License

MIT.
