#!/usr/bin/env node
'use strict';

// Downloads the latest yt-dlp release into resources/bin so the installer
// ships with it. At runtime the app copies it to the user's data folder,
// where it can update itself. Usage: node scripts/fetch-binaries.js [--platform=win32]

const fs = require('fs');
const path = require('path');
const https = require('https');

const arg = process.argv.find(a => a.startsWith('--platform='));
const platform = arg ? arg.split('=')[1] : process.platform;
const ASSETS = { win32: 'yt-dlp.exe', darwin: 'yt-dlp_macos', linux: process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux' };
const asset = ASSETS[platform];
if (!asset) { console.error('Plataforma não suportada:', platform); process.exit(1); }

const outDir = path.join(__dirname, '..', 'resources', 'bin');
const out = path.join(outDir, asset);
const url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/' + asset;

function get(u, redirects = 0) {
  return new Promise((resolve, reject) => {
    https.get(u, { headers: { 'User-Agent': 'vela-build' } }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 5) {
        res.resume();
        resolve(get(new URL(res.headers.location, u).toString(), redirects + 1));
        return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error('HTTP ' + res.statusCode + ' em ' + u)); return; }
      resolve(res);
    }).on('error', reject);
  });
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  console.log('Baixando', url);
  const res = await get(url);
  const total = Number(res.headers['content-length']) || 0;
  let got = 0;
  const tmp = out + '.download';
  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tmp);
    res.on('data', c => {
      got += c.length;
      if (total) process.stdout.write(`\r${Math.round(got / total * 100)}%`);
    });
    res.pipe(file);
    file.on('finish', resolve);
    file.on('error', reject);
  });
  fs.renameSync(tmp, out);
  if (platform !== 'win32') fs.chmodSync(out, 0o755);
  console.log(`\nSalvo em ${path.relative(process.cwd(), out)} (${(got / 1048576).toFixed(1)} MB)`);

  if (platform !== process.platform) {
    console.warn(`\nAtenção: o FFmpeg vem do pacote ffmpeg-static, instalado para ${process.platform}.`);
    console.warn('Para gerar o instalador do Windows, rode "npm install" e "npm run dist" no próprio Windows.');
  }
})().catch(err => { console.error('\nFalha ao baixar o yt-dlp:', err.message); process.exit(1); });
