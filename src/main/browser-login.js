'use strict';

// Sign-in through a real installed browser (Chrome, Edge or Brave).
//
// Google refuses sign-in inside embedded browsers such as Electron windows,
// but accepts it in a regular Chrome/Edge. So Vela starts the user's browser
// with a separate profile that belongs to Vela, lets the user sign in there,
// and reads that profile's cookies through the browser's own DevTools
// protocol. The browser decrypts its cookies itself, which also sidesteps
// Chrome's app-bound cookie encryption on Windows.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

function candidates() {
  if (process.env.VELA_LOGIN_BROWSER) return [{ name: 'Navegador', path: process.env.VELA_LOGIN_BROWSER }];
  if (process.platform === 'win32') {
    const pf = process.env.ProgramFiles || 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return [
      { name: 'Google Chrome', path: path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe') },
      { name: 'Google Chrome', path: path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe') },
      { name: 'Google Chrome', path: path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe') },
      { name: 'Microsoft Edge', path: path.join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe') },
      { name: 'Microsoft Edge', path: path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe') },
      { name: 'Brave', path: path.join(pf, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe') },
      { name: 'Brave', path: path.join(local, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe') }
    ];
  }
  if (process.platform === 'darwin') {
    return [
      { name: 'Google Chrome', path: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
      { name: 'Microsoft Edge', path: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' },
      { name: 'Brave', path: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser' }
    ];
  }
  return ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'brave-browser']
    .flatMap(bin => ['/usr/bin/', '/usr/local/bin/', '/snap/bin/'].map(dir => ({ name: bin, path: dir + bin })));
}

function findBrowser() {
  return candidates().find(c => {
    try { return fs.statSync(c.path).isFile(); } catch { return false; }
  }) || null;
}

// ---------------------------------------------------------------------------
// Minimal DevTools protocol client over the browser's WebSocket endpoint

class Cdp {
  static connect(url, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const t = setTimeout(() => { try { ws.close(); } catch { /* ignore */ } reject(new Error('timeout')); }, timeout);
      ws.addEventListener('open', () => { clearTimeout(t); resolve(new Cdp(ws)); });
      ws.addEventListener('error', () => { clearTimeout(t); reject(new Error('connect failed')); });
    });
  }

  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.closed = false;
    this.onClose = null;
    ws.addEventListener('message', ev => {
      let msg;
      try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString()); } catch { return; }
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message)); else p.resolve(msg.result);
    });
    ws.addEventListener('close', () => {
      this.closed = true;
      for (const p of this.pending.values()) p.reject(new Error('closed'));
      this.pending.clear();
      if (this.onClose) this.onClose();
    });
  }

  send(method, params = {}) {
    if (this.closed) return Promise.reject(new Error('closed'));
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    try { this.ws.close(); } catch { /* ignore */ }
  }
}

// The browser writes its DevTools port and endpoint into the profile folder.
function readEndpoint(profileDir) {
  try {
    const [port, wsPath] = fs.readFileSync(path.join(profileDir, 'DevToolsActivePort'), 'utf8').split(/\r?\n/);
    if (!port || !wsPath) return null;
    return `ws://127.0.0.1:${port.trim()}${wsPath.trim()}`;
  } catch {
    return null;
  }
}

async function waitForEndpoint(profileDir, child, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const url = readEndpoint(profileDir);
    if (url) {
      try { return await Cdp.connect(url, 2000); } catch { /* not ready yet */ }
    }
    if (child && child.exitCode !== null && child.exitCode !== 0) break;
    await new Promise(r => setTimeout(r, 300));
  }
  return null;
}

// CDP cookie -> the shape auth.js writes to cookies.txt
const toCookie = c => ({
  name: c.name,
  value: c.value,
  domain: c.domain,
  hostOnly: !String(c.domain).startsWith('.'),
  path: c.path || '/',
  secure: !!c.secure,
  httpOnly: !!c.httpOnly,
  session: !!c.session || !(c.expires > 0),
  expirationDate: c.expires > 0 ? c.expires : undefined
});

// Opens `url` in the user's browser using Vela's own profile and calls
// `isDone(cookies)` every second until it returns true, the user closes the
// browser, or `cancel()` is called.
//   onSignedIn(cookies) -> save them; the browser window is then closed.
function run({ browser, profileDir, url, isDone, settleMs = 2500 }) {
  let canceledEarly = false;
  let cancelFn = () => { canceledEarly = true; };
  const promise = (async () => {
    fs.mkdirSync(profileDir, { recursive: true });

    // Reuse a login window that is still open from a previous attempt
    let cdp = null;
    const existing = readEndpoint(profileDir);
    if (existing) {
      try { cdp = await Cdp.connect(existing, 1500); } catch { cdp = null; }
    }
    let child = null;
    if (cdp) {
      await cdp.send('Target.createTarget', { url, newWindow: true }).catch(() => {});
    } else {
      try { fs.rmSync(path.join(profileDir, 'DevToolsActivePort'), { force: true }); } catch { /* ignore */ }
      child = spawn(browser.path, [
        `--user-data-dir=${profileDir}`,
        '--remote-debugging-port=0',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-sync',
        '--new-window',
        url
      ], { detached: true, stdio: 'ignore', windowsHide: false });
      child.on('error', () => {});
      child.unref();
      cdp = await waitForEndpoint(profileDir, child);
    }
    if (!cdp) return { ok: false, error: `Não foi possível abrir o ${browser.name} para o login.` };
    if (canceledEarly) {
      cdp.send('Browser.close').catch(() => {});
      return { ok: true, connected: false, canceled: true };
    }

    return await new Promise(resolve => {
      let settled = false;
      let timer = null;
      let signedSince = 0;
      const finish = result => {
        if (settled) return;
        settled = true;
        clearInterval(timer);
        cdp.onClose = null;
        resolve(result);
      };
      cdp.onClose = () => finish({ ok: true, connected: false, closed: true });
      cancelFn = () => {
        cdp.send('Browser.close').catch(() => {});
        finish({ ok: true, connected: false, canceled: true });
      };
      const tick = async () => {
        let cookies;
        try { cookies = (await cdp.send('Storage.getCookies')).cookies.map(toCookie); } catch { return; }
        if (!isDone(cookies)) { signedSince = 0; return; }
        // Sites set their session cookies over several redirects; let them settle
        if (!signedSince) { signedSince = Date.now(); return; }
        if (Date.now() - signedSince < settleMs) return;
        finish({ ok: true, connected: true, cookies });
        // Closing right away keeps the browser from rotating the cookies we saved
        cdp.send('Browser.close').catch(() => {}).finally(() => cdp.close());
      };
      timer = setInterval(tick, 1000);
    });
  })();
  return { promise, cancel: () => cancelFn() };
}

module.exports = { findBrowser, run };
