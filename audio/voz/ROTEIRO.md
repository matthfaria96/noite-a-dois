# Roteiro da narradora (para gravar no VoiceStudio)

Voz feminina, doce, calma e um pouco sussurrada. Ritmo lento, com respiros nas reticências.
Exporte cada fala como **MP3** com o nome exato da coluna "arquivo" e coloque nesta pasta (`audio/voz/`).
Depois adicione o nome (sem `.mp3`) na lista `"voz"` de `audio/lista.json`, por exemplo: `{ "musica": false, "voz": ["boas-vindas", "fase-1"] }`.

Falas que não estão gravadas continuam sendo ditas pela voz do próprio aparelho.
As falas com o nome dos jogadores ("Sua vez, Bia") e o texto das cartas sempre usam a voz do aparelho, porque mudam a cada partida.

| arquivo | fala |
|---|---|
| boas-vindas | Bem-vindos à Noite a Dois. Respirem fundo… a subida até o Pico do Amor começa agora. |
| fase-1 | Aquecimento. Olhares, confissões… e toques leves. |
| fase-2 | Provocação. Agora os beijos ficam mais demorados. |
| fase-3 | Fogo. Pele com pele… sem pressa nenhuma. |
| fase-4 | Clímax. O pico está logo ali. Sem freios. |
| armadilha | Cuidado… uma armadilha. |
| sorte | A sorte sorriu pra você. |
| pico | Vocês alcançaram o Pico do Amor. |
| desejo | Agora escolha o seu desejo… com carinho. |
| recusou | Hoje não? Tudo bem… mas você volta duas casas. |

## Música
Para trocar a música gerada pelo jogo por uma faixa sua, coloque o arquivo `audio/musica.mp3` e mude `"musica"` para `true` em `audio/lista.json`. Ele toca em loop no lugar da trilha gerada.
