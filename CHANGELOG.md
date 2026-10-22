# Changelog

As mudanças de cada versão do Vela Downloader. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), e as versões seguem o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.0.0] - 2026-10-22

Primeira versão pública.

### Download

- Fluxo em três passos: colar o link, escolher a qualidade, baixar.
- Detecção de links copiados de 28 sites populares, com atalho para baixar.
- Suporte a todos os sites do yt-dlp: mais de 1.200, entre eles YouTube, TikTok, Instagram, X, Facebook, Vimeo, Twitch e SoundCloud.
- Resoluções reais de cada vídeo, de 144p a 8K, com o tamanho estimado antes de baixar.
- Vídeo em MP4 (preferindo H.264, que toca em qualquer player), WebM ou MKV. Áudio em MP3, M4A ou OPUS, de 128 a 320 kbps.
- Playlists com seleção dos vídeos, salvos numa pasta numerada.
- Opção de dividir por capítulos (`--split-chapters`), com escolha de manter também o arquivo completo.
- Legendas em português incorporadas e miniatura opcional.

### Fila e progresso

- De 1 a 4 downloads ao mesmo tempo, com pausar, continuar e cancelar.
- Porcentagem, velocidade, tempo restante e etapa de cada download, também na barra de tarefas.
- Notificação do Windows ao concluir e histórico com busca.

### Login para vídeos com restrição

- Login no YouTube, Instagram, X, Facebook e TikTok pelo Chrome, Edge ou Brave instalado, num perfil separado só para o Vela.
- Importação de `cookies.txt` e uso do login de um navegador instalado.
- Botão "Entrar com o YouTube" ao lado dos erros que exigem login.

### Aplicativo

- Pasta Vídeos do Windows como destino padrão, com opção de trocar.
- Tema claro e escuro, seguindo o Windows por padrão.
- Motor yt-dlp baixado na primeira execução e atualizável em Configurações.

### Observações

- O instalador ainda não tem assinatura digital. Na primeira instalação, o Windows SmartScreen pode mostrar "O Windows protegeu o computador". Para continuar, clique em **Mais informações** e depois em **Executar assim mesmo**.

[1.0.0]: https://github.com/luizolliver/youtube-dl/releases/tag/v1.0.0
