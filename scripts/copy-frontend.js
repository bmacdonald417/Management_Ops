#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../frontend/dist');
const dest = path.join(__dirname, '../backend/public');

if (!fs.existsSync(src)) {
  console.error('Frontend build not found at', src);
  process.exit(1);
}

fs.mkdirSync(dest, { recursive: true });
fs.readdirSync(src).forEach((file) => {
  const srcPath = path.join(src, file);
  const destPath = path.join(dest, file);
  fs.cpSync(srcPath, destPath, { recursive: true });
});
console.log('Copied frontend build to backend/public');
