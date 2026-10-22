'use strict';

(() => {
  const api = window.vela;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ---------------------------------------------------------------------------
  // Constants

  const VIDEO_FORMATS = ['MP4', 'WebM', 'MKV'];
  const AUDIO_FORMATS = ['MP3', 'M4A', 'OPUS'];
  const AUDIO_QUALITIES = [
    { kbps: 320, label: 'kbps · Máxima' },
    { kbps: 256, label: 'kbps · Alta', tag: 'Recomendado' },
    { kbps: 192, label: 'kbps · Boa' },
    { kbps: 128, label: 'kbps · Leve' }
  ];
  // Typical MB per minute, used when a site doesn't report file sizes
  const MB_PER_MIN = { 4320: 250, 2160: 120, 1440: 58, 1080: 22, 720: 12, 480: 6.2, 360: 3.6, 240: 2.2, 144: 1.2, 0: 20 };
  const BROWSERS = [
    { v: 'firefox', label: 'Firefox' }, { v: 'chrome', label: 'Chrome' },
    { v: 'edge', label: 'Edge' }, { v: 'brave', label: 'Brave' }, { v: 'opera', label: 'Opera' }, { v: 'vivaldi', label: 'Vivaldi' }
  ];

  const I = {
    arrow: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    check: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    checkSm: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    dash: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"><path d="M6 12h12"/></svg>',
    pause: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
    play: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    retry: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
    folder: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    folderFill: '<svg class="fold" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    file: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    link: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
    search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    user: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    videoSm: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    listSm: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 6h12M4 12h12M4 18h8"/></svg>',
    music: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
    inbox: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v10M8 9l4 4 4-4"/><path d="M3 14h5l1 3h6l1-3h5v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>'
  };

  // ---------------------------------------------------------------------------
  // State

  const S = {
    settings: {},
    folders: [],
    popular: [],
    media: null,
    mediaUrl: '',
    mode: 'video',
    vfmt: 'MP4',
    afmt: 'MP3',
    height: 1080,
    kbps: 256,
    jobs: new Map(),
    history: [],
    focusId: null,
    view: 'new',
    step: 1,
    railFilter: 'all',
    clip: null,
    analyzing: false,
    engineVersion: null,
    sites: null
  };

  // ---------------------------------------------------------------------------
  // Formatting helpers

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n, d = 1) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  function fmtSize(bytes) {
    if (!bytes || bytes < 0) return '–';
    const mb = bytes / 1048576;
    if (mb >= 1024) return num(mb / 1024, mb >= 10240 ? 0 : 1) + ' GB';
    if (mb >= 10) return Math.round(mb) + ' MB';
    return num(mb, 1) + ' MB';
  }
  function fmtDur(s) {
    s = Math.round(s || 0);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0');
  }
  function fmtEta(s) {
    if (s === null || s === undefined || !isFinite(s)) return '–';
    s = Math.max(0, Math.round(s));
    if (s < 60) return s + ' s';
    if (s < 3600) return Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0') + ' s';
    return Math.floor(s / 3600) + ' h ' + String(Math.floor((s % 3600) / 60)).padStart(2, '0') + ' min';
  }
  const fmtSpeed = b => (b ? num(b / 1048576, 1) + ' MB/s' : '–');
  const fmtViews = n => n == null ? null : new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n) + ' visualizações';
  function fmtDate(yyyymmdd) {
    if (!yyyymmdd || yyyymmdd.length !== 8) return null;
    const d = new Date(+yyyymmdd.slice(0, 4), +yyyymmdd.slice(4, 6) - 1, +yyyymmdd.slice(6, 8));
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  const hueOf = s => { let h = 0; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const folderName = p => {
    const known = S.folders.find(f => f.path === p);
    if (known) return known.name;
    const parts = String(p).split(/[\\/]/).filter(Boolean);
    return parts[parts.length - 1] || p;
  };

  function thumbHTML(src, seed, extra = '') {
    const img = src ? `<img src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '';
    return `<div class="thumb" style="--h:${hueOf(seed)}">${img}${extra}</div>`;
  }
  // Fade thumbnails in once loaded; drop broken ones so the gradient shows
  document.addEventListener('load', e => { if (e.target.tagName === 'IMG' && e.target.closest('.thumb')) e.target.classList.add('ok'); }, true);
  document.addEventListener('error', e => { if (e.target.tagName === 'IMG' && e.target.closest('.thumb')) e.target.remove(); }, true);

  // ---------------------------------------------------------------------------
  // Toast

  let toastTimer;
  function toast(msg, { action, onAction, error, duration = 3200 } = {}) {
    $('.toast')?.remove();
    clearTimeout(toastTimer);
    const t = document.createElement('div');
    t.className = 'toast' + (error ? ' err' : '');
    t.setAttribute('role', 'status');
    t.innerHTML = (error ? '' : I.check) + `<span>${esc(msg)}</span>` + (action ? `<button type="button">${esc(action)}</button>` : '');
    if (action) t.querySelector('button').addEventListener('click', () => { t.remove(); onAction(); });
    document.body.appendChild(t);
    toastTimer = setTimeout(() => t.remove(), action ? Math.max(duration, 6000) : duration);
  }

  // ---------------------------------------------------------------------------
  // Window chrome

  $('#winMin').addEventListener('click', () => api.window.minimize());
  $('#winMax').addEventListener('click', () => api.window.toggleMaximize());
  $('#winClose').addEventListener('click', () => api.window.close());
  api.window.onState(({ maximized }) => {
    $('#winMaxIc').innerHTML = maximized
      ? '<rect x="2.5" y=".5" width="7" height="7" rx="1.2" fill="none" stroke="currentColor"/><rect x=".5" y="2.5" width="7" height="7" rx="1.2" fill="var(--side)" stroke="currentColor"/>'
      : '<rect x=".5" y=".5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor"/>';
    $('#winMax').setAttribute('aria-label', maximized ? 'Restaurar' : 'Maximizar');
  });

  $('#themeBtn').addEventListener('click', () => {
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    saveSettings({ theme: dark ? 'light' : 'dark' });
  });

  // ---------------------------------------------------------------------------
  // Navigation

  function showView(view) {
    S.view = view;
    $$('.side .nav[data-view]').forEach(n => n.classList.toggle('on', n.dataset.view === view));
    $$('.view').forEach(v => { v.hidden = v.id !== 'view-' + view; });
    $('#app').classList.toggle('no-rail', view !== 'new');
    $('#main').scrollTop = 0;
    if (view === 'new') { $('#newDot').hidden = true; if (S.step === 2) requestAnimationFrame(syncSegs); }
    if (view === 'downloads') renderJobs();
    if (view === 'history') renderHistory();
    if (view === 'sites') renderSites();
    if (view === 'settings') { renderSettings(); api.auth.status().then(st => { S.auth = st; renderSettings(); }); }
  }
  $$('.side .nav[data-view]').forEach(n => n.addEventListener('click', () => {
    if (n.dataset.view === 'new' && S.view === 'new' && S.step === 3) go(1);
    showView(n.dataset.view);
  }));
  $('#openDirNav').addEventListener('click', async () => {
    const r = await api.openPath(S.settings.downloadDir);
    if (!r.ok) toast(r.error, { error: true });
  });
  $('#seeSites').addEventListener('click', () => showView('sites'));

  function go(n) {
    S.step = n;
    $$('#stepper .step').forEach((s, i) => { s.classList.toggle('on', i === n - 1); s.classList.toggle('done', i < n - 1); });
    ['p1', 'p2', 'p3'].forEach((id, i) => { $('#' + id).hidden = i !== n - 1; });
    $('#main').scrollTop = 0;
    if (n === 1) { renderClip(); setTimeout(() => $('#url').focus(), 50); }
    if (n === 2) requestAnimationFrame(syncSegs);
    if (n === 3) renderFocus();
  }

  // ---------------------------------------------------------------------------
  // Step 1: link

  const url = $('#url');
  const analyzeBtn = $('#analyze');
  const setAnalyzeBtn = busy => {
    analyzeBtn.disabled = busy;
    analyzeBtn.innerHTML = busy ? '<span class="spin"></span>Analisando' : 'Continuar ' + I.arrow;
  };
  setAnalyzeBtn(false);

  function showUrlError(msg) {
    $('#urlErrTxt').innerHTML = msg;
    $('#urlErr').hidden = !msg;
    $('#pasteForm').classList.toggle('err', !!msg);
  }

  function looksLikeUrl(v) {
    return /^https?:\/\/\S+\.\S+/i.test(v);
  }

  async function analyze(value) {
    let v = String(value || '').trim();
    showUrlError('');
    if (!v) { url.focus(); return; }
    if (!/^https?:\/\//i.test(v) && /^[\w-]+(\.[\w-]+)+\//.test(v)) v = 'https://' + v;
    if (!looksLikeUrl(v)) { showUrlError('Isso não parece um link. Copie o endereço completo do vídeo, começando com https://'); return; }
    if (S.analyzing) return;
    url.value = v;
    S.analyzing = true;
    setAnalyzeBtn(true);
    $('#skel').hidden = false;
    $('#p1Extras').hidden = true;
    $('#clip').hidden = true;
    const slow = setTimeout(() => { $('#skelNote').textContent = 'Playlists grandes podem levar alguns segundos…'; }, 5000);
    const r = await api.analyze(v);
    clearTimeout(slow);
    $('#skelNote').textContent = 'Lendo as informações do link…';
    S.analyzing = false;
    setAnalyzeBtn(false);
    $('#skel').hidden = true;
    $('#p1Extras').hidden = false;
    if (!r.ok) {
      const needsSites = /Sites suportados/.test(r.error);
      const login = loginOffer(r.needsLogin, r.loginSite);
      const needsSettings = /Configurações/.test(r.error) || (r.needsLogin && !login);
      showUrlError(esc(login && login.connected ? login.retryText : r.error) +
        (login ? ` <button type="button" class="linkbtn" data-login="${login.site}">${login.label}</button>` : '') +
        (needsSettings ? ' <button type="button" class="linkbtn" data-goto="settings">Abrir Configurações</button>' : '') +
        (needsSites ? ' <button type="button" class="linkbtn" data-goto="sites">Ver sites</button>' : ''));
      renderClip();
      return;
    }
    S.media = r.data;
    S.mediaUrl = v;
    api.clipboard.ignore(v);
    if (S.clip && S.clip.url === v) S.clip = null;
    prepareOptions();
    renderStep2();
    go(2);
  }
  $('#urlErr').addEventListener('click', async e => {
    const g = e.target.closest('[data-goto]');
    if (g) { showView(g.dataset.goto); return; }
    const l = e.target.closest('[data-login]');
    if (l && await signIn(l.dataset.login)) analyze(url.value);
  });

  // ---------------------------------------------------------------------------
  // Sign-in for restricted videos

  const siteName = id => ((S.auth && S.auth.sites.find(s => s.id === id)) || {}).name || id;
  const isConnected = id => !!(S.auth && S.auth.sites.some(s => s.id === id && s.connected));

  // What to offer when a download needs an account: sign in through Vela
  // (unless the user chose an installed browser as the login source).
  function loginOffer(needsLogin, site) {
    if (!needsLogin || !site || S.settings.authSource === 'browser') return null;
    const connected = isConnected(site);
    return {
      site,
      connected,
      label: connected ? `Entrar de novo no ${siteName(site)}` : `Entrar com o ${siteName(site)}`,
      retryText: `O ${siteName(site)} recusou o login salvo. Ele pode ter expirado: entre de novo e tente outra vez.`
    };
  }

  let signingIn = false;
  async function signIn(siteId) {
    if (signingIn) return false;
    signingIn = true;
    toast(`Entre na sua conta do ${siteName(siteId)} na janela que abriu. Ela fecha sozinha quando o login terminar.`, { duration: 7000 });
    const r = await api.auth.login(siteId);
    signingIn = false;
    if (r.status) S.auth = r.status;
    S.settings = await api.settings.set({});
    if (S.view === 'settings') renderSettings();
    if (!r.ok) { toast(r.error, { error: true, duration: 8000 }); return false; }
    if (!r.connected) { toast('O login não foi concluído. Tente de novo quando quiser.'); return false; }
    toast(`Conectado ao ${siteName(siteId)}`);
    return true;
  }

  $('#pasteForm').addEventListener('submit', e => { e.preventDefault(); analyze(url.value); });
  url.addEventListener('input', () => showUrlError(''));
  url.addEventListener('paste', () => setTimeout(() => { if (looksLikeUrl(url.value.trim())) analyze(url.value); }, 30));
  document.addEventListener('paste', e => {
    if (e.target === url || S.view !== 'new' || S.step !== 1) return;
    if (e.target.closest && e.target.closest('input')) return;
    const text = (e.clipboardData && e.clipboardData.getData('text')) || '';
    if (text.trim()) { e.preventDefault(); url.value = text.trim(); analyze(url.value); }
  });

  // Clipboard detection
  function renderClip() {
    const c = S.clip;
    const show = !!c && S.step === 1 && !S.analyzing && url.value.trim() !== c.url;
    $('#clip').hidden = !show;
    if (!show) return;
    $('#clipTitle').textContent = `Encontramos um link do ${c.site} na sua área de transferência`;
    $('#clipUrl').textContent = c.url;
  }
  api.clipboard.onUrl(c => {
    if (c.url === S.mediaUrl) return;
    S.clip = c;
    if (S.view === 'new' && S.step === 1) { renderClip(); return; }
    $('#newDot').hidden = false;
    toast(`Link do ${c.site} copiado`, { action: 'Baixar', onAction: () => { showView('new'); go(1); url.value = c.url; analyze(c.url); } });
  });
  $('#useClip').addEventListener('click', () => { if (S.clip) { url.value = S.clip.url; analyze(S.clip.url); } });
  $('#dismissClip').addEventListener('click', () => { if (S.clip) api.clipboard.ignore(S.clip.url); S.clip = null; renderClip(); });

  // ---------------------------------------------------------------------------
  // Step 2: options

  function prepareOptions() {
    const m = S.media;
    const st = S.settings;
    S.mode = m.hasVideo ? (st.lastKind === 'audio' ? 'audio' : 'video') : 'audio';
    S.vfmt = VIDEO_FORMATS.includes(st.lastVideoFormat) ? st.lastVideoFormat : 'MP4';
    S.afmt = AUDIO_FORMATS.includes(st.lastAudioFormat) ? st.lastAudioFormat : 'MP3';
    S.kbps = AUDIO_QUALITIES.some(q => q.kbps === st.lastAudioKbps) ? st.lastAudioKbps : 256;
    const hs = m.qualities.map(q => q.height);
    const want = st.lastHeight || 1080;
    S.height = hs.find(h => h <= want) ?? hs[hs.length - 1] ?? 0;
    if (m.kind === 'playlist') m.entries.forEach(e => { e.on = true; });
  }

  const selectedEntries = () => S.media.kind === 'playlist' ? S.media.entries.filter(e => e.on) : null;
  const selectedDuration = () => {
    const m = S.media;
    if (m.kind !== 'playlist') return m.duration || 0;
    return selectedEntries().reduce((a, e) => a + (e.duration || 0), 0);
  };
  const recommendedHeight = () => {
    const hs = S.media.qualities.map(q => q.height);
    return hs.includes(1080) ? 1080 : hs[0];
  };

  function estimateFor(q) {
    const m = S.media;
    if (m.kind === 'video' && q.size) return q.size;
    const mins = selectedDuration() / 60;
    if (!mins) return null;
    return (MB_PER_MIN[q.height] ?? 20) * mins * 1048576;
  }
  const audioEstimate = kbps => selectedDuration() * kbps * 1000 / 8;
  function currentEstimate() {
    if (S.mode === 'audio') return audioEstimate(S.kbps) || null;
    const q = S.media.qualities.find(x => x.height === S.height);
    return q ? estimateFor(q) : null;
  }
  const qualityLabel = () => S.mode === 'audio' ? `${S.kbps} kbps` : (S.height ? S.height + 'p' : 'Original');

  function renderStep2() {
    const m = S.media;
    const isList = m.kind === 'playlist';
    const meta = [
      m.channel ? `<span>${I.user}${esc(m.channel)}</span>` : '',
      m.duration ? `<span class="mono">${fmtDur(m.duration)}</span>` : '',
      fmtViews(m.viewCount) ? `<span>${fmtViews(m.viewCount)}</span>` : '',
      fmtDate(m.uploadDate) ? `<span>${fmtDate(m.uploadDate)}</span>` : ''
    ].join('');
    $('#mediaCard').innerHTML = `<div class="media">
      ${thumbHTML(m.thumbnail, m.id, `<span class="dur">${isList ? m.entries.length + ' vídeos' : (m.duration ? fmtDur(m.duration) : '')}</span>`)}
      <div class="media-body">
        <div class="pills">
          <span class="pill ${isList ? 'acc' : ''}">${isList ? I.listSm + 'Playlist' : (m.hasVideo ? I.videoSm + 'Vídeo' : 'Áudio')}</span>
          ${m.site ? `<span class="pill">${esc(prettySite(m.site))}</span>` : ''}
          ${chaptersOf(m).length ? `<span class="pill">${chaptersOf(m).length} capítulos</span>` : ''}
        </div>
        <p class="media-title">${esc(m.title)}</p>
        <div class="meta">${meta}</div>
        <div><button class="linkbtn" type="button" id="changeLink">Usar outro link</button></div>
      </div></div>`;
    $('#mediaCard .dur').hidden = !$('#mediaCard .dur').textContent;
    $('#changeLink').addEventListener('click', () => { go(1); url.select(); });
    renderPlist();
    renderKind();
    renderFmt();
    renderRes();
    renderExtras();
    renderDest();
    renderSummary();
    $('#dlLbl').textContent = isList ? 'Baixar playlist' : (S.mode === 'audio' ? 'Baixar áudio' : 'Baixar vídeo');
  }

  function prettySite(key) {
    const k = String(key).replace(/(Tab|Playlist|IE|User|Clip|Video)$/,'');
    const pop = S.popular.find(p => p.name.toLowerCase().replace(/[^a-z0-9]/g, '').startsWith(k.toLowerCase().replace(/[^a-z0-9]/g, '')));
    if (pop) return pop.name;
    if (/^generic$/i.test(k)) return 'Link direto';
    return k;
  }

  function renderPlist() {
    const w = $('#plistWrap');
    if (S.media.kind !== 'playlist') { w.innerHTML = ''; return; }
    const it = S.media.entries;
    const n = it.filter(e => e.on).length;
    const all = n === it.length;
    const body = w.querySelector('.plist-body');
    const scroll = body ? body.scrollTop : 0;
    w.innerHTML = `<div class="plist">
      <div class="plist-head">
        <button type="button" class="cb ${all ? 'on' : n ? 'some' : ''}" id="allCb" aria-label="${all ? 'Desmarcar todos' : 'Selecionar todos'}">${all ? I.checkSm : n ? I.dash : ''}</button>
        <span><b>${n} de ${it.length}</b> vídeos selecionados</span><span class="sp"></span>
        <span class="mono">${fmtDur(selectedDuration())}</span>
      </div>
      <div class="plist-body">${it.map((e, i) => `
        <div class="prow ${e.on ? 'on' : 'off'}" data-i="${i}" role="checkbox" aria-checked="${e.on}" tabindex="0">
          <span class="cb">${I.checkSm}</span>
          <span class="idx">${e.index}</span>${thumbHTML(e.thumbnail, e.id || e.title)}<span class="t" title="${esc(e.title)}">${esc(e.title)}</span><span class="d">${e.duration ? fmtDur(e.duration) : ''}</span>
        </div>`).join('')}</div></div>`;
    w.querySelector('.plist-body').scrollTop = scroll;
    const toggle = row => { const e = it[row.dataset.i]; e.on = !e.on; renderPlist(); renderRes(); renderSummary(); w.querySelector(`.prow[data-i="${row.dataset.i}"]`)?.focus(); };
    $$('.prow', w).forEach(r => {
      r.addEventListener('click', () => toggle(r));
      r.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(r); } });
    });
    $('#allCb').addEventListener('click', () => { it.forEach(e => { e.on = !all; }); renderPlist(); renderRes(); renderSummary(); });
  }

  function syncSeg(seg) {
    const on = seg.querySelector('button.on');
    const th = seg.querySelector('.thumbsel');
    if (!th) return;
    if (!on || !on.offsetWidth) { th.style.width = '0'; return; }
    th.style.width = on.offsetWidth + 'px';
    th.style.transform = `translateX(${on.offsetLeft - 3}px)`;
  }
  const syncSegs = () => $$('.seg').forEach(syncSeg);
  window.addEventListener('resize', syncSegs);

  function renderKind() {
    $$('#kindSeg button').forEach(b => {
      b.classList.toggle('on', b.dataset.kind === S.mode);
      b.disabled = b.dataset.kind === 'video' && !S.media.hasVideo;
      b.title = b.disabled ? 'Este link não tem vídeo, só áudio' : '';
    });
    syncSeg($('#kindSeg'));
  }
  $$('#kindSeg button').forEach(b => b.addEventListener('click', () => {
    if (b.disabled) return;
    S.mode = b.dataset.kind;
    renderKind(); renderFmt(); renderRes(); renderExtras(); renderSummary();
    $('#dlLbl').textContent = S.media.kind === 'playlist' ? 'Baixar playlist' : (S.mode === 'audio' ? 'Baixar áudio' : 'Baixar vídeo');
  }));

  function renderFmt() {
    const seg = $('#fmtSeg');
    const list = S.mode === 'audio' ? AUDIO_FORMATS : VIDEO_FORMATS;
    const cur = S.mode === 'audio' ? S.afmt : S.vfmt;
    seg.innerHTML = '<span class="thumbsel"></span>' + list.map(f => `<button type="button" class="${f === cur ? 'on' : ''}" data-f="${f}">${f}</button>`).join('');
    $$('button', seg).forEach(b => b.addEventListener('click', () => {
      if (S.mode === 'audio') S.afmt = b.dataset.f; else S.vfmt = b.dataset.f;
      $$('button', seg).forEach(x => x.classList.toggle('on', x === b));
      syncSeg(seg);
      renderSummary();
    }));
    requestAnimationFrame(() => syncSeg(seg));
  }

  function renderRes() {
    const g = $('#res');
    const isList = S.media.kind === 'playlist';
    if (S.mode === 'audio') {
      $('#qualLbl').textContent = 'Qualidade do áudio';
      $('#qualHint').textContent = isList ? 'Tamanho estimado para os vídeos selecionados' : 'Tamanho estimado do arquivo';
      g.innerHTML = AUDIO_QUALITIES.map(q => {
        const est = audioEstimate(q.kbps);
        return `<button type="button" class="${q.kbps === S.kbps ? 'on' : ''}" data-v="${q.kbps}" aria-pressed="${q.kbps === S.kbps}">
          ${q.tag ? `<span class="tag">${q.tag}</span>` : ''}<span class="radio"></span>
          <span class="r">${q.kbps}</span><span class="q">${q.label}</span><span class="s">${est ? '~' + fmtSize(est) : '–'}</span></button>`;
      }).join('');
    } else {
      $('#qualLbl').textContent = 'Resolução';
      $('#qualHint').textContent = isList ? 'Cada vídeo é baixado na melhor qualidade até a escolhida' : 'Tamanho estimado do arquivo';
      const rec = recommendedHeight();
      g.innerHTML = S.media.qualities.map(q => {
        const est = estimateFor(q);
        return `<button type="button" class="${q.height === S.height ? 'on' : ''}" data-v="${q.height}" aria-pressed="${q.height === S.height}">
          ${q.height === rec && S.media.qualities.length > 1 ? '<span class="tag">Recomendado</span>' : ''}<span class="radio"></span>
          <span class="r">${q.height ? (isList ? 'Até ' : '') + q.height + 'p' : 'Original'}</span><span class="q">${esc(q.label)}</span><span class="s">${est ? '~' + fmtSize(est) : 'Tamanho desconhecido'}</span></button>`;
      }).join('');
    }
    $$('button', g).forEach(b => b.addEventListener('click', () => {
      if (S.mode === 'audio') S.kbps = +b.dataset.v; else S.height = +b.dataset.v;
      renderRes(); renderSummary();
    }));
  }

  // Chapters are only offered for single videos that have at least two
  const chaptersOf = m => (m && m.kind === 'video' && m.chapters && m.chapters.length > 1 ? m.chapters : []);
  const splitting = () => S.settings.splitChapters && chaptersOf(S.media).length > 0;

  function renderExtras() {
    const subs = $('#tgSubs');
    subs.disabled = S.mode === 'audio';
    $$('#p2 .tg').forEach(t => t.classList.toggle('on', !!S.settings[t.dataset.tg] && !t.disabled));
    const ch = chaptersOf(S.media);
    $('#chapBox').hidden = !ch.length;
    if (!ch.length) return;
    $('#chapHint').textContent = `Salva ${ch.length} arquivos, um por capítulo, numa pasta com o nome do ${S.mode === 'audio' ? 'áudio' : 'vídeo'}`;
    $('#chapMore').hidden = !S.settings.splitChapters;
    $('#chapList').innerHTML = ch.map((c, i) => `<li><span class="n">${String(i + 1).padStart(2, '0')}</span><span class="t" title="${esc(c.title)}">${esc(c.title)}</span><span class="d">${fmtDur(c.start)}</span></li>`).join('');
  }
  $$('#p2 .tg').forEach(t => t.addEventListener('click', () => {
    if (t.disabled) return;
    const k = t.dataset.tg;
    saveSettings({ [k]: !S.settings[k] }).then(() => { renderExtras(); renderSummary(); });
  }));

  // Destination
  const menu = $('#destMenu');
  const destBtn = $('#destBtn');
  function renderDest() {
    const d = S.settings.downloadDir;
    $('#destName').textContent = folderName(d);
    $('#destPath').textContent = d;
    $('#destPath').title = d;
    $('#howDir').textContent = folderName(d);
    $('#howDir').title = d;
  }
  function renderMenu() {
    const seen = new Set();
    const list = [...S.folders, ...(S.settings.recentDirs || []).map(p => ({ name: folderName(p), path: p }))]
      .filter(f => f.path && !seen.has(f.path) && seen.add(f.path));
    menu.innerHTML = list.map(f => `<button type="button" data-p="${esc(f.path)}">${I.folderFill}
        <span><b style="font-weight:500">${esc(f.name)}</b><small>${esc(f.path)}</small></span>
        ${f.path === S.settings.downloadDir ? `<span class="ck">${I.check}</span>` : ''}</button>`).join('') +
      `<hr><button type="button" data-p="__browse">${I.search}<span><b style="font-weight:500">Procurar outra pasta…</b><small>Escolha qualquer pasta do computador</small></span></button>`;
    $$('button', menu).forEach(b => b.addEventListener('click', async () => {
      closeMenu();
      let p = b.dataset.p;
      if (p === '__browse') { p = await api.chooseFolder(); if (!p) return; }
      if (p === S.settings.downloadDir) return;
      await saveSettings({ downloadDir: p });
      renderDest(); renderSummary(); refreshDisk();
      toast('Os downloads serão salvos em ' + folderName(p));
    }));
  }
  const closeMenu = () => { menu.hidden = true; destBtn.setAttribute('aria-expanded', 'false'); };
  destBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (menu.hidden) { renderMenu(); menu.hidden = false; destBtn.setAttribute('aria-expanded', 'true'); menu.querySelector('button')?.focus(); } else closeMenu();
  });
  document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target)) closeMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  function renderSummary() {
    const isList = S.media.kind === 'playlist';
    const n = isList ? selectedEntries().length : 1;
    const fmt = S.mode === 'audio' ? S.afmt : S.vfmt;
    $('#sumMain').textContent = `${qualityLabel()} · ${fmt}${isList ? ` · ${n} ${n === 1 ? 'vídeo' : 'vídeos'}` : ''}${splitting() ? ` · ${chaptersOf(S.media).length} capítulos` : ''}`;
    const est = currentEstimate();
    $('#sumSub').textContent = n
      ? `${est ? '~' + fmtSize(est) + ' · ' : ''}salvando em ${folderName(S.settings.downloadDir)}`
      : 'Selecione ao menos um vídeo da playlist';
    $('#download').disabled = !n;
  }

  $('#back').addEventListener('click', () => go(1));

  $('#download').addEventListener('click', async () => {
    const m = S.media;
    const isList = m.kind === 'playlist';
    const sel = isList ? selectedEntries() : null;
    const btn = $('#download');
    btn.disabled = true;
    const r = await api.downloads.start({
      url: m.url || S.mediaUrl,
      title: m.title,
      thumbnail: m.thumbnail,
      site: m.site ? prettySite(m.site) : null,
      channel: m.channel,
      isPlaylist: isList,
      itemCount: isList ? m.entries.length : 1,
      items: isList && sel.length < m.entries.length ? sel.map(e => e.index) : null,
      mode: S.mode,
      format: S.mode === 'audio' ? S.afmt : S.vfmt,
      height: S.height,
      kbps: S.kbps,
      qualityLabel: qualityLabel(),
      subtitles: S.mode === 'video' && S.settings.subtitles,
      splitChapters: splitting(),
      keepFullVideo: S.settings.keepFullVideo,
      saveThumbnail: S.settings.saveThumbnail,
      estimate: currentEstimate(),
      dir: S.settings.downloadDir
    });
    btn.disabled = false;
    if (!r.ok) { toast(r.error, { error: true }); return; }
    saveSettings({
      lastKind: S.mode, lastVideoFormat: S.vfmt, lastAudioFormat: S.afmt,
      lastHeight: S.mode === 'video' && S.height ? S.height : S.settings.lastHeight, lastAudioKbps: S.kbps
    });
    upsertJob(r.data);
    S.focusId = r.data.id;
    go(3);
  });

  // ---------------------------------------------------------------------------
  // Step 3: progress of the focused download

  function stagesOf(job) {
    const split = job.splitChapters ? ['Dividindo capítulos'] : [];
    if (job.mode === 'audio') return ['Baixando áudio', 'Convertendo', ...split, 'Concluído'];
    return ['Baixando vídeo', 'Baixando áudio', 'Finalizando', ...split, 'Concluído'];
  }
  function stageIndex(job) {
    const last = stagesOf(job).length - 1;
    if (job.status === 'done') return last;
    if (job.stage === 'split') return last - 1;
    if (job.mode === 'audio') return ['convert', 'merge', 'finishing'].includes(job.stage) ? 1 : 0;
    if (['merge', 'finishing'].includes(job.stage)) return 2;
    return job.stream >= 2 ? 1 : 0;
  }

  function renderFocus() {
    if (S.step !== 3) return;
    const job = S.jobs.get(S.focusId);
    if (!job) { go(1); return; }
    const p = job.status === 'done' ? 1 : (job.progress || 0);
    const ring = $('#ring');
    ring.classList.toggle('done', job.status === 'done');
    ring.classList.toggle('error', job.status === 'error');
    ring.classList.toggle('paused', job.status === 'paused' || job.status === 'queued');
    $('#ringArc').style.strokeDashoffset = 364.4 * (1 - p);
    $('#ringArc').style.stroke = job.status === 'done' ? 'var(--ok)' : job.status === 'error' ? 'var(--err)' : '';
    $('#ringPct').innerHTML = Math.floor(p * 100) + '<small>%</small>';

    const noun = job.isPlaylist ? 'sua playlist' : job.mode === 'audio' ? 'seu áudio' : 'seu vídeo';
    const titles = {
      queued: 'Na fila para baixar',
      running: 'Baixando ' + noun,
      paused: 'Download pausado',
      done: job.chapterCount ? `Dividido em ${job.chapterCount} capítulos` : job.isPlaylist ? 'Playlist baixada' : job.mode === 'audio' ? 'Áudio baixado' : 'Vídeo baixado',
      error: 'Não foi possível baixar'
    };
    $('#p3Title').textContent = titles[job.status] || titles.running;
    const sub = {
      queued: 'Ele começa assim que um dos downloads em andamento terminar.',
      running: 'Você pode colar outro link enquanto isso. O download continua na lista ao lado.',
      paused: 'Continue quando quiser. O download retoma de onde parou.',
      done: 'Salvo em ' + job.dir,
      error: job.error || 'Tente de novo em alguns instantes.'
    };
    $('#p3Sub').textContent = sub[job.status] || '';
    $('#p3Sub').classList.toggle('selectable', true);

    const st = stagesOf(job);
    const cur = stageIndex(job);
    const showStages = job.status !== 'error';
    $('#stages').hidden = !showStages;
    const itemTxt = job.isPlaylist && job.status !== 'done' ? `<span class="stage">Vídeo ${job.itemIndex || 1} de ${job.itemTotal}</span>` : '';
    $('#stages').innerHTML = itemTxt + st.map((s, i) => {
      const done = i < cur || job.status === 'done';
      const on = i === cur && job.status === 'running';
      return `<span class="stage ${done ? 'done' : on ? 'on' : ''}">${done ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : on ? '<span class="spin" style="width:11px;height:11px;border-width:1.5px"></span>' : ''}${s}</span>`;
    }).join('');

    $('#stats').hidden = job.status === 'error';
    $('#stSpeed').textContent = job.status === 'running' ? fmtSpeed(job.speed) : job.status === 'paused' ? 'Pausado' : '–';
    $('#stDone').textContent = job.status === 'done'
      ? fmtSize(job.bytes || job.estimate)
      : (job.bytes ? fmtSize(job.bytes) : '0 MB') + (job.estimate ? ' / ~' + fmtSize(job.estimate) : '');
    $('#stEta').textContent = job.status === 'done' ? 'Pronto' : job.status === 'running' && job.stage === 'download' ? fmtEta(job.eta) : job.status === 'running' ? 'Quase lá' : '–';

    const acts = $('#p3Actions');
    const key = [job.status, job.files && job.files.length, job.chapterCount, job.needsLogin, isConnected(job.loginSite)].join('|');
    if (acts.dataset.key === key && acts.dataset.id === job.id) return;
    acts.dataset.key = key;
    acts.dataset.id = job.id;
    const btn = (id, cls, icon, label) => `<button class="btn ${cls}" type="button" data-a="${id}">${icon}${label}</button>`;
    const plus = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
    let html = '';
    if (job.status === 'done' && job.chapterCount) {
      html = btn('chapters', 'btn-primary', I.folder, `Abrir ${job.chapterCount} capítulos`) +
        (job.keepFullVideo ? btn('playFull', 'btn-ghost', I.file, job.mode === 'audio' ? 'Ouvir completo' : 'Assistir completo') : '') +
        btn('another', 'btn-ghost', plus, 'Baixar outro link');
    } else if (job.status === 'done') {
      html = (!job.isPlaylist && job.files && job.files[0] ? btn('play', 'btn-primary', I.file, job.mode === 'audio' ? 'Ouvir' : 'Assistir') : '') +
        btn('reveal', job.isPlaylist ? 'btn-primary' : 'btn-ghost', I.folder, 'Mostrar na pasta') + btn('another', 'btn-ghost', plus, 'Baixar outro link');
    } else if (job.status === 'error') {
      const login = loginOffer(job.needsLogin, job.loginSite);
      html = (login ? btn('login', 'btn-primary', I.user, login.connected ? 'Entrar de novo e tentar' : `Entrar com o ${siteName(login.site)} e tentar`) : '') +
        btn('retry', login ? 'btn-ghost' : 'btn-primary', I.retry, 'Tentar de novo') + btn('another', 'btn-ghost', plus, 'Baixar outro link');
    } else if (job.status === 'paused') {
      html = btn('resume', 'btn-primary', I.play, 'Continuar') + btn('cancel', 'btn-ghost', I.x, 'Cancelar') + btn('another', 'btn-ghost', plus, 'Baixar outro link');
    } else {
      html = btn('another', 'btn-primary', plus, 'Baixar outro link') + btn('pause', 'btn-ghost', I.pause, 'Pausar') + btn('cancel', 'btn-ghost', I.x, 'Cancelar');
    }
    if (job.notice) html += `<p class="notice">${esc(job.notice)}</p>`;
    acts.innerHTML = html;
  }

  $('#p3Actions').addEventListener('click', e => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const job = S.jobs.get(S.focusId);
    if (b.dataset.a === 'another') { url.value = ''; go(1); return; }
    if (job) jobAction(job, b.dataset.a);
  });

  async function jobAction(job, a) {
    if (a === 'pause') api.downloads.pause(job.id);
    else if (a === 'resume' || a === 'retry') api.downloads.resume(job.id);
    else if (a === 'cancel') api.downloads.cancel(job.id);
    else if (a === 'remove') api.downloads.remove(job.id);
    else if (a === 'play') { const r = await api.openPath(job.files[0]); if (!r.ok) toast(r.error, { error: true }); }
    else if (a === 'playFull') { const r = await api.openPath(job.files[job.files.length - 1]); if (!r.ok) toast(r.error, { error: true }); }
    else if (a === 'chapters') {
      const dir = String(job.files[0] || '').replace(/[\\/][^\\/]*$/, '');
      const r = await api.openPath(dir || job.dir);
      if (!r.ok) toast(r.error, { error: true });
    }
    else if (a === 'login') { if (await signIn(job.loginSite)) api.downloads.resume(job.id); }
    else if (a === 'reveal') {
      const target = job.files && job.files[0];
      const r = target ? await api.reveal(target) : await api.openPath(job.dir);
      if (!r.ok) toast(r.error, { error: true });
    }
  }

  // ---------------------------------------------------------------------------
  // Downloads list (rail + downloads view)

  function upsertJob(job) {
    S.jobs.set(job.id, Object.assign(S.jobs.get(job.id) || {}, job));
  }

  function statusText(j) {
    const pct = Math.floor((j.progress || 0) * 100);
    switch (j.status) {
      case 'queued': return 'Na fila';
      case 'paused': return `Pausado · ${pct}%`;
      case 'error': return 'Falhou · ' + (j.error || '');
      case 'done': return 'Concluído' + (j.chapterCount ? ` · ${j.chapterCount} capítulos` : '') + (j.bytes || j.estimate ? ' · ' + fmtSize(j.bytes || j.estimate) : '');
      default: {
        if (j.stage === 'merge') return `${pct}% · Juntando vídeo e áudio`;
        if (j.stage === 'convert') return `${pct}% · Convertendo para ${j.format}`;
        if (j.stage === 'finishing') return `${pct}% · Finalizando`;
        if (j.stage === 'split') return `${pct}% · Dividindo em capítulos`;
        const parts = [`${pct}%`];
        if (j.speed) parts.push(fmtSpeed(j.speed));
        if (j.eta != null) parts.push(fmtEta(j.eta));
        if (j.isPlaylist) parts.push(`${j.itemIndex || 1}/${j.itemTotal}`);
        return parts.join(' · ');
      }
    }
  }

  function jobMeta(j) {
    return [j.qualityLabel, j.format, j.isPlaylist ? j.itemTotal + ' vídeos' : null, j.splitChapters ? 'por capítulos' : null, j.site].filter(Boolean).join(' · ');
  }

  function jobButtons(j) {
    const b = (a, icon, label) => `<button class="ib" type="button" data-a="${a}" aria-label="${label}" title="${label}">${icon}</button>`;
    if (j.status === 'done') return b('reveal', I.folder, 'Mostrar na pasta') + b('remove', I.x, 'Remover da lista');
    if (j.status === 'error') return b('retry', I.retry, 'Tentar de novo') + b('remove', I.x, 'Remover da lista');
    if (j.status === 'paused') return b('resume', I.play, 'Continuar') + b('cancel', I.x, 'Cancelar');
    return b('pause', I.pause, 'Pausar') + b('cancel', I.x, 'Cancelar');
  }

  function jobCard(j) {
    const p = j.status === 'done' ? 100 : (j.progress || 0) * 100;
    return `<div class="dl ${j.status} ${j.id === S.focusId && S.step === 3 ? 'focus' : ''}" data-id="${j.id}">
      <div class="dl-top">${thumbHTML(j.thumbnail, j.id)}<div style="min-width:0"><div class="dl-t" title="${esc(j.title)}">${esc(j.title)}</div><div class="dl-m">${esc(jobMeta(j))}</div></div></div>
      <div class="bar"><i style="width:${p}%"></i></div>
      <div class="dl-foot"><span class="st mono" title="${esc(statusText(j))}">${esc(statusText(j))}</span>${jobButtons(j)}</div>
    </div>`;
  }

  const sortedJobs = () => [...S.jobs.values()].sort((a, b) => b.createdAt - a.createdAt);

  function renderJobs() {
    const all = sortedJobs();
    const list = all.filter(j => S.railFilter === 'all' || (S.railFilter === 'done' ? j.status === 'done' : j.status !== 'done'));
    const empty = msg => `<div class="empty">${I.inbox}<span>${msg}</span></div>`;
    $('#railList').innerHTML = list.length ? list.map(jobCard).join('')
      : empty(S.railFilter === 'done' ? 'Nenhum download concluído ainda.' : S.railFilter === 'active' ? 'Nada baixando agora.' : 'Seus downloads aparecem aqui.');
    if (S.view === 'downloads') {
      $('#dlGrid').innerHTML = all.length ? all.map(jobCard).join('') : empty('Nenhum download nesta sessão. Os anteriores estão no Histórico.');
      $('#clearDone').hidden = !all.some(j => j.status === 'done');
    }
    updateCounts();
  }

  // Update cards in place during progress so animations and hover stay smooth
  function patchJob(j) {
    const cards = $$(`.dl[data-id="${j.id}"]`);
    if (!cards.length) { renderJobs(); return; }
    for (const el of cards) {
      const statusChanged = !el.classList.contains(j.status);
      if (statusChanged) { el.outerHTML = jobCard(j); continue; }
      el.querySelector('.bar i').style.width = ((j.status === 'done' ? 1 : j.progress || 0) * 100) + '%';
      const st = el.querySelector('.st');
      st.textContent = statusText(j);
      st.title = st.textContent;
    }
    updateCounts();
  }

  function updateCounts() {
    const active = [...S.jobs.values()].filter(j => ['running', 'queued', 'paused'].includes(j.status)).length;
    $('#railCount').textContent = active ? `${active} ${active === 1 ? 'ativo' : 'ativos'}` : 'Nenhum ativo';
    $('#navBadge').textContent = active;
    $('#navBadge').hidden = !active;
  }

  function onJobClick(e) {
    const card = e.target.closest('.dl');
    if (!card) return;
    const job = S.jobs.get(card.dataset.id);
    if (!job) return;
    const b = e.target.closest('[data-a]');
    if (b) { e.stopPropagation(); jobAction(job, b.dataset.a); return; }
    S.focusId = job.id;
    showView('new');
    go(3);
    renderJobs();
  }
  $('#railList').addEventListener('click', onJobClick);
  $('#dlGrid').addEventListener('click', onJobClick);
  $$('#railTabs button').forEach(b => b.addEventListener('click', () => {
    S.railFilter = b.dataset.rt;
    $$('#railTabs button').forEach(x => x.classList.toggle('on', x === b));
    renderJobs();
  }));
  $('#clearDone').addEventListener('click', () => api.downloads.clearFinished());

  api.downloads.onUpdate(job => {
    const prev = S.jobs.get(job.id);
    upsertJob(job);
    if (!prev || prev.status !== job.status) {
      renderJobs();
      if (prev && prev.status !== 'done' && job.status === 'done' && job.id !== S.focusId) {
        toast('Download concluído: ' + job.title, { action: 'Mostrar', onAction: () => jobAction(job, 'reveal') });
      }
      if (prev && job.status === 'error' && job.id !== S.focusId) toast('Um download falhou: ' + job.title, { error: true });
      if (job.status === 'done') refreshDisk();
    } else {
      patchJob(job);
    }
    if (job.id === S.focusId) renderFocus();
  });
  api.downloads.onRemoved(id => {
    S.jobs.delete(id);
    renderJobs();
    if (id === S.focusId && S.step === 3) { S.focusId = null; go(1); toast('Download cancelado'); }
  });
  api.downloads.onAggregate(agg => { $('#totalSpeed').textContent = num((agg.speed || 0) / 1048576, 1) + ' MB/s'; });

  // ---------------------------------------------------------------------------
  // History

  function renderHistory() {
    const q = $('#histSearch').value.trim().toLowerCase();
    const list = S.history.filter(h => !q || (h.title || '').toLowerCase().includes(q) || (h.site || '').toLowerCase().includes(q));
    $('#histClear').hidden = !S.history.length;
    if (!list.length) {
      $('#histList').innerHTML = `<div class="empty">${I.inbox}<span>${q ? 'Nada encontrado para essa busca.' : 'Os vídeos que você baixar aparecem aqui.'}</span></div>`;
      return;
    }
    const dayOf = ts => {
      const d = new Date(ts);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const diff = Math.round((today - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
      if (diff === 0) return 'Hoje';
      if (diff === 1) return 'Ontem';
      return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: diff > 300 ? 'numeric' : undefined });
    };
    let lastDay = '';
    const b = (a, icon, label) => `<button class="ib" type="button" data-a="${a}" aria-label="${label}" title="${label}">${icon}</button>`;
    $('#histList').innerHTML = list.map(h => {
      const day = dayOf(h.finishedAt);
      const head = day !== lastDay ? `<div class="hday">${day}</div>` : '';
      lastDay = day;
      const meta = [h.qualityLabel, h.format, h.isPlaylist ? h.itemCount + ' vídeos' : null, h.chapterCount ? h.chapterCount + ' capítulos' : null, h.size ? fmtSize(h.size) : null, h.site,
        new Date(h.finishedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })].filter(Boolean);
      return head + `<div class="hrow" data-id="${h.id}">
        ${thumbHTML(h.thumbnail, h.id)}
        <div style="min-width:0;display:grid;gap:3px"><div class="t" title="${esc(h.title)}">${esc(h.title)}</div><div class="m">${meta.map(x => `<span>${esc(x)}</span>`).join('')}</div></div>
        <div class="acts">${!h.isPlaylist && h.files && h.files[0] ? b('play', I.file, 'Abrir arquivo') : ''}${b('reveal', I.folder, 'Mostrar na pasta')}${b('again', I.link, 'Baixar de novo')}${b('remove', I.x, 'Remover do histórico')}</div>
      </div>`;
    }).join('');
  }
  $('#histSearch').addEventListener('input', renderHistory);
  $('#histList').addEventListener('click', async e => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const h = S.history.find(x => x.id === b.closest('.hrow').dataset.id);
    if (!h) return;
    const a = b.dataset.a;
    if (a === 'play') { const r = await api.openPath(h.files[0]); if (!r.ok) toast(r.error, { error: true }); }
    if (a === 'reveal') { const r = h.files && h.files[0] ? await api.reveal(h.files[0]) : await api.openPath(h.dir); if (!r.ok) toast(r.error, { error: true }); }
    if (a === 'again') { showView('new'); go(1); url.value = h.url; analyze(h.url); }
    if (a === 'remove') { await api.history.remove(h.id); S.history = S.history.filter(x => x.id !== h.id); renderHistory(); }
  });
  $('#histClear').addEventListener('click', () => { $('#histConfirm').hidden = false; });
  $('#histClearNo').addEventListener('click', () => { $('#histConfirm').hidden = true; });
  $('#histClearYes').addEventListener('click', async () => {
    await api.history.clear();
    S.history = [];
    $('#histConfirm').hidden = true;
    renderHistory();
    toast('Histórico apagado');
  });
  api.history.onAdded(entry => { S.history.unshift(entry); if (S.view === 'history') renderHistory(); });

  // ---------------------------------------------------------------------------
  // Supported sites

  async function renderSites() {
    const q = $('#siteSearch').value.trim().toLowerCase();
    const pop = S.popular.filter(p => !q || p.name.toLowerCase().includes(q) || p.domains.some(d => d.includes(q)));
    $('#popGrid').innerHTML = pop.length ? pop.map(p => `<button type="button" class="site" data-d="${esc(p.domains[0])}" title="Abrir ${esc(p.domains[0])} no navegador">
        <i class="mk" style="--h:${hueOf(p.name)}">${esc(p.name[0])}</i><span><b>${esc(p.name)}</b><small>${esc(p.kinds)}</small></span></button>`).join('')
      : '<p class="fine">Nenhum site popular com esse nome.</p>';

    if (!S.sites) {
      $('#allSites').innerHTML = '<div>Carregando lista…</div>';
      S.sites = await api.sites();
    }
    const names = S.sites.extractors || [];
    const groups = new Map();
    for (const n of names) {
      const base = n.split(':')[0];
      const k = base.toLowerCase();
      if (!groups.has(k)) groups.set(k, base);
    }
    const bases = [...groups.values()].filter(b => !/^generic$/i.test(b)).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
    $('#sitesSub').textContent = `O Vela usa o yt-dlp ${S.sites.version || ''}, que reconhece vídeos em ${bases.length.toLocaleString('pt-BR')} sites.`;
    const filtered = q ? bases.filter(b => b.toLowerCase().includes(q)) : bases;
    const LIMIT = 600;
    $('#allCount').textContent = q ? `${filtered.length.toLocaleString('pt-BR')} encontrados` : `${bases.length.toLocaleString('pt-BR')} sites`;
    const mark = s => q ? esc(s).replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>') : esc(s);
    $('#allSites').innerHTML = filtered.length
      ? filtered.slice(0, LIMIT).map(b => `<div title="${esc(b)}">${mark(b)}</div>`).join('') + (filtered.length > LIMIT ? `<div>… e mais ${(filtered.length - LIMIT).toLocaleString('pt-BR')}. Use a busca.</div>` : '')
      : '<div>Nenhum site encontrado. Links de outros sites ainda podem funcionar: cole e experimente.</div>';
  }
  let siteT;
  $('#siteSearch').addEventListener('input', () => { clearTimeout(siteT); siteT = setTimeout(renderSites, 120); });
  $('#popGrid').addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (b) api.openExternal('https://' + b.dataset.d); });

  // ---------------------------------------------------------------------------
  // Settings

  async function saveSettings(patch) {
    S.settings = await api.settings.set(patch);
    return S.settings;
  }

  function setSeg(seg, value) {
    $$('button', seg).forEach(b => b.classList.toggle('on', b.dataset.v === String(value)));
    requestAnimationFrame(() => syncSeg(seg));
  }

  function renderSettings() {
    const s = S.settings;
    $('#setDir').textContent = s.downloadDir;
    setSeg($('#setConc'), s.maxConcurrent);
    setSeg($('#setTheme'), s.theme);
    $$('[data-set]').forEach(r => r.classList.toggle('on', !!s[r.dataset.set]));
    setSeg($('#setAuthSource'), s.authSource);
    $('#authVela').hidden = s.authSource === 'browser';
    $('#authBrowser').hidden = s.authSource !== 'browser';
    renderAccounts();
    $('#setCookies').innerHTML = BROWSERS.map(b => `<button type="button" class="chip ${b.v === (s.cookiesBrowser || '') ? 'on' : ''}" data-v="${b.v}">${b.v === (s.cookiesBrowser || '') ? I.check : ''}${b.label}</button>`).join('');
    $('#setEngineVer').textContent = S.engineVersion || 'não instalado';
    $('#setFfmpeg').textContent = S.ffmpeg ? 'Instalado. Junta vídeo e áudio e converte para MP3.' : 'Não encontrado. Vídeos em alta resolução podem vir sem áudio. Reinstale o Vela.';
  }
  $('#setDirChange').addEventListener('click', async () => {
    const p = await api.chooseFolder();
    if (!p) return;
    await saveSettings({ downloadDir: p });
    renderSettings(); renderDest(); refreshDisk();
    toast('Pasta padrão alterada');
  });
  $('#setDirOpen').addEventListener('click', async () => { const r = await api.openPath(S.settings.downloadDir); if (!r.ok) toast(r.error, { error: true }); });
  $$('#setConc button').forEach(b => b.addEventListener('click', async () => { await saveSettings({ maxConcurrent: +b.dataset.v }); renderSettings(); }));
  $$('#setTheme button').forEach(b => b.addEventListener('click', async () => { await saveSettings({ theme: b.dataset.v }); renderSettings(); }));
  $$('[data-set]').forEach(r => r.addEventListener('click', async () => { const k = r.dataset.set; await saveSettings({ [k]: !S.settings[k] }); renderSettings(); }));
  $('#setCookies').addEventListener('click', async e => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    await saveSettings({ cookiesBrowser: b.dataset.v });
    renderSettings();
    toast(`O Vela vai usar o login do ${b.textContent.trim()}`);
  });

  function renderAccounts() {
    const st = S.auth || { sites: [] };
    $('#acctList').innerHTML = st.sites.map(a => `<div class="set-row acct">
        <i class="mk" style="--h:${hueOf(a.name)}">${esc(a.name[0])}</i>
        <div class="set-txt"><b>${esc(a.name)}</b><small class="acct-state ${a.connected ? 'ok-note' : ''}">${a.connected ? '<span class="dot"></span>Conectado. Os downloads deste site usam a sua conta.' : 'Não conectado'}</small></div>
        <div class="set-ctl">${a.connected
          ? `<button class="btn btn-ghost btn-sm" type="button" data-logout="${a.id}">Sair</button>`
          : `<button class="btn btn-ghost btn-sm" type="button" data-login="${a.id}">Entrar</button>`}</div>
      </div>`).join('');
    const info = $('#authFileInfo');
    info.hidden = !st.hasFile;
    if (st.hasFile) {
      const when = st.updatedAt ? new Date(st.updatedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      info.textContent = `Arquivo de login ativo${when ? ', atualizado em ' + when : ''}.`;
    }
    $('#authClear').hidden = !st.hasFile;
  }
  $$('#setAuthSource button').forEach(b => b.addEventListener('click', async () => {
    const v = b.dataset.v;
    await saveSettings(v === 'browser' && !S.settings.cookiesBrowser ? { authSource: v, cookiesBrowser: 'firefox' } : { authSource: v });
    renderSettings();
  }));
  $('#acctList').addEventListener('click', async e => {
    const login = e.target.closest('[data-login]');
    if (login) { await signIn(login.dataset.login); renderSettings(); return; }
    const out = e.target.closest('[data-logout]');
    if (out) {
      S.auth = await api.auth.logout(out.dataset.logout);
      renderSettings();
      toast(`Você saiu do ${siteName(out.dataset.logout)} no Vela`);
    }
  });
  $('#authImport').addEventListener('click', async () => {
    const r = await api.auth.importFile();
    if (r.canceled) return;
    if (!r.ok) { toast(r.error, { error: true, duration: 7000 }); return; }
    S.auth = r.status;
    S.settings = await api.settings.set({});
    renderSettings();
    toast(r.sites.length ? `Login importado: ${r.sites.join(', ')}` : 'Arquivo importado. Ele será usado nos próximos downloads.');
  });
  // Two clicks to erase: the first one asks for confirmation in place
  let clearArmed = null;
  $('#authClear').addEventListener('click', async () => {
    const btn = $('#authClear');
    if (!clearArmed) {
      btn.textContent = 'Confirmar: apagar todos';
      btn.classList.add('btn-danger');
      clearArmed = setTimeout(() => { clearArmed = null; btn.textContent = 'Apagar logins'; btn.classList.remove('btn-danger'); }, 4000);
      return;
    }
    clearTimeout(clearArmed);
    clearArmed = null;
    btn.textContent = 'Apagar logins';
    btn.classList.remove('btn-danger');
    S.auth = await api.auth.clear();
    renderSettings();
    toast('Todos os logins foram apagados do Vela');
  });
  $('#setUpdate').addEventListener('click', async () => {
    const btn = $('#setUpdate');
    btn.disabled = true;
    btn.innerHTML = '<span class="spin" style="width:13px;height:13px"></span>Verificando';
    const r = await api.engine.update();
    btn.disabled = false;
    btn.textContent = 'Verificar atualização';
    if (!r.ok) { toast(r.error, { error: true }); return; }
    toast(r.data.message);
    S.engineVersion = await api.engine.version();
    S.sites = null;
    renderEngine();
    renderSettings();
  });
  $$('[data-ext]').forEach(b => b.addEventListener('click', () => api.openExternal(b.dataset.ext)));

  // Theme changes from the OS or from settings re-measure segmented controls
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncSegs);

  // ---------------------------------------------------------------------------
  // Sidebar footer: disk and engine

  async function refreshDisk() {
    const dir = S.settings.downloadDir;
    const d = await api.freeSpace(dir);
    const drive = /^([A-Za-z]):/.exec(dir || '');
    $('#diskLbl').textContent = drive ? `Disco ${drive[1].toUpperCase()}:` : 'Disco';
    if (!d) { $('#diskFree').textContent = '–'; return; }
    $('#diskFree').textContent = fmtSize(d.free).replace(',0', '') + ' livres';
    $('#diskBar').style.width = Math.round((1 - d.free / d.total) * 100) + '%';
  }

  function renderEngine(state) {
    const dot = $('#engineDot');
    dot.className = 'dot' + (state === 'wait' ? ' wait' : state === 'bad' ? ' bad' : '');
    $('#engineLbl').textContent = state === 'wait' ? 'Preparando motor…' : state === 'bad' ? 'Motor indisponível' : `Motor yt-dlp ${S.engineVersion || ''}`.trim();
  }

  // First run: download yt-dlp with a friendly progress screen
  async function ensureEngine() {
    const overlay = $('#setup');
    overlay.hidden = false;
    $('#setupRetry').hidden = true;
    $('#setupTxt').textContent = 'Baixando o motor de download (yt-dlp). Isso acontece só na primeira vez.';
    renderEngine('wait');
    const off = api.engine.onProgress(({ received, total }) => {
      if (total) $('#setupBar').style.width = Math.round(received / total * 100) + '%';
      $('#setupMeta').textContent = total ? `${fmtSize(received)} de ${fmtSize(total)}` : fmtSize(received);
    });
    const r = await api.engine.ensure();
    off();
    if (!r.ok) {
      $('#setupTxt').textContent = r.error;
      $('#setupMeta').textContent = 'Verifique sua conexão com a internet.';
      $('#setupRetry').hidden = false;
      renderEngine('bad');
      return;
    }
    S.engineVersion = r.data;
    renderEngine();
    $('#setupBar').style.width = '100%';
    setTimeout(() => { overlay.hidden = true; $('#url').focus(); }, 350);
  }
  $('#setupRetry').addEventListener('click', ensureEngine);

  // ---------------------------------------------------------------------------
  // Boot

  (async function boot() {
    const b = await api.bootstrap();
    S.settings = b.settings;
    S.folders = b.folders;
    S.popular = b.popular;
    S.history = b.history || [];
    S.ffmpeg = b.ffmpeg;
    S.auth = await api.auth.status();
    $('#appVer').textContent = 'v' + b.appVersion;
    for (const j of b.jobs) upsertJob(j);
    renderDest();
    renderJobs();
    refreshDisk();
    go(1);
    if (b.engineInstalled) {
      renderEngine('wait');
      S.engineVersion = await api.engine.version();
      renderEngine(S.engineVersion ? undefined : 'bad');
    } else {
      ensureEngine();
    }
  })();
})();
