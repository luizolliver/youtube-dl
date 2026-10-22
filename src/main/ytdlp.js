'use strict';

// Everything that talks to the yt-dlp binary lives here: installing and
// updating it, reading video metadata, and running downloads with progress.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { app, net } = require('electron');
const auth = require('./auth');

const RELEASE_BASE = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/';
const PROGRESS_PREFIX = '@@P|';
const PROGRESS_TEMPLATE = 'download:' + PROGRESS_PREFIX + [
  '%(progress.status)s', '%(progress.downloaded_bytes)s', '%(progress.total_bytes)s',
  '%(progress.total_bytes_estimate)s', '%(progress.speed)s', '%(progress.eta)s'
].join('|');

const QUALITY_LADDER = [
  { height: 4320, label: '8K' },
  { height: 2160, label: '4K Ultra HD' },
  { height: 1440, label: 'Quad HD' },
  { height: 1080, label: 'Full HD' },
  { height: 720, label: 'HD' },
  { height: 480, label: 'Padrão' },
  { height: 360, label: 'Economia' },
  { height: 240, label: 'Baixa' },
  { height: 144, label: 'Mínima' }
];

// ---------------------------------------------------------------------------
// Binary locations

function assetName() {
  if (process.platform === 'win32') return 'yt-dlp.exe';
  if (process.platform === 'darwin') return 'yt-dlp_macos';
  return process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux';
}

const binDir = () => path.join(app.getPath('userData'), 'bin');

function binPath() {
  if (process.env.VELA_YTDLP) return process.env.VELA_YTDLP;
  return path.join(binDir(), assetName());
}

function bundledPath() {
  const base = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..', '..', 'resources');
  return path.join(base, 'bin', assetName());
}

function ffmpegPath() {
  try {
    const p = require('ffmpeg-static');
    if (!p) return null;
    const unpacked = p.replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep);
    return fs.existsSync(unpacked) ? unpacked : null;
  } catch {
    return null;
  }
}

function isInstalled() {
  return fs.existsSync(binPath());
}

// Downloads (or copies the bundled) yt-dlp binary into the user's app data,
// where it can later update itself with `-U`.
async function ensureEngine(onProgress = () => {}) {
  const target = binPath();
  if (fs.existsSync(target)) return target;
  fs.mkdirSync(path.dirname(target), { recursive: true });

  const bundled = bundledPath();
  if (fs.existsSync(bundled)) {
    fs.copyFileSync(bundled, target);
    if (process.platform !== 'win32') fs.chmodSync(target, 0o755);
    return target;
  }

  const res = await net.fetch(RELEASE_BASE + assetName());
  if (!res.ok) throw new Error(`Não foi possível baixar o motor de download (HTTP ${res.status}). Verifique sua conexão.`);
  const total = Number(res.headers.get('content-length')) || 0;
  const tmp = target + '.download';
  const out = fs.createWriteStream(tmp);
  const reader = res.body.getReader();
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (!out.write(Buffer.from(value))) await new Promise(r => out.once('drain', r));
      onProgress({ received, total });
    }
  } finally {
    await new Promise(r => out.end(r));
  }
  if (total && received < total) {
    fs.rmSync(tmp, { force: true });
    throw new Error('O download do motor foi interrompido. Tente de novo.');
  }
  fs.renameSync(tmp, target);
  if (process.platform !== 'win32') fs.chmodSync(target, 0o755);
  return target;
}

// ---------------------------------------------------------------------------
// Process helpers

function baseArgs(settings) {
  const args = ['--ignore-config', '--no-colors', '--encoding', 'utf-8'];
  const ff = ffmpegPath();
  if (ff) args.push('--ffmpeg-location', ff);
  // YouTube needs a JavaScript runtime. Electron can run as Node, so we
  // point yt-dlp at our own executable instead of asking users to install one.
  args.push('--no-js-runtimes', '--js-runtimes', 'node:' + process.execPath);
  args.push(...auth.cookieArgs(settings));
  return args;
}

function spawnEngine(args, settings) {
  return spawn(binPath(), [...baseArgs(settings), ...args], {
    windowsHide: true,
    detached: process.platform !== 'win32',
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
  });
}

