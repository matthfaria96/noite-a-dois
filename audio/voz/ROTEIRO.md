# Roteiro da narradora (gerado no VoiceStudio)

Voz feminina sussurrada e sedutora, clonada de um trecho de sussurro ASMR. Falas curtas e genéricas, que servem para qualquer carta:
a narradora sugere, não explica. Nada de nomes nem de texto de carta (isso fica na tela).

Todas as falas saem da mesma referência, com os mesmos ajustes (32 passos, velocidade 0,95, sussurro), e depois recebem
o mesmo tratamento: estalos corrigidos, chiado e estouros domados, entrada e saída suaves, −19 LUFS e pico de −3 dB,
em MP3 mono 192 kbps. Se precisar gerar uma fala nova, mantenha esses ajustes para o timbre e o volume continuarem iguais.

Cada momento do jogo tem várias variações (`<momento>-<n>`). O jogo sorteia sem repetir até todas saírem, e o sorteio
continua de uma partida para a outra. As falas opcionais (vez, dado, reações) tocam só às vezes, com intervalo, para soarem espontâneas.
Reações a cartas cumpridas: `suave-*` no Aquecimento e na Provocação, `quente-*` no Fogo e no Clímax.

Cada fala é `audio/voz/<arquivo>.mp3` e precisa estar na lista `"voz"` de `audio/lista.json`.
Os textos ficam em `FALAS`, em `js/voice.js`. Para variar mais, basta gravar `<momento>-<próximo n>`: o jogo já inclui.

| arquivo | fala |
|---|---|
| inicio-1 | Vamos começar… meus amores? |
| inicio-2 | Prontos?… Então vem. |
| inicio-3 | Hoje a noite é de vocês… |
| vez-1 | Sua vez… |
| vez-2 | Agora é com você. |
| vez-3 | Joga pra mim… |
| vez-4 | Vem… sua vez. |
| vez-5 | Sua vez, amor… |
| vez-6 | E agora… você. |
| vez-7 | Sua vez… capricha. |
| fase1-1 | Aquecimento… |
| fase1-2 | Devagar… aquecimento. |
| fase2-1 | Provocação… |
| fase2-2 | Agora… provocação. |
| fase3-1 | Fogo… |
| fase3-2 | Tá esquentando… fogo. |
| fase4-1 | Clímax… |
| fase4-2 | Chegou a hora… clímax. |
| verdade-1 | Verdade… |
| verdade-2 | Hora da verdade… |
| verdade-3 | Sem mentir pra mim… |
| desafio-1 | Desafio… |
| desafio-2 | Um desafio… |
| desafio-3 | Quero ver você fazer… |
| pena-1 | Pena… |
| pena-2 | Com a pena… |
| pena-3 | Suavinho… |
| armadilha-1 | Ops… armadilha. |
| armadilha-2 | Opa… caiu. |
| armadilha-3 | Cuidado… |
| sorte-1 | Que sorte… |
| sorte-2 | Hoje é seu dia… |
| sorte-3 | A sorte gosta de você… |
| recusou-1 | Hoje não?… Duas casas pra trás. |
| recusou-2 | Fugiu?… Volta duas. |
| recusou-3 | Tudo bem… mas tem um preço. |
| passe-1 | Passe livre… dessa vez passa. |
| tempo-1 | Valendo… |
| tempo-2 | Começou… |
| fimtempo-1 | Tempo! |
| fimtempo-2 | Acabou o tempo… |
| dadoalto-1 | Uau! |
| dadoalto-2 | Olha só… |
| dadoalto-3 | Isso! |
| dadobaixo-1 | Devagarinho… |
| dadobaixo-2 | Sem pressa… |
| quase-1 | Tá quase lá… |
| quase-2 | Falta pouco… |
| suave-1 | Que fofos… |
| suave-2 | Hmm… |
| suave-3 | Que lindo… |
| suave-4 | Eu amo! |
| suave-5 | Gostei… |
| quente-1 | Ai… que delícia… |
| quente-2 | Hmm… que gostosinho… |
| quente-3 | Hmm… assim eu gosto. |
| quente-4 | Isso… continua assim. |
| quente-5 | Não para… |
| quente-6 | Que calor… |
| pico-1 | O Pico do Amor… |
| desejo-1 | Escolha seu desejo… |
| desejo-2 | Agora… escolhe com vontade. |
| vencedor-1 | Ebaa! Temos um vencedor! |
| vencedora-1 | Ebaa! Temos uma vencedora! |

## Música
Para trocar a música gerada pelo jogo por uma faixa sua, coloque o arquivo `audio/musica.mp3` e mude `"musica"` para `true` em `audio/lista.json`. Ele toca em loop no lugar da trilha gerada.
