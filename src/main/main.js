'use strict';

const fs = require('fs');
const path = require('path');
const {
  app, BrowserWindow, ipcMain, dialog, shell, clipboard, nativeTheme, Notification
} = require('electron');

const store = require('./settings');
const engine = require('./ytdlp');
const { DownloadManager } = require('./downloads');
const { POPULAR, siteFor, isUrl } = require('./sites');

const ROOT = path.join(__dirname, '..', '..');
const ICON = path.join(ROOT, 'build', 'icon.png');
const BG = { light: '#E7E9EF', dark: '#07080B' };

let win = null;
let quitting = false;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
}

app.setAppUserModelId('com.vela.downloader');

const send = (channel, payload) => {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
};

// ---------------------------------------------------------------------------
// Downloads

const manager = new DownloadManager({
  onUpdate(job, agg) {
    send('download:update', job);
    updateTaskbar(agg);
  },
  onRemove(id, agg) {
    send('download:removed', id);
    updateTaskbar(agg);
  },
  onFinished(job) {
    if (job.status === 'done') {
      const entry = {
        id: job.id, title: job.title, thumbnail: job.thumbnail, site: job.site, url: job.url,
        mode: job.mode, format: job.format, qualityLabel: job.qualityLabel, dir: job.dir,
        files: job.files, isPlaylist: job.isPlaylist, itemCount: job.itemTotal, size: job.bytes || job.estimate,
        finishedAt: job.finishedAt
      };
      store.addHistory(entry);
      send('history:added', entry);
    }
    notify(job);
  }
});

function updateTaskbar(agg) {
  if (!win || win.isDestroyed()) return;
  win.setProgressBar(agg.active ? Math.max(0.01, agg.progress) : -1);
  send('download:aggregate', agg);
}

function notify(job) {
  const s = store.getSettings();
  if (!s.notifyOnComplete || !Notification.isSupported()) return;
  if (win && win.isFocused()) return;
  const n = new Notification({
    title: job.status === 'done' ? 'Download concluído' : 'O download falhou',
    body: job.status === 'done' ? job.title : `${job.title}\n${job.error || ''}`,
    icon: ICON,
    silent: false
  });
  n.on('click', () => {
    if (!win) return;
    win.show();
    win.focus();
    if (job.status === 'done' && job.files && job.files[0]) shell.showItemInFolder(job.files[0]);
  });
  n.show();
}

// ---------------------------------------------------------------------------
// Clipboard detection

let lastClip = null;
let clipBusy = false;
const ignoredClips = new Set();
function watchClipboard() {
  setInterval(async () => {
    if (clipBusy || !win || win.isDestroyed()) return;
    if (!store.getSettings().clipboardWatch) return;
    clipBusy = true;
    let text = '';
    try {
      // readText() is synchronous in older Electron releases and a Promise in newer ones
      text = String((await clipboard.readText()) || '').trim();
    } catch {
      return;
    } finally {
      clipBusy = false;
    }
    if (text === lastClip) return;
    lastClip = text;
    if (!isUrl(text) || ignoredClips.has(text)) return;
    const site = siteFor(text);
    if (site) send('clipboard:url', { url: text, site: site.name });
  }, 1000);
}

// ---------------------------------------------------------------------------
// Window

function applyTheme(theme) {
  nativeTheme.themeSource = ['light', 'dark'].includes(theme) ? theme : 'system';
}

function createWindow() {
  const s = store.getSettings();
  applyTheme(s.theme);
  const b = s.windowBounds || {};
  win = new BrowserWindow({
    width: b.width || 1320,
    height: b.height || 860,
    x: b.x,
    y: b.y,
    minWidth: 980,
    minHeight: 660,
    frame: false,
    show: false,
    title: 'Vela',
    icon: ICON,
    backgroundColor: nativeTheme.shouldUseDarkColors ? BG.dark : BG.light,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });
  if (b.maximized) win.maximize();

  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());

  // The app never navigates away; links open in the default browser.
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  const sendState = () => send('window:state', { maximized: win.isMaximized(), focused: win.isFocused() });
  ['maximize', 'unmaximize', 'focus', 'blur'].forEach(ev => win.on(ev, sendState));

  win.on('close', e => {
    if (!quitting && manager.hasActive()) {
      const choice = dialog.showMessageBoxSync(win, {
        type: 'question',
        buttons: ['Continuar baixando', 'Sair mesmo assim'],
        defaultId: 0,
        cancelId: 0,
        title: 'Downloads em andamento',
        message: 'Há downloads em andamento.',
        detail: 'Se você sair agora, eles serão interrompidos. Ao colar o mesmo link depois, o download continua de onde parou.'
      });
      if (choice === 0) { e.preventDefault(); return; }
    }
    store.setSettings({ windowBounds: { ...win.getNormalBounds(), maximized: win.isMaximized() } });
  });
  win.on('closed', () => { win = null; });
}

// ---------------------------------------------------------------------------
// IPC

const ok = data => ({ ok: true, data });
const fail = err => ({ ok: false, error: (err && err.message) || String(err) });

