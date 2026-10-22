#!/usr/bin/env node
'use strict';

// Prints the CHANGELOG.md section for a version, used as the GitHub Release
// text. Usage: node scripts/release-notes.js v1.0.0

const fs = require('fs');
const path = require('path');

const version = String(process.argv[2] || '').replace(/^v/, '');
const changelog = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8');
const lines = changelog.split(/\r?\n/);
const start = lines.findIndex(l => l.startsWith('## ') && l.includes(version));
if (start < 0) {
  console.error(`A versão ${version} não está no CHANGELOG.md`);
  process.exit(1);
}
let end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
if (end < 0) end = lines.length;
process.stdout.write(lines.slice(start + 1, end).join('\n').trim() + '\n');
