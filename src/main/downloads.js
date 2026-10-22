'use strict';

// Download queue: runs up to N jobs at once, supports pause/resume/cancel
// and reports every change to the window.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const auth = require('./auth');
const { DownloadRun } = require('./ytdlp');
const store = require('./settings');

const PUBLIC_FIELDS = [
  'id', 'url', 'title', 'thumbnail', 'site', 'channel', 'isPlaylist', 'itemCount', 'items', 'mode', 'format', 'height', 'kbps',
  'dir', 'estimate', 'status', 'progress', 'speed', 'eta', 'stage', 'stream', 'bytes', 'itemIndex', 'itemTotal',
  'files', 'error', 'notice', 'createdAt', 'finishedAt', 'qualityLabel',
  'splitChapters', 'keepFullVideo', 'chapterCount', 'needsLogin', 'loginSite'
];

// When a site doesn't offer the chosen container (e.g. WebM for an H.264-only
// video), yt-dlp keeps the original one. Tell the user instead of hiding it.
function formatNotice(job, files) {
  if (job.mode !== 'video' || !files || !files.length) return null;
  const exts = [...new Set(files.map(f => path.extname(f).slice(1).toLowerCase()).filter(Boolean))];
  if (!exts.length || exts.includes(job.format.toLowerCase())) return null;
  return `Este site não oferece ${job.format} para esse vídeo. O arquivo foi salvo como ${exts[0].toUpperCase()}.`;
}

// After --split-chapters: list the chapter files, and delete the full-length
// file when the user only wanted the chapters.
function applyChapters(job, result) {
  const chapters = result.chapterFiles || [];
  job.chapterCount = chapters.length;
  if (!chapters.length) {
    job.notice = job.notice || 'Este vídeo não tem capítulos. Ele foi salvo como um arquivo só.';
    return;
  }
  if (!job.keepFullVideo) {
    for (const f of job.files) {
      try { fs.rmSync(f, { force: true }); } catch { /* keep going */ }
    }
    job.files = chapters;
  } else {
    job.files = [...chapters, ...job.files];
  }
  job.notice = job.notice || `${chapters.length} capítulos salvos na pasta "${path.basename(path.dirname(chapters[0]))}".`;
}

class DownloadManager {
  constructor({ onUpdate, onRemove, onFinished }) {
    this.jobs = new Map();
    this.runs = new Map();
    this.onUpdateCb = onUpdate;
    this.onRemove = onRemove;
    this.onFinished = onFinished;
    this.lastEmit = new Map();
  }

  snapshot(job) {
    const o = {};
    for (const k of PUBLIC_FIELDS) o[k] = job[k];
    return o;
  }

  list() {
    return [...this.jobs.values()].map(j => this.snapshot(j));
  }

  emit(job, force) {
    const now = Date.now();
    if (!force && now - (this.lastEmit.get(job.id) || 0) < 200) return;
    this.lastEmit.set(job.id, now);
    this.onUpdateCb(this.snapshot(job), this.aggregate());
  }

  aggregate() {
    const active = [...this.jobs.values()].filter(j => ['running', 'queued'].includes(j.status));
    if (!active.length) return { active: 0, progress: -1, speed: 0 };
    const progress = active.reduce((a, j) => a + (j.progress || 0), 0) / active.length;
    const speed = active.filter(j => j.status === 'running').reduce((a, j) => a + (j.speed || 0), 0);
    return { active: active.length, progress, speed };
  }

