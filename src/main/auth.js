'use strict';

// Sign-in inside Vela. The site's own login page opens in a window with its
// own persistent browser session; once the user is signed in, that session's
// cookies for the site are written to a cookies.txt file that yt-dlp reads
// with --cookies. Nothing leaves the computer.

const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, session } = require('electron');

const PARTITION = 'persist:vela-login';

// `domains`: cookies exported for yt-dlp. `clear`: cookies wiped on sign-out
// (YouTube signs in through Google, so Google's cookies go too).
// `marker`: a cookie that only exists once the user is signed in.
const SITES = [
  {
    id: 'youtube', name: 'YouTube',
    login: 'https://accounts.google.com/ServiceLogin?service=youtube&hl=pt-BR&continue=https%3A%2F%2Fwww.youtube.com%2F',
    hosts: ['youtube.com', 'youtu.be', 'youtube-nocookie.com'],
    domains: ['youtube.com'], clear: ['youtube.com', 'google.com'],
    marker: { domain: 'youtube.com', names: ['SAPISID', '__Secure-3PAPISID', 'LOGIN_INFO'] }
  },
  {
    id: 'instagram', name: 'Instagram', login: 'https://www.instagram.com/accounts/login/',
    hosts: ['instagram.com'], domains: ['instagram.com'], clear: ['instagram.com'],
    marker: { domain: 'instagram.com', names: ['sessionid'] }
  },
  {
    id: 'x', name: 'X (Twitter)', login: 'https://x.com/i/flow/login',
    hosts: ['x.com', 'twitter.com'], domains: ['x.com', 'twitter.com'], clear: ['x.com', 'twitter.com'],
    marker: { domain: 'x.com', names: ['auth_token'] }
  },
  {
    id: 'facebook', name: 'Facebook', login: 'https://www.facebook.com/login/',
    hosts: ['facebook.com', 'fb.watch'], domains: ['facebook.com'], clear: ['facebook.com'],
    marker: { domain: 'facebook.com', names: ['c_user'] }
  },
  {
    id: 'tiktok', name: 'TikTok', login: 'https://www.tiktok.com/login',
    hosts: ['tiktok.com'], domains: ['tiktok.com'], clear: ['tiktok.com'],
    marker: { domain: 'tiktok.com', names: ['sessionid'] }
  }
];

