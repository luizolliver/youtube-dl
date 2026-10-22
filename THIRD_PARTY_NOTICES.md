# Componentes de terceiros

O código do Vela Downloader está sob a licença MIT (veja [LICENSE](LICENSE)). O instalador também distribui os componentes abaixo, cada um sob a sua própria licença.

## yt-dlp

- Uso: motor de download. É baixado do GitHub na primeira execução ou incluído no instalador por `npm run dist`.
- Licença: [The Unlicense](https://github.com/yt-dlp/yt-dlp/blob/master/LICENSE) (domínio público).
- Código-fonte: https://github.com/yt-dlp/yt-dlp

## FFmpeg

- Uso: junta as faixas de vídeo e áudio, converte para MP3/M4A/OPUS e divide os vídeos por capítulos. O Vela executa o FFmpeg como um programa separado; ele não é compilado junto com o código do Vela.
- Versão: FFmpeg 6.1.1, binário estático distribuído pelo pacote [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static) 5.3.0 ([release b6.1.1](https://github.com/eugeneware/ffmpeg-static/releases/tag/b6.1.1)). A build para Windows x64 é de [gyan.dev](https://www.gyan.dev/ffmpeg/builds/).
- Licença: GNU General Public License v3. O texto completo e os detalhes da build vão junto com o instalador, nos arquivos `ffmpeg.LICENSE` e `ffmpeg.README` da pasta `resources\app.asar.unpacked\node_modules\ffmpeg-static`.
- Código-fonte: https://ffmpeg.org/releases/ffmpeg-6.1.1.tar.xz. As configurações de compilação e as bibliotecas usadas estão em https://www.gyan.dev/ffmpeg/builds/.

## Electron e Chromium

- Uso: base do aplicativo.
- Licença: MIT (Electron) e as licenças dos componentes do Chromium. Os textos ficam na pasta de instalação, nos arquivos `LICENSE.electron.txt` e `LICENSES.chromium.html`.
- Código-fonte: https://github.com/electron/electron

## Fonte Geist e Geist Mono

- Uso: tipografia da interface.
- Licença: SIL Open Font License 1.1 ([texto](src/renderer/fonts/OFL-Geist.txt)).
- Origem: https://github.com/vercel/geist-font
