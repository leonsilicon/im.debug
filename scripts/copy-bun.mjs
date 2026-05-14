import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

await fs.copyFile(
	path.join(root, 'dist/bun/index.mjs'),
	path.join(root, 'bun.js'),
);
