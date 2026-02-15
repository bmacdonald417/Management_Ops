/** Copy regulatory HTML to dist as flat files: part_52.html, part_252.html */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');
const dest = join(root, 'dist', 'regulatory');

function copyIfExists(src: string, destFile: string): boolean {
  if (!existsSync(src)) return false;
  try {
    const data = readFileSync(src);
    writeFileSync(destFile, data);
    return true;
  } catch (err) {
    try {
      copyFileSync(src, destFile);
      return true;
    } catch {
      console.warn('[build] Could not copy', src, '->', destFile);
      return false;
    }
  }
}

mkdirSync(dest, { recursive: true });

// Support nested (part_52.html/part_52.html) or flat (part_52.html) source
const farNested = join(root, 'regulatory', 'part_52.html', 'part_52.html');
const farFlat = join(root, 'regulatory', 'part_52.html');
// DFARS: part252.html (no underscore) or part_252.html
const dfarsSources = [
  join(root, 'regulatory', 'part252.html'),
  join(root, 'regulatory', 'part_252.html', 'part_252.html'),
  join(root, 'regulatory', 'part_252.html'),
];

let ok = 0;
if (copyIfExists(farNested, join(dest, 'part_52.html')) || copyIfExists(farFlat, join(dest, 'part_52.html'))) ok++;
if (dfarsSources.some((src) => copyIfExists(src, join(dest, 'part_252.html')))) ok++;
console.log(`[build] Copied ${ok}/2 regulatory HTML files to dist/regulatory/`);