const cookieFile = () => path.join(app.getPath('userData'), 'cookies.txt');
const siteById = id => SITES.find(s => s.id === id);
const onDomain = (domain, base) => {
  const d = String(domain || '').replace(/^#HttpOnly_/, '').replace(/^\./, '').toLowerCase();
  return d === base || d.endsWith('.' + base);
};

function siteIdForUrl(url) {
  let host = '';
  try { host = new URL(url).hostname.toLowerCase(); } catch { return null; }
  const site = SITES.find(s => s.hosts.some(h => host === h || host.endsWith('.' + h)));
  return site ? site.id : null;
}

// ---------------------------------------------------------------------------
// cookies.txt (Netscape format, the one yt-dlp and browser extensions use)

function readLines() {
  try {
    return fs.readFileSync(cookieFile(), 'utf8').split(/\r?\n/)
      .filter(l => l.trim() && (!l.startsWith('#') || l.startsWith('#HttpOnly_')));
  } catch {
    return [];
  }
}

function writeLines(lines) {
  if (!lines.length) {
    fs.rmSync(cookieFile(), { force: true });
    return;
  }
  const head = '# Netscape HTTP Cookie File\n# Gerado pelo Vela. Contém logins: não compartilhe este arquivo.\n\n';
  fs.mkdirSync(path.dirname(cookieFile()), { recursive: true });
  fs.writeFileSync(cookieFile(), head + lines.join('\n') + '\n', { mode: 0o600 });
}

function toLine(c) {
  let domain = c.domain || '';
  if (!c.hostOnly && !domain.startsWith('.')) domain = '.' + domain;
  const expiry = c.session || !c.expirationDate ? 0 : Math.floor(c.expirationDate);
  return [
    (c.httpOnly ? '#HttpOnly_' : '') + domain,
    domain.startsWith('.') ? 'TRUE' : 'FALSE',
    c.path || '/',
    c.secure ? 'TRUE' : 'FALSE',
    expiry,
    c.name,
    c.value
  ].join('\t');
}

const lineDomain = l => l.split('\t')[0];

function isSignedIn(site, lines = readLines()) {
  const now = Date.now() / 1000;
  return lines.some(l => {
    const f = l.split('\t');
    if (f.length < 7 || !onDomain(f[0], site.marker.domain) || !site.marker.names.includes(f[5])) return false;
    const exp = Number(f[4]);
    return !exp || exp > now;
  });
}

// ---------------------------------------------------------------------------
// Login window

let sessionReady = false;
function loginSession() {
  const ses = session.fromPartition(PARTITION);
  if (sessionReady) return ses;
  sessionReady = true;
  // Present as regular Chrome. Google refuses sign-in from browsers that
  // announce themselves as embedded (Electron) apps.
  const ua = ses.getUserAgent().replace(/\s(Electron|vela-downloader|Vela)\/\S+/gi, '');
  ses.setUserAgent(ua);
  const major = String(process.versions.chrome || '').split('.')[0];
  const brands = `"Chromium";v="${major}", "Google Chrome";v="${major}", "Not=A?Brand";v="24"`;
  ses.webRequest.onBeforeSendHeaders((details, cb) => {
    const h = details.requestHeaders;
    for (const k of Object.keys(h)) {
      const key = k.toLowerCase();
      if (key === 'sec-ch-ua') h[k] = brands;
      if (key === 'sec-ch-ua-full-version-list') delete h[k];
    }
    cb({ requestHeaders: h });
  });
  // Login pages don't need the camera, microphone, location or notifications
  ses.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  return ses;
}

let activeLogin = null;

// Opens the sign-in window and resolves when the user is signed in or closes it.
function login(siteId, { parent, icon } = {}) {
  const site = siteById(siteId);
  if (!site) return Promise.resolve({ ok: false, error: 'Esse site não tem login pelo Vela.' });
  if (activeLogin) {
    activeLogin.win.focus();
    return activeLogin.promise;
  }

  const ses = loginSession();
  const win = new BrowserWindow({
    width: 520,
    height: 740,
    minWidth: 400,
    minHeight: 560,
    parent,
    title: `Entrar no ${site.name} · Vela`,
    icon,
    autoHideMenuBar: true,
    backgroundColor: '#FFFFFF',
    webPreferences: { partition: PARTITION, sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: true }
  });
  // Keep our title instead of the page's
  win.on('page-title-updated', e => e.preventDefault());

  let settled = false;
  let timer = null;
  const promise = new Promise(resolve => {
    const finish = result => {
      if (settled) return;
      settled = true;
      clearInterval(timer);
      activeLogin = null;
      if (!win.isDestroyed()) win.close();
      resolve(result);
    };

    // Sites set their session cookies over several redirects, so wait until
    // the signed-in page has finished loading and settled before saving.
    let signedSince = 0;
    const check = async () => {
      try {
        const cookies = await ses.cookies.get({});
        const signed = cookies.some(c => onDomain(c.domain, site.marker.domain) && site.marker.names.includes(c.name));
        if (!signed) { signedSince = 0; return; }
        if (!signedSince) signedSince = Date.now();
        if (win.isDestroyed() || win.webContents.isLoading() || Date.now() - signedSince < 1500) return;
        exportSite(site, await ses.cookies.get({}));
        finish({ ok: true, connected: true });
      } catch (err) {
        finish({ ok: false, error: 'Não foi possível salvar o login: ' + err.message });
      }
    };

    win.webContents.on('did-navigate', (_e, url) => {
      if (/accounts\.google\.com\/.*(signin\/rejected|deniedsigninrejected)/i.test(url)) {
        finish({
          ok: false,
          error: 'O Google não permitiu o login dentro do Vela. Use "Importar cookies.txt" ou o login de um navegador instalado, em Configurações.'
        });
      }
    });
    win.on('closed', () => finish({ ok: true, connected: isSignedIn(site) }));
    timer = setInterval(check, 1000);
  });

  activeLogin = { win, promise };
  win.loadURL(site.login);
  return promise;
}

// Replace this site's lines in cookies.txt with the session's current cookies,
// keeping other sites' cookies (which yt-dlp may have refreshed) untouched.
function exportSite(site, cookies) {
  const fresh = cookies.filter(c => site.domains.some(d => onDomain(c.domain, d))).map(toLine);
  const kept = readLines().filter(l => !site.domains.some(d => onDomain(lineDomain(l), d)));
  writeLines([...kept, ...fresh]);
}

async function logout(siteId) {
  const site = siteById(siteId);
  if (!site) return;
  writeLines(readLines().filter(l => !site.domains.some(d => onDomain(lineDomain(l), d))));
  const ses = loginSession();
  const cookies = await ses.cookies.get({});
  await Promise.all(cookies
    .filter(c => site.clear.some(d => onDomain(c.domain, d)))
    .map(c => ses.cookies.remove(`${c.secure ? 'https' : 'http'}://${c.domain.replace(/^\./, '')}${c.path || '/'}`, c.name).catch(() => {})));
}

// Forget every login: the cookies file and the sign-in window's session.
async function clearAll() {
  writeLines([]);
  await loginSession().clearStorageData();
}

// Adds a cookies.txt exported from a browser extension. Its cookies replace
// existing ones for the same sites; logins for other sites are kept.
function importFile(src) {
  let text;
  try { text = fs.readFileSync(src, 'utf8'); } catch { throw new Error('Não foi possível ler o arquivo escolhido.'); }
  const lines = text.split(/\r?\n/).filter(l => l.trim() && (!l.startsWith('#') || l.startsWith('#HttpOnly_')));
  const valid = lines.filter(l => l.split('\t').length >= 7);
  if (!valid.length) throw new Error('Esse arquivo não está no formato cookies.txt (Netscape). Exporte de novo com a extensão do navegador.');
  const base = d => d.replace(/^#HttpOnly_/, '').replace(/^\./, '').toLowerCase();
  const incoming = new Set(valid.map(l => base(lineDomain(l))));
  const kept = readLines().filter(l => {
    const d = base(lineDomain(l));
    return ![...incoming].some(i => d === i || d.endsWith('.' + i) || i.endsWith('.' + d));
  });
  writeLines([...kept, ...valid]);
  return SITES.filter(s => isSignedIn(s, valid)).map(s => s.name);
}

function status() {
  const lines = readLines();
  let mtime = null;
  try { mtime = fs.statSync(cookieFile()).mtimeMs; } catch { /* no file */ }
  const extra = lines.length && !SITES.some(s => isSignedIn(s, lines));
  return {
    sites: SITES.map(s => ({ id: s.id, name: s.name, connected: isSignedIn(s, lines) })),
    hasFile: lines.length > 0,
    otherCookies: extra,
    updatedAt: mtime
  };
}

// Arguments that give yt-dlp access to the user's logins.
function cookieArgs(settings) {
  if (!settings) return [];
  if (settings.authSource === 'browser') {
    return settings.cookiesBrowser ? ['--cookies-from-browser', settings.cookiesBrowser] : [];
  }
  return fs.existsSync(cookieFile()) ? ['--cookies', cookieFile()] : [];
}

module.exports = { SITES, login, logout, clearAll, importFile, status, cookieArgs, siteIdForUrl, isSignedIn: id => isSignedIn(siteById(id)) };
