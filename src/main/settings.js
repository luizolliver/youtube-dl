'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULTS = {
  downloadDir: null, // resolved to the Windows "Videos" folder on first read
  recentDirs: [],
  theme: 'system', // system | light | dark
  clipboardWatch: true,
  maxConcurrent: 2,
  authSource: 'vela', // vela: accounts signed in inside Vela | browser: an installed browser's cookies
  cookiesBrowser: '', // '' | chrome | edge | firefox | brave | opera | vivaldi | chromium
  notifyOnComplete: true,
  subtitles: true,
  saveThumbnail: false,
  splitChapters: false,
  keepFullVideo: true,
  lastKind: 'video',
  lastVideoFormat: 'MP4',
  lastAudioFormat: 'MP3',
  lastHeight: 1080,
  lastAudioKbps: 256,
  windowBounds: null
};

const HISTORY_LIMIT = 500;

class JsonStore {
  constructor(file, fallback) {
    this.file = file;
    this.fallback = fallback;
    this.data = null;
    this.timer = null;
  }

  load() {
    if (this.data) return this.data;
    try {
      this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch {
      this.data = structuredClone(this.fallback);
    }
    return this.data;
  }

  save() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 150);
  }

  flush() {
    clearTimeout(this.timer);
    if (!this.data) return;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.error('Não foi possível salvar', this.file, err);
    }
  }
}

const userData = () => app.getPath('userData');
const settingsStore = new JsonStore(path.join(userData(), 'settings.json'), {});
const historyStore = new JsonStore(path.join(userData(), 'history.json'), []);

function getSettings() {
  const raw = settingsStore.load();
  const s = Object.assign({}, DEFAULTS, raw);
  // Earlier versions only had the installed-browser option
  if (!raw.authSource && raw.cookiesBrowser) s.authSource = 'browser';
  if (!s.downloadDir || !fs.existsSync(s.downloadDir)) s.downloadDir = app.getPath('videos');
  return s;
}

function setSettings(patch) {
  const current = settingsStore.load();
  for (const [k, v] of Object.entries(patch || {})) {
    if (k in DEFAULTS) current[k] = v;
  }
  if (patch && patch.downloadDir) {
    const recent = (current.recentDirs || []).filter(d => d !== patch.downloadDir);
    recent.unshift(patch.downloadDir);
    current.recentDirs = recent.slice(0, 4);
  }
  settingsStore.save();
  return getSettings();
}

function getHistory() {
  return historyStore.load();
}

function addHistory(entry) {
  const list = historyStore.load();
  list.unshift(entry);
  if (list.length > HISTORY_LIMIT) list.length = HISTORY_LIMIT;
  historyStore.save();
}

function removeHistory(id) {
  const list = historyStore.load();
  const i = list.findIndex(e => e.id === id);
  if (i >= 0) list.splice(i, 1);
  historyStore.save();
}

function clearHistory() {
  historyStore.data = [];
  historyStore.save();
}

function flushAll() {
  settingsStore.flush();
  historyStore.flush();
}

module.exports = { getSettings, setSettings, getHistory, addHistory, removeHistory, clearHistory, flushAll };