function killTree(child) {
  if (!child || child.exitCode !== null || child.killed) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
    } else {
      process.kill(-child.pid, 'SIGTERM');
    }
  } catch {
    try { child.kill('SIGKILL'); } catch { /* already gone */ }
  }
}

function lineReader(stream, onLine) {
  let buf = '';
  stream.setEncoding('utf8');
  stream.on('data', chunk => {
    buf += chunk;
    const parts = buf.split(/\r?\n|\r/);
    buf = parts.pop();
    for (const l of parts) if (l) onLine(l);
  });
  stream.on('end', () => { if (buf) onLine(buf); });
}

function run(args, settings, { timeout = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try { child = spawnEngine(args, settings); } catch (err) { reject(err); return; }
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => { killTree(child); reject(new Error('O site demorou demais para responder. Tente de novo.')); }, timeout);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('error', err => { clearTimeout(timer); reject(err); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else {
        const err = new Error(friendlyError(stderr || stdout));
        err.raw = stderr;
        err.needsLogin = needsLogin(stderr || stdout);
        reject(err);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Errors in the user's language

// The third field marks errors that signing in to the site can fix.
const ERROR_RULES = [
  [/confirm you.?re not a bot|confirm you are not a bot/i, 'O YouTube pediu uma confirmação de que você não é um robô. Entre com sua conta do YouTube e tente de novo.', true],
  [/could not (find|copy) .*cookie|failed to decrypt|cookies database|could not open.*cookie/i, 'Não conseguimos ler o login do navegador escolhido. Feche o navegador e tente de novo, ou entre com sua conta pelo Vela em Configurações.'],
  [/Unsupported URL/i, 'Esse site ainda não é suportado. Veja a lista completa em Sites suportados.'],
  [/Private video|video is private/i, 'Este vídeo é privado. Entre com uma conta que tenha acesso a ele e tente de novo.', true],
  [/confirm your age|age.restricted|inappropriate for some users/i, 'Este vídeo tem restrição de idade. Entre com sua conta e tente de novo.', true],
  [/members.only|join this channel/i, 'Este vídeo é exclusivo para membros do canal. Entre com a conta que é membro e tente de novo.', true],
  [/login required|requires? (a )?(login|authentication|account)|you need to log ?in|use --cookies|cookies for the authentication|logged.in users|sign in to (view|watch)/i, 'Este conteúdo só pode ser baixado com login. Entre com sua conta e tente de novo.', true],
  [/is live|live event will begin|Premieres in|This live event/i, 'Esta transmissão ainda está ao vivo ou não começou. Tente de novo depois que ela terminar.'],
  [/Requested format is not available/i, 'A qualidade escolhida não está disponível para este vídeo. Escolha outra resolução.'],
  [/Video unavailable|video is unavailable|has been removed|does not exist|HTTP Error 404/i, 'Este vídeo não está disponível. Ele pode ter sido removido ou estar bloqueado na sua região.'],
  [/HTTP Error 429|Too Many Requests/i, 'O site limitou o acesso por excesso de requisições. Aguarde alguns minutos e tente de novo.'],
  [/HTTP Error 403|Forbidden/i, 'O site recusou o download. Atualize o motor de download em Configurações e tente de novo.'],
  [/No space left|Errno 28/i, 'Não há espaço suficiente no disco de destino. Libere espaço ou escolha outra pasta.'],
  [/Permission denied|Errno 13|Access is denied/i, 'Sem permissão para salvar na pasta escolhida. Escolha outra pasta.'],
  [/ffmpeg.*not (installed|found)/i, 'O componente de conversão (ffmpeg) não foi encontrado. Reinstale o Vela.'],
  [/getaddrinfo|Failed to resolve|Name or service not known|timed out|Connection (reset|refused|aborted)|Unable to download (webpage|API)|urlopen error|Network is unreachable/i, 'Sem conexão com o site. Verifique sua internet e tente de novo.']
];

function needsLogin(text) {
  const t = String(text || '');
  const rule = ERROR_RULES.find(([re]) => re.test(t));
  return !!(rule && rule[2]);
}

function friendlyError(text) {
  const t = String(text || '');
  for (const [re, msg] of ERROR_RULES) if (re.test(t)) return msg;
  const last = t.split(/\r?\n/).filter(l => /^ERROR:/.test(l)).pop();
  if (last) return 'Não foi possível concluir: ' + last.replace(/^ERROR:\s*(\[[^\]]+\]\s*)?([\w-]+:\s*)?/, '').trim();
  return 'Não foi possível concluir. Confira o link e tente de novo.';
}

// ---------------------------------------------------------------------------
// Metadata

function pickThumb(info) {
  if (!info) return null;
  const list = (info.thumbnails || []).filter(t => t && t.url);
  // Prefer a medium size (~320-480px wide) for fast loading in the UI
  const sized = list.filter(t => t.width);
  if (sized.length) {
    const good = sized.filter(t => t.width >= 300 && t.width <= 720).sort((a, b) => a.width - b.width);
    if (good.length) return good[good.length - 1].url;
  }
  if (info.thumbnail) return info.thumbnail;
  return list.length ? list[list.length - 1].url : null;
}

function sizeOf(f, duration) {
  if (f.filesize) return f.filesize;
  if (f.filesize_approx) return f.filesize_approx;
  if (f.tbr && duration) return f.tbr * 125 * duration;
  return 0;
}

// Map a format's shortest side (so vertical videos count correctly) to a
// standard rung on the quality ladder.
function bucketOf(f) {
  const h = f.height || 0;
  const w = f.width || 0;
  const side = w && h ? Math.min(w, h) : h;
  if (!side) return 0;
  for (const q of QUALITY_LADDER) if (side >= q.height * 0.9) return q.height;
  return 144;
}

const AUDIO_EXT = /^(mp3|m4a|opus|ogg|oga|wav|flac|aac|weba|mka)$/i;
// Direct links often report no codec at all, so unknown means "probably video"
// unless the container is an audio one.
function hasVideoCodec(f) {
  if (f.vcodec === 'none') return false;
  if (f.vcodec || f.height || f.width) return true;
  if (f.video_ext && f.video_ext !== 'none') return true;
  return !AUDIO_EXT.test(f.ext || '');
}
const isAudioOnly = f => f.vcodec === 'none' && f.acodec && f.acodec !== 'none';

function normalizeVideo(info, url) {
  const duration = info.duration || 0;
  const formats = info.formats || [];
  const audioOnly = formats.filter(isAudioOnly);
  const bestAudio = audioOnly.reduce((m, f) => Math.max(m, sizeOf(f, duration)), 0);

  const byHeight = new Map();
  for (const f of formats) {
    if (!hasVideoCodec(f)) continue;
    const b = bucketOf(f);
    if (!b) continue;
    const muxed = f.acodec && f.acodec !== 'none';
    const size = sizeOf(f, duration) + (muxed ? 0 : bestAudio);
    const prev = byHeight.get(b);
    // Keep the H.264/MP4 estimate when there is one, since MP4 is the default
    const isMp4 = f.ext === 'mp4';
    if (!prev || (isMp4 && !prev.mp4) || (isMp4 === prev.mp4 && size > prev.size)) byHeight.set(b, { size, mp4: isMp4 });
  }

  let qualities = QUALITY_LADDER
    .filter(q => byHeight.has(q.height))
    .map(q => ({ height: q.height, label: q.label, size: Math.round(byHeight.get(q.height).size) || null }));

  const anyVideo = formats.length ? formats.some(hasVideoCodec) : info.vcodec !== 'none';
  if (!qualities.length && anyVideo) qualities = [{ height: 0, label: 'Melhor disponível', size: null }];

  return {
    kind: 'video',
    id: info.id,
    title: info.title || info.id || 'Sem título',
    channel: info.channel || info.uploader || info.creator || info.artist || null,
    duration,
    viewCount: info.view_count ?? null,
    uploadDate: info.upload_date || null,
    thumbnail: pickThumb(info),
    site: info.extractor_key || info.extractor || null,
    url: info.webpage_url || url,
    hasVideo: qualities.length > 0,
    qualities,
    chapters: (info.chapters || []).filter(c => c && c.title != null).map(c => ({ title: c.title, start: c.start_time || 0, end: c.end_time || 0 })),
    isLive: !!info.is_live
  };
}

function normalizePlaylist(info, url) {
  const entries = (info.entries || []).filter(Boolean).map((e, i) => ({
    index: i + 1,
    id: e.id || null,
    title: e.title || `Item ${i + 1}`,
    duration: e.duration || null,
    thumbnail: pickThumb(e)
  }));
  return {
    kind: 'playlist',
    id: info.id,
    title: info.title || 'Playlist',
    channel: info.channel || info.uploader || info.playlist_uploader || null,
    duration: entries.reduce((a, e) => a + (e.duration || 0), 0),
    viewCount: info.view_count ?? null,
    thumbnail: pickThumb(info) || (entries[0] && entries[0].thumbnail) || null,
    site: info.extractor_key || info.extractor || null,
    url: info.webpage_url || url,
    entries,
    // Flat listings rarely include formats, so the UI offers the standard ladder
    qualities: QUALITY_LADDER.filter(q => q.height <= 2160 && q.height >= 360).map(q => ({ height: q.height, label: q.label, size: null })),
    hasVideo: true
  };
}

async function analyze(url, settings) {
  const { stdout } = await run(['-J', '--flat-playlist', '--no-warnings', '--', url], settings, { timeout: 90000 });
  let info;
  try { info = JSON.parse(stdout); } catch { throw new Error('Não conseguimos ler as informações desse link. Tente de novo.'); }
  if (info._type === 'playlist' || Array.isArray(info.entries)) {
    const pl = normalizePlaylist(info, url);
    if (!pl.entries.length) throw new Error('Essa playlist está vazia ou é privada.');
    return pl;
  }
  const v = normalizeVideo(info, url);
  if (v.isLive) throw new Error('Esta transmissão ainda está ao vivo. Tente de novo depois que ela terminar.');
  return v;
}

async function version(settings) {
  if (!isInstalled()) return null;
  try { return (await run(['--version'], settings, { timeout: 30000 })).stdout.trim(); } catch { return null; }
}

async function update(settings) {
  if (process.env.VELA_YTDLP) return { updated: false, message: 'Atualização desativada no modo de desenvolvimento.' };
  const { stdout, stderr } = await run(['-U'], settings, { timeout: 180000 });
  const out = stdout + stderr;
  const m = out.match(/Updated yt-dlp to\s+\S*?@?([\d.]+)/i);
  if (m) return { updated: true, message: `Motor atualizado para a versão ${m[1]}.` };
  return { updated: false, message: 'O motor de download já está na versão mais recente.' };
}

async function listExtractors(settings) {
  const cache = path.join(app.getPath('userData'), 'extractors.json');
  try {
    const c = JSON.parse(fs.readFileSync(cache, 'utf8'));
    const v = await version(settings);
    if (c.version === v && c.extractors && c.extractors.length) return c;
  } catch { /* no cache yet */ }
  if (isInstalled()) {
    try {
      const { stdout } = await run(['--list-extractors'], settings, { timeout: 60000 });
      const extractors = stdout.split(/\r?\n/).map(s => s.trim()).filter(s => s && !/CURRENTLY BROKEN/.test(s));
      const data = { version: await version(settings), extractors };
      fs.writeFileSync(cache, JSON.stringify(data));
      return data;
    } catch { /* fall back to the bundled list */ }
  }
  return require('./extractors.json');
}

// ---------------------------------------------------------------------------
// Downloads

function buildDownloadArgs(job) {
  const a = [
    '--newline', '--progress', '--progress-delta', '0.3',
    '--progress-template', PROGRESS_TEMPLATE,
    '--print-to-file', 'after_move:filepath', job.printFile,
    '--no-mtime', '--embed-metadata', '--concurrent-fragments', '4',
    '-P', job.dir
  ];

  if (job.isPlaylist) {
    a.push('--yes-playlist', '--ignore-errors', '-o', '%(playlist_title,playlist_id).100B/%(playlist_index)03d - %(title).150B.%(ext)s');
    if (job.items && job.items.length) a.push('--playlist-items', job.items.join(','));
  } else {
    a.push('--no-playlist', '-o', '%(title).150B [%(id)s].%(ext)s');
  }

  if (job.mode === 'audio') {
    a.push('-f', 'ba/b', '-x', '--audio-format', job.format.toLowerCase(), '--audio-quality', job.kbps + 'K', '--embed-thumbnail');
  } else {
    const sort = [];
    if (job.height) sort.push('res:' + job.height);
    if (job.format === 'MP4') sort.push('vcodec:h264', 'ext:mp4:m4a');
    if (job.format === 'WebM') sort.push('ext:webm:webm');
    a.push('-f', 'bv*+ba/b');
    if (sort.length) a.push('-S', sort.join(','));
    const merge = { MP4: 'mp4', WebM: 'webm/mkv', MKV: 'mkv' }[job.format] || 'mp4';
    a.push('--merge-output-format', merge);
    if (job.format === 'MP4') a.push('--remux-video', 'mp4');
    if (job.format === 'MKV') a.push('--remux-video', 'mkv');
    if (job.subtitles) a.push('--write-subs', '--sub-langs', 'pt.*', '--embed-subs');
  }

  if (job.saveThumbnail) a.push('--write-thumbnail', '--convert-thumbnails', 'jpg');
  if (job.splitChapters && !job.isPlaylist) {
    // One file per chapter, in a folder named after the video
    a.push('--split-chapters', '-o', 'chapter:%(title).150B/%(section_number)02d - %(section_title).120B.%(ext)s');
  }
  a.push('--', job.url);
  return a;
}

const num = v => (v === undefined || v === null || v === 'NA' || v === 'None' ? null : Number(v));

// Runs one download and reports progress through `onUpdate`.
class DownloadRun {
  constructor(job, settings, onUpdate) {
    this.job = job;
    this.settings = settings;
    this.onUpdate = onUpdate;
    this.child = null;
    this.stopReason = null; // 'pause' | 'cancel'
    this.stream = 0;
    this.stage = 'download';
    this.itemIndex = 1;
    this.itemTotal = job.isPlaylist ? (job.items ? job.items.length : job.itemCount || 1) : 1;
    this.itemFrac = 0;
    this.doneBytes = 0;
    this.curBytes = 0;
    this.destinations = [];
    this.chapterFiles = [];
    this.lastError = '';
    this.stderrTail = [];
    this.startedAt = Date.now();
  }

  start() {
    const job = this.job;
    job.printFile = path.join(os.tmpdir(), `vela-${job.id}-${Date.now()}.txt`);
    fs.mkdirSync(job.dir, { recursive: true });
    return new Promise(resolve => {
      try {
        this.child = spawnEngine(buildDownloadArgs(job), this.settings);
      } catch (err) {
        resolve({ ok: false, error: err.message });
        return;
      }
      lineReader(this.child.stdout, l => this.onLine(l));
      lineReader(this.child.stderr, l => this.onLine(l, true));
      this.child.on('error', err => { this.lastError = err.message; });
      this.child.on('close', code => resolve(this.finish(code)));
    });
  }

  stop(reason) {
    this.stopReason = reason;
    killTree(this.child);
  }

  onLine(line, isErr) {
    const job = this.job;
    if (line.startsWith(PROGRESS_PREFIX)) {
      const [status, dl, total, est, speed, eta] = line.slice(PROGRESS_PREFIX.length).split('|');
      const size = num(total) || num(est) || 0;
      const got = num(dl) || 0;
      if (this.stream === 0) this.stream = 1;
      this.curBytes = got;
      const f = size ? Math.min(1, got / size) : 0;
      this.setItemFrac(this.streamWeight(f));
      job.speed = num(speed) || 0;
      job.eta = num(eta);
      if (status === 'finished') { this.doneBytes += size || got; this.curBytes = 0; }
      this.emit();
      return;
    }

    let m;
    if ((m = line.match(/^\[download\] Downloading item (\d+) of (\d+)/))) {
      this.itemIndex = Number(m[1]);
      this.itemTotal = Number(m[2]);
      this.stream = 0;
      this.itemFrac = 0;
      this.stage = 'download';
      job.itemIndex = this.itemIndex;
      job.itemTotal = this.itemTotal;
      this.emit();
      return;
    }
    if ((m = line.match(/^\[download\] Destination: (.+)$/))) {
      this.stream += 1;
      this.stage = 'download';
      this.destinations.push(m[1].trim());
      this.emit();
      return;
    }
    if (/has already been downloaded/.test(line)) {
      this.setItemFrac(job.mode === 'audio' ? 0.9 : 0.97);
      this.emit();
      return;
    }
    if ((m = line.match(/^\[SplitChapters\] Chapter (\d+); Destination: (.+)$/))) {
      this.stage = 'split';
      this.chapterFiles.push(path.resolve(job.dir, m[2].trim()));
      job.chapterCount = this.chapterFiles.length;
      this.setItemFrac(0.97 + Math.min(0.02, this.chapterFiles.length * 0.001));
      this.emit();
      return;
    }
    if (/^\[SplitChapters\]/.test(line)) { this.stage = 'split'; this.setItemFrac(0.97); this.emit(); return; }
    if (/^\[(Merger|VideoRemuxer|VideoConvertor)\]/.test(line)) { this.stage = 'merge'; this.setItemFrac(0.97); this.emit(); return; }
    if (/^\[ExtractAudio\]/.test(line)) { this.stage = 'convert'; this.setItemFrac(0.94); this.emit(); return; }
    if (/^\[(EmbedSubtitle|Metadata|EmbedThumbnail|ThumbnailsConvertor|Fixup\w*|MoveFiles|SubtitlesConvertor)\]/.test(line)) {
      if (this.stage === 'download') this.stage = 'finishing';
      this.emit();
      return;
    }
    if (/^ERROR:/.test(line)) this.lastError = line;
    if (isErr) {
      this.stderrTail.push(line);
      if (this.stderrTail.length > 20) this.stderrTail.shift();
    }
  }

  // Share of one item's progress that the current stream represents.
  streamWeight(f) {
    if (this.job.mode === 'audio') return f * 0.9;
    if (this.stream <= 1) return f * 0.85;
    return 0.85 + f * 0.12;
  }

  setItemFrac(v) {
    this.itemFrac = Math.max(this.itemFrac, Math.min(0.99, v));
  }

  emit() {
    const job = this.job;
    const overall = (this.itemIndex - 1 + this.itemFrac) / Math.max(1, this.itemTotal);
    job.progress = Math.max(job.progress || 0, Math.min(0.995, overall));
    job.stage = this.stage;
    job.stream = this.stream;
    job.bytes = this.doneBytes + this.curBytes;
    if (job.isPlaylist) {
      const elapsed = (Date.now() - this.startedAt) / 1000;
      job.eta = job.progress > 0.02 ? Math.round(elapsed * (1 - job.progress) / job.progress) : null;
    }
    this.onUpdate(job);
  }

  finish(code) {
    const job = this.job;
    let files = [];
    try {
      files = fs.readFileSync(job.printFile, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    } catch { /* nothing finished */ }
    fs.rm(job.printFile, { force: true }, () => {});

    if (this.stopReason === 'cancel') {
      this.cleanupPartials(files);
      for (const f of this.chapterFiles) fs.rm(f, { force: true }, () => {});
      return { ok: false, canceled: true };
    }
    if (this.stopReason === 'pause') return { ok: false, paused: true, files };

    const chapterFiles = this.chapterFiles;
    if (code === 0) return { ok: true, files, chapterFiles };
    if (job.isPlaylist && files.length) {
      return { ok: true, files, chapterFiles, partial: `${files.length} de ${this.itemTotal} itens baixados. Alguns vídeos da playlist não estavam disponíveis.` };
    }
    const errText = [this.lastError, ...this.stderrTail].join('\n');
    return { ok: false, error: friendlyError(errText), needsLogin: needsLogin(errText) };
  }

  cleanupPartials(finished) {
    const keep = new Set(finished);
    for (const d of this.destinations) {
      if (keep.has(d)) continue;
      for (const f of [d + '.part', d + '.ytdl', /\.f[\w-]+\.\w+$/.test(d) ? d : null]) {
        if (f) fs.rm(path.isAbsolute(f) ? f : path.join(this.job.dir, f), { force: true }, () => {});
      }
    }
  }
}

module.exports = {
  ensureEngine, isInstalled, analyze, version, update, listExtractors, friendlyError, needsLogin,
  DownloadRun, binPath, ffmpegPath,
  // exposed for tests
  _internal: { normalizeVideo, normalizePlaylist, buildDownloadArgs }
};
