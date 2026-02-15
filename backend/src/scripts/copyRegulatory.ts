/** Copy regulatory HTML to dist so it's available at runtime. */
import { cpSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');
const src = join(root, 'regulatory');
const dest = join(root, 'dist', 'regulatory');

if (existsSync(src)) {
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log('[build] Copied regulatory/ to dist/regulatory/');
} else {
  console.warn('[build] regulatory/ not found - ingestion may fail at runtime');
}
