# Roteiro da narradora (gravado no VoiceStudio)

Voz feminina sussurrada e sedutora, clonada de um trecho de ASMR. Ritmo lento, com respiros nas reticências.
As falas `reacao-*` são reações espontâneas: tocam em cerca de 40% das cartas cumpridas (e às vezes num dado 5 ou 6), sem repetir a anterior.
A narradora **só usa estas falas gravadas**: não há voz do aparelho. O que não está gravado (nomes, texto das cartas e desejos) fica só na tela.

Cada fala é `audio/voz/<arquivo>.mp3` e precisa estar na lista `"voz"` de `audio/lista.json`.
Os textos ficam em `FALAS`, em `js/voice.js`. Ao mudar uma fala, mude nos dois lugares e grave de novo.

| arquivo | fala |
|---|---|
| inicio | Vamos começar… meus amores? |
| boas-vindas | Bem-vindos à Noite a Dois. Respirem fundo… a subida até o Pico do Amor começa agora. |
| comeca | Você começa… sem pressa. |
| vez-1 | Sua vez… |
| vez-2 | Agora é com você. |
| vez-3 | Pode rolar o dado… devagar. |
| vez-4 | É a sua vez… vem. |
| fase-1 | Aquecimento. Olhares, segredos… e toques leves. |
| fase-2 | Provocação. Agora os beijos ficam mais demorados. |
| fase-3 | Fogo. Pele com pele… sem pressa nenhuma. |
| fase-4 | Clímax. O pico está logo ali. Sem freios. |
| verdade | Hora da verdade… |
| desafio | Um desafio… pra você. |
| pena | Uma pena… faça com carinho. |
| armadilha | Cuidado… uma armadilha. |
| sorte | A sorte sorriu pra você. |
| pico | Vocês alcançaram o Pico do Amor. |
| desejo | Agora escolha o seu desejo… com carinho. |
| recusou | Hoje não? Tudo bem… mas você volta duas casas. |
| vencedor | Ebaa! Temos um vencedor! |
| vencedora | Ebaa! Temos uma vencedora! |
| reacao-uau | Uau! |
| reacao-gostosinho | Hmm… que gostosinho… |
| reacao-delicia | Ai… que delícia… |
| reacao-eu-amo | Eu amo! |
| reacao-olha-so | Olha só… |
| reacao-assim-gosto | Hmm… assim eu gosto. |
| reacao-continua | Isso… continua assim. |

## Música
Para trocar a música gerada pelo jogo por uma faixa sua, coloque o arquivo `audio/musica.mp3` e mude `"musica"` para `true` em `audio/lista.json`. Ele toca em loop no lugar da trilha gerada.
