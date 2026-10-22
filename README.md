# Vela

Aplicativo para Windows que baixa vídeos e playlists do YouTube e de mais de mil outros sites, com a resolução e o formato que você escolher. O Vela é feito em Electron e usa o [yt-dlp](https://github.com/yt-dlp/yt-dlp) como motor de download e o FFmpeg para juntar vídeo e áudio e converter para MP3.

## O que ele faz

- **Três passos claros:** colar o link, escolher a qualidade, baixar.
- **Detecta links copiados:** ao copiar um link de um site conhecido, o Vela mostra um atalho para usá-lo. Você pode desligar isso em Configurações.
- **Qualidade antes de baixar:** o app lista as resoluções que o vídeo realmente tem, de 144p até 8K, com o tamanho estimado de cada uma. Os formatos de vídeo são MP4, WebM e MKV; os de áudio são MP3, M4A e OPUS, de 128 a 320 kbps.
- **Playlists:** marque só os vídeos que quiser. Eles são salvos numa pasta com o nome da playlist, numerados na ordem.
- **Dividir por capítulos:** em vídeos com capítulos, um toggle cria um arquivo por capítulo (`--split-chapters`), numa pasta com o nome do vídeo. Funciona em vídeo e em áudio, o que é útil para álbuns completos. Você escolhe se mantém também o arquivo completo.
- **Login para vídeos com restrição:** entre com sua conta do YouTube, Instagram, X, Facebook ou TikTok numa janela do próprio Vela.
- **Progresso em tempo real:** porcentagem, velocidade, tempo restante e etapa atual (vídeo, áudio, junção). O progresso também aparece no ícone da barra de tarefas.
- **Fila de downloads:** de 1 a 4 downloads ao mesmo tempo, com botões de pausar, continuar e cancelar. Ao cancelar, os arquivos parciais são apagados.
- **Pasta de destino:** o padrão é a pasta **Vídeos** do Windows. Você pode trocar a qualquer momento pelo seletor de pastas do Windows.
- **Histórico** com busca e botões de abrir arquivo, mostrar na pasta e baixar de novo.
- **Tema claro e escuro**, que segue o Windows por padrão.
- **Notificação do Windows** quando um download termina com o app em segundo plano.

## Sites suportados

O Vela aceita qualquer site que o yt-dlp suporta. A versão 2026.08.19 do yt-dlp tem cerca de 1.600 extratores, que cobrem mais de 1.200 sites. Entre os mais usados estão:

YouTube (vídeos, Shorts, playlists e canais), YouTube Music, TikTok, Instagram, X/Twitter, Facebook, Vimeo, Twitch, Kick, Reddit, Dailymotion, SoundCloud, Bandcamp, Mixcloud, Bilibili, Niconico, Rumble, Bluesky, Threads, LinkedIn, Pinterest, Streamable, Loom, TED, Globo, Archive.org e VK.

A lista completa, com busca, fica na tela **Sites suportados** do app. Ela é gerada pelo próprio motor instalado (`yt-dlp --list-extractors`), então se atualiza quando o motor é atualizado. Links de sites fora da lista também podem funcionar, porque o yt-dlp tenta encontrar o vídeo na página.

## Como rodar em desenvolvimento

Requisitos: Windows 10 ou 11 e [Node.js](https://nodejs.org) 20 ou mais recente.

```bash
npm install
npm start
```

Na primeira vez que o app abre, ele baixa o `yt-dlp.exe` mais recente do GitHub para `%APPDATA%\Vela\bin`. O FFmpeg vem do pacote `ffmpeg-static`, instalado pelo `npm install`.

Em modo de desenvolvimento, o Vela cria no Menu Iniciar o atalho **Vela (desenvolvimento)**. O Windows usa esse atalho para mostrar o nome e o ícone do Vela nas notificações e para reabrir o app ao clicar nelas. Na versão instalada, o próprio instalador cria o atalho.

## Como gerar o instalador

Rode no próprio Windows, porque o `ffmpeg-static` instala o FFmpeg da plataforma em que o `npm install` foi executado:

```bash
npm install
npm run dist
```

O comando baixa o `yt-dlp.exe` para `resources/bin`, que vai embutido no instalador, e gera `dist/Vela-Setup-<versão>.exe` com o electron-builder (NSIS).

## Decisões técnicas

- **Runtime JavaScript para o YouTube:** o yt-dlp precisa de um runtime JavaScript para ler os formatos do YouTube. Em vez de pedir que o usuário instale o Deno, o Vela passa o próprio executável com `ELECTRON_RUN_AS_NODE=1` (`--js-runtimes node:<Vela.exe>`).
- **Compatibilidade do MP4:** quando o formato é MP4, o Vela prefere H.264 com áudio AAC (`-S res:<altura>,vcodec:h264,ext:mp4:m4a`), que tocam em qualquer player do Windows. Acima de 1080p, o YouTube só oferece VP9 e AV1, e o Vela usa esses codecs.
- **Motor atualizável:** o yt-dlp fica na pasta de dados do usuário, e o botão "Verificar atualização" em Configurações roda `yt-dlp -U`. Atualize o motor quando um site parar de funcionar.
- **Mensagens de erro em português:** os erros do yt-dlp são traduzidos em mensagens que dizem o que fazer. Por exemplo, "confirme que não é um robô" leva à opção de usar o login do navegador.

## Vídeos que exigem login

Vídeos privados, com restrição de idade ou exclusivos para membros exigem login. O YouTube também pode pedir a confirmação "não sou um robô". Nesses casos, o Vela mostra o botão **Entrar com o YouTube** ao lado do erro. Ele também fica em **Configurações → Login para vídeos com restrição**.

- **Contas no Vela (padrão):** ao clicar em **Entrar**, o Vela abre o Google Chrome, o Microsoft Edge ou o Brave instalado no PC (nessa ordem de preferência), num perfil separado que só o Vela usa. Você faz login normalmente, e o Google aceita porque é um navegador de verdade. O Vela lê os cookies do site pelo protocolo DevTools do próprio navegador, salva em `%APPDATA%\Vela\cookies.txt` e fecha a janela sozinho. O yt-dlp lê esse arquivo com `--cookies`. Como é o próprio navegador que entrega os cookies, a criptografia de cookies do Chrome no Windows não atrapalha. Sem nenhum desses navegadores, o login abre numa janela do Vela, o que funciona na maioria dos sites, mas o Google costuma recusar.
- **Importar cookies.txt:** se o Google recusar o login dentro do app, exporte os cookies no seu navegador com uma extensão como "Get cookies.txt LOCALLY" e importe o arquivo. Os logins importados se juntam aos que já existem.
- **Navegador instalado:** o yt-dlp lê o login direto do navegador (`--cookies-from-browser`). No Windows, o Firefox é o mais confiável. As versões recentes do Chrome e do Edge protegem os cookies e geralmente não funcionam.

## Estrutura

```
src/main/main.js        janela, IPC, área de transferência, notificações
src/main/ytdlp.js       instalação do motor, leitura de metadados, downloads e progresso
src/main/downloads.js   fila com pausar, continuar e cancelar
src/main/settings.js    configurações e histórico (JSON em %APPDATA%\Vela)
src/main/auth.js        logins por site e o cookies.txt usado pelo yt-dlp
src/main/browser-login.js  abre o Chrome/Edge com o perfil do Vela e lê os cookies via DevTools
src/main/sites.js       sites populares e detecção de links
src/preload/preload.js  ponte segura entre a interface e o processo principal
src/renderer/           interface (HTML, CSS e JS, sem framework)
mockup/index.html       mockup aprovado que serviu de base para a interface
scripts/fetch-binaries.js  baixa o yt-dlp para o instalador
```

## Aviso

Baixe apenas conteúdo que você tem direito de salvar e respeite os termos de uso de cada site.

## Licenças de terceiros

- yt-dlp: Unlicense
- FFmpeg (via ffmpeg-static): GPL
- Fonte Geist: SIL Open Font License 1.1 (`src/renderer/fonts/OFL-Geist.txt`)
