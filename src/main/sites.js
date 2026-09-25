'use strict';

// Sites that people use most. yt-dlp supports far more (see extractors.json);
// this list powers clipboard detection and the "Populares" section.
const POPULAR = [
  { name: 'YouTube', domains: ['youtube.com', 'youtu.be', 'youtube-nocookie.com'], kinds: 'Vídeos, Shorts, playlists e canais' },
  { name: 'YouTube Music', domains: ['music.youtube.com'], kinds: 'Músicas, álbuns e playlists' },
  { name: 'TikTok', domains: ['tiktok.com', 'vm.tiktok.com'], kinds: 'Vídeos e perfis' },
  { name: 'Instagram', domains: ['instagram.com'], kinds: 'Reels, posts e stories' },
  { name: 'X (Twitter)', domains: ['x.com', 'twitter.com'], kinds: 'Vídeos de posts' },
  { name: 'Facebook', domains: ['facebook.com', 'fb.watch'], kinds: 'Vídeos e Reels' },
  { name: 'Vimeo', domains: ['vimeo.com'], kinds: 'Vídeos, canais e álbuns' },
  { name: 'Twitch', domains: ['twitch.tv'], kinds: 'VODs e clipes' },
  { name: 'Kick', domains: ['kick.com'], kinds: 'VODs e clipes' },
  { name: 'Reddit', domains: ['reddit.com', 'redd.it'], kinds: 'Vídeos de posts' },
  { name: 'Dailymotion', domains: ['dailymotion.com', 'dai.ly'], kinds: 'Vídeos e playlists' },
  { name: 'SoundCloud', domains: ['soundcloud.com'], kinds: 'Faixas, álbuns e playlists' },
  { name: 'Bandcamp', domains: ['bandcamp.com'], kinds: 'Faixas e álbuns' },
  { name: 'Mixcloud', domains: ['mixcloud.com'], kinds: 'Mixes e playlists' },
  { name: 'Bilibili', domains: ['bilibili.com', 'b23.tv'], kinds: 'Vídeos e coleções' },
  { name: 'Niconico', domains: ['nicovideo.jp'], kinds: 'Vídeos e séries' },
  { name: 'Rumble', domains: ['rumble.com'], kinds: 'Vídeos' },
  { name: 'Bluesky', domains: ['bsky.app'], kinds: 'Vídeos de posts' },
  { name: 'Threads', domains: ['threads.net', 'threads.com'], kinds: 'Vídeos de posts' },
  { name: 'LinkedIn', domains: ['linkedin.com'], kinds: 'Vídeos de posts' },
  { name: 'Pinterest', domains: ['pinterest.com', 'pin.it'], kinds: 'Vídeos de pins' },
  { name: 'Streamable', domains: ['streamable.com'], kinds: 'Vídeos' },
  { name: 'Loom', domains: ['loom.com'], kinds: 'Gravações de tela' },
  { name: 'TED', domains: ['ted.com'], kinds: 'Palestras' },
  { name: 'Globoplay / g1', domains: ['globo.com', 'globoplay.globo.com'], kinds: 'Vídeos abertos' },
  { name: 'Archive.org', domains: ['archive.org'], kinds: 'Vídeos e áudios do acervo' },
  { name: '9GAG', domains: ['9gag.com'], kinds: 'Vídeos' },
  { name: 'VK', domains: ['vk.com', 'vkvideo.ru'], kinds: 'Vídeos' }
];

const URL_RE = /^https?:\/\/[^\s/$.?#][^\s]*$/i;

function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\.|^m\./, ''); } catch { return ''; }
}

function siteFor(url) {
  const host = hostOf(url);
  if (!host) return null;
  // Most specific domain wins (music.youtube.com before youtube.com)
  let best = null;
  let bestLen = 0;
  for (const site of POPULAR) {
    for (const d of site.domains) {
      if ((host === d || host.endsWith('.' + d)) && d.length > bestLen) { best = site; bestLen = d.length; }
    }
  }
  return best;
}

function isUrl(text) {
  return typeof text === 'string' && text.length < 2048 && URL_RE.test(text.trim());
}

module.exports = { POPULAR, siteFor, isUrl, hostOf };
