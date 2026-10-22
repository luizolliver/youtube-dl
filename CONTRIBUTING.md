# Como contribuir

Obrigado pelo interesse no Vela Downloader. Correções, melhorias e relatos de problemas são bem-vindos.

## Relatar um problema

Abra uma [issue](https://github.com/luizolliver/youtube-dl/issues/new/choose) com:

- a versão do Vela (em **Configurações → Sobre**) e a do motor yt-dlp;
- o link que falhou, se ele for público;
- a mensagem de erro que apareceu.

Antes, tente **Configurações → Motor de download → Verificar atualização**. Quando um site muda, a correção costuma chegar primeiro no yt-dlp.

Problemas de segurança não devem ir para as issues públicas. Veja o [SECURITY.md](SECURITY.md).

## Enviar uma alteração

1. Faça um fork e crie uma branch a partir da `main`.
2. Rode o app com `npm install` e `npm start`.
3. Antes de abrir o pull request, rode `npm run check` e teste no Windows o fluxo que você mudou.
4. Descreva no pull request o que mudou e por quê. Se a mudança for visível, inclua um print.

O código segue o estilo dos arquivos existentes: JavaScript sem framework na interface, comentários em inglês no código e textos da interface em português.

Ao contribuir, você concorda que sua contribuição será distribuída sob a [licença MIT](LICENSE) do projeto.