  add(opts) {
    const job = {
      id: crypto.randomUUID(),
      url: opts.url,
      title: opts.title,
      thumbnail: opts.thumbnail || null,
      site: opts.site || null,
      channel: opts.channel || null,
      isPlaylist: !!opts.isPlaylist,
      itemCount: opts.itemCount || 1,
      items: opts.items || null,
      mode: opts.mode === 'audio' ? 'audio' : 'video',
      format: opts.format,
      height: Number(opts.height) || 0,
      kbps: Number(opts.kbps) || 192,
      qualityLabel: opts.qualityLabel || '',
      subtitles: !!opts.subtitles,
      saveThumbnail: !!opts.saveThumbnail,
      splitChapters: !!opts.splitChapters && !opts.isPlaylist,
      keepFullVideo: opts.keepFullVideo !== false,
      chapterCount: 0,
      needsLogin: false,
      loginSite: auth.siteIdForUrl(opts.url),
      dir: opts.dir,
      estimate: opts.estimate || null,
      status: 'queued',
      progress: 0,
      speed: 0,
      eta: null,
      stage: 'queued',
      bytes: 0,
      itemIndex: 1,
      itemTotal: opts.items ? opts.items.length : (opts.itemCount || 1),
      files: [],
      error: null,
      notice: null,
      createdAt: Date.now(),
      finishedAt: null
    };
    this.jobs.set(job.id, job);
    this.emit(job, true);
    this.pump();
    return this.snapshot(job);
  }

  pump() {
    const max = Math.max(1, Math.min(4, Number(store.getSettings().maxConcurrent) || 2));
    let running = [...this.jobs.values()].filter(j => j.status === 'running').length;
    for (const job of this.jobs.values()) {
      if (running >= max) break;
      if (job.status !== 'queued') continue;
      running += 1;
      this.start(job);
    }
  }

  async start(job) {
    job.status = 'running';
    job.stage = 'download';
    job.error = null;
    this.emit(job, true);
    const run = new DownloadRun(job, store.getSettings(), j => this.emit(j));
    this.runs.set(job.id, run);
    const result = await run.start();
    this.runs.delete(job.id);

    if (result.canceled) {
      this.jobs.delete(job.id);
      this.onRemove(job.id, this.aggregate());
    } else if (result.paused) {
      job.status = 'paused';
      job.speed = 0;
      this.emit(job, true);
    } else if (result.ok) {
      job.status = 'done';
      job.stage = 'done';
      job.progress = 1;
      job.speed = 0;
      job.eta = 0;
      job.files = result.files;
      job.notice = result.partial || formatNotice(job, result.files);
      if (job.splitChapters) applyChapters(job, result);
      job.finishedAt = Date.now();
      this.emit(job, true);
      this.onFinished(this.snapshot(job));
    } else {
      job.status = 'error';
      job.speed = 0;
      job.error = result.error;
      job.needsLogin = !!result.needsLogin;
      this.emit(job, true);
      this.onFinished(this.snapshot(job));
    }
    this.pump();
  }

  pause(id) {
    const job = this.jobs.get(id);
    if (!job) return;
    if (job.status === 'running') this.runs.get(id)?.stop('pause');
    else if (job.status === 'queued') { job.status = 'paused'; this.emit(job, true); }
  }

  resume(id) {
    const job = this.jobs.get(id);
    if (!job || !['paused', 'error'].includes(job.status)) return;
    job.status = 'queued';
    job.error = null;
    job.needsLogin = false;
    this.emit(job, true);
    this.pump();
  }

  cancel(id) {
    const job = this.jobs.get(id);
    if (!job) return;
    if (job.status === 'running') { this.runs.get(id)?.stop('cancel'); return; }
    this.jobs.delete(id);
    this.onRemove(id, this.aggregate());
    this.pump();
  }

  remove(id) {
    const job = this.jobs.get(id);
    if (!job || job.status === 'running') return;
    this.jobs.delete(id);
    this.onRemove(id, this.aggregate());
  }

  clearFinished() {
    for (const [id, job] of this.jobs) {
      if (job.status === 'done') { this.jobs.delete(id); this.onRemove(id, this.aggregate()); }
    }
  }

  hasActive() {
    return [...this.jobs.values()].some(j => j.status === 'running');
  }

  stopAll() {
    for (const run of this.runs.values()) run.stop('pause');
  }
}

module.exports = { DownloadManager };
