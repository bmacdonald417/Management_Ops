#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../backend/src/db/schema.sql');
const destDir = path.join(__dirname, '../backend/dist/db');
const dest = path.join(destDir, 'schema.sql');

if (!fs.existsSync(src)) {
  console.error('Schema not found at', src);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log('Copied schema.sql to backend/dist/db');

const migrationsSrc = path.join(__dirname, '../backend/src/db/migrations');
const migrationsDest = path.join(__dirname, '../backend/dist/db/migrations');
if (fs.existsSync(migrationsSrc)) {
  fs.mkdirSync(migrationsDest, { recursive: true });
  for (const f of fs.readdirSync(migrationsSrc).filter((x) => x.endsWith('.sql'))) {
    fs.copyFileSync(path.join(migrationsSrc, f), path.join(migrationsDest, f));
  }
  console.log('Copied migrations to backend/dist/db/migrations');
}
