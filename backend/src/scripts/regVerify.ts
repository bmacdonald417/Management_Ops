#!/usr/bin/env node
/**
 * Verify regulatory parser without writing to DB.
 * Run: npm run reg:verify (dev) or node dist/scripts/regVerify.js (prod)
 */
import { loadAndParseFAR52, loadAndParseDFARS252 } from '../services/regulatoryParser.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, statSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolvePath(filename: string): string | null {
  const candidates = [
    join(process.cwd(), 'regulatory', filename, filename),
    join(process.cwd(), 'regulatory', filename),
    join(process.cwd(), 'dist', 'regulatory', filename),
    join(process.cwd(), 'backend', 'regulatory', filename, filename),
    join(process.cwd(), 'backend', 'regulatory', filename),
    join(__dirname, '..', 'regulatory', filename, filename),
    join(__dirname, '..', 'regulatory', filename),
    join(__dirname, '..', '..', 'regulatory', filename, filename),
    join(__dirname, '..', '..', 'regulatory', filename),
  ];
  for (const p of candidates) {
    try {
      if (existsSync(p) && statSync(p).isFile()) return p;
    } catch {
      // skip
    }
  }
  return null;
}

/** DFARS may be part252.html or part_252.html (no underscore). */
function resolveDFARSPath(): string | null {
  return resolvePath('part252.html') ?? resolvePath('part_252.html');
}

const farPath = resolvePath('part_52.html');
const dfarsPath = resolveDFARSPath();

console.log('=== Regulatory Parser Verification ===');
console.log('FAR path:', farPath ?? 'NOT FOUND');
console.log('DFARS path:', dfarsPath ?? 'NOT FOUND');

if (farPath) {
  const far = loadAndParseFAR52(farPath);
  console.log('FAR count:', far.length);
  if (far.length > 0) {
    console.log('Sample FAR:', far.slice(0, 3).map((c) => `${c.clauseNumber} - ${c.title.slice(0, 50)}...`));
  }
} else {
  console.log('FAR: skip (file not found)');
}

if (dfarsPath) {
  const dfars = loadAndParseDFARS252(dfarsPath, (msg) => console.log(' ', msg));
  console.log('DFARS count:', dfars.length);
  if (dfars.length > 0) {
    console.log('First 5 DFARS:');
    dfars.slice(0, 5).forEach((c, i) => console.log(`  ${i + 1}. ${c.clauseNumber} - ${c.title.slice(0, 50)}${c.title.length > 50 ? '...' : ''}`));
  }
} else {
  console.log('DFARS: skip (file not found)');
}

console.log('=== Done ===');