function knownFolders() {
  const safe = name => { try { return app.getPath(name); } catch { return null; } };
  const list = [
    { name: 'Vídeos', path: safe('videos') },
    { name: 'Downloads', path: safe('downloads') },
    { name: 'Músicas', path: safe('music') },
    { name: 'Área de Trabalho', path: safe('desktop') }
  ];
  return list.filter(f => f.path);
}

function registerIpc() {
  ipcMain.handle('app:bootstrap', () => ({
    settings: store.getSettings(),
    history: store.getHistory(),
    jobs: manager.list(),
    folders: knownFolders(),
    popular: POPULAR,
    appVersion: app.getVersion(),
    platform: process.platform,
    engineInstalled: engine.isInstalled(),
    ffmpeg: !!engine.ffmpegPath()
  }));

  ipcMain.handle('engine:ensure', async () => {
    try {
      await engine.ensureEngine(p => send('engine:progress', p));
      return ok(await engine.version(store.getSettings()));
    } catch (err) { return fail(err); }
  });
  ipcMain.handle('engine:version', () => engine.version(store.getSettings()));
  ipcMain.handle('engine:update', async () => {
    try { return ok(await engine.update(store.getSettings())); } catch (err) { return fail(err); }
  });

  ipcMain.handle('media:analyze', async (_e, url) => {
    if (!isUrl(url)) return fail(new Error('Isso não parece um link. Copie o endereço completo, começando com https://'));
    try {
      await engine.ensureEngine(p => send('engine:progress', p));
      return ok(await engine.analyze(url.trim(), store.getSettings()));
    } catch (err) { return fail(err); }
  });

  ipcMain.handle('download:start', (_e, opts) => {
    if (!opts || !isUrl(opts.url)) return fail(new Error('Link inválido.'));
    const dir = opts.dir || store.getSettings().downloadDir;
    try { fs.mkdirSync(dir, { recursive: true }); } catch { return fail(new Error('Não foi possível usar a pasta escolhida. Escolha outra pasta.')); }
    return ok(manager.add({ ...opts, dir }));
  });
  ipcMain.handle('download:pause', (_e, id) => manager.pause(id));
  ipcMain.handle('download:resume', (_e, id) => manager.resume(id));
  ipcMain.handle('download:cancel', (_e, id) => manager.cancel(id));
  ipcMain.handle('download:remove', (_e, id) => manager.remove(id));
  ipcMain.handle('download:clearFinished', () => manager.clearFinished());

  ipcMain.handle('history:remove', (_e, id) => store.removeHistory(id));
  ipcMain.handle('history:clear', () => store.clearHistory());

  ipcMain.handle('settings:set', (_e, patch) => {
    const s = store.setSettings(patch);
    if (patch && 'theme' in patch) applyTheme(s.theme);
    if (patch && 'maxConcurrent' in patch) manager.pump();
    return s;
  });

  ipcMain.handle('dialog:chooseFolder', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'Escolha onde salvar os downloads',
      defaultPath: store.getSettings().downloadDir,
      buttonLabel: 'Usar esta pasta',
      properties: ['openDirectory', 'createDirectory']
    });
    return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
  });

  ipcMain.handle('shell:open', async (_e, p) => {
    if (typeof p !== 'string' || !fs.existsSync(p)) return fail(new Error('A pasta ou o arquivo não existe mais.'));
    const err = await shell.openPath(p);
    return err ? fail(new Error(err)) : ok(true);
  });
  ipcMain.handle('shell:reveal', (_e, p) => {
    if (typeof p !== 'string' || !fs.existsSync(p)) return fail(new Error('O arquivo foi movido ou apagado.'));
    shell.showItemInFolder(p);
    return ok(true);
  });
  ipcMain.handle('shell:external', (_e, url) => {
    if (typeof url === 'string' && /^https:\/\//i.test(url)) shell.openExternal(url);
  });

  ipcMain.handle('fs:free', async (_e, dir) => {
    try {
      // The folder may not exist yet; measure the closest existing parent
      let target = dir;
      while (target && !fs.existsSync(target) && path.dirname(target) !== target) target = path.dirname(target);
      const st = await fs.promises.statfs(target);
      return { free: st.bavail * st.bsize, total: st.blocks * st.bsize };
    } catch { return null; }
  });

  ipcMain.handle('sites:list', () => engine.listExtractors(store.getSettings()));

  ipcMain.handle('clipboard:ignore', (_e, url) => { if (typeof url === 'string') ignoredClips.add(url); });

  ipcMain.on('window:minimize', () => win && win.minimize());
  ipcMain.on('window:toggleMaximize', () => { if (win) win.isMaximized() ? win.unmaximize() : win.maximize(); });
  ipcMain.on('window:close', () => win && win.close());
}

// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  registerIpc();
  createWindow();
  watchClipboard();
  nativeTheme.on('updated', () => {
    if (win) win.setBackgroundColor(nativeTheme.shouldUseDarkColors ? BG.dark : BG.light);
  });
});

app.on('before-quit', () => {
  quitting = true;
  manager.stopAll();
  store.flushAll();
});

app.on('window-all-closed', () => app.quit());
