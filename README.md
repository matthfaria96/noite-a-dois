# Noite a Dois — jogo de tabuleiro 3D para casais

### ▶ Jogar agora: **https://matthfaria96.github.io/noite-a-dois/**

> +18 · funciona no celular e no computador · dá para instalar na tela inicial (Compartilhar → Adicionar à Tela de Início)

Web, responsivo (celular e computador), sem instalação. Junta **dado + tabuleiro + cartas**:
um mapa 3D de blocos que serpenteia entre ilhas flutuantes e sobe até o **Clímax**, com a câmera atrás da peça da vez.

## Direção visual: Liquid Glass sensual
O visual segue a linguagem de vidro da Apple (macOS/iOS) com uma paleta noturna e sensual.

- **Interface de vidro:** todos os painéis, cartas, botões e chips são **vidro fosco translúcido** (`backdrop-filter: blur + saturate`).
  Têm reflexo especular na borda superior, um contorno de luz em gradiente, cantos bem arredondados e sombras suaves.
  Os botões principais usam vidro com tinta vermelho-rosada e brilho pulsante.
- **Componentes no estilo iOS:** controle segmentado com "pílula" de vidro, campos de texto de vidro, avisos que descem do topo como notificações e animações com mola (`cubic-bezier(.2,.9,.25,1)`).
- **Tipografia:** fonte do sistema da Apple (SF Pro) nos iPhones e Macs, com *Inter* como reserva nos outros aparelhos.
  Para o toque sensual, *Playfair Display* itálico nos títulos e cartas e *Great Vibes* no "a Dois".
- **3D de vidro:** os degraus são **blocos de vidro fosco** tingidos pela cor da fase, com um **núcleo de luz** por dentro.
  As peças são de vidro safira (Ele) e rubi (Ela), com núcleo brilhante e aro de prata. As ilhas e as placas também são de vidro.
- **Atmosfera:** céu do azul-meia-noite ao vinho e à brasa, lua de sangue, velas tremulando, pétalas de rosa e brasas.
- **Dado:** cristal vermelho lapidado com números dourados.
- O botão de mapa alterna entre a câmera imersiva e a visão geral do caminho.

> Desempenho: vidro com refração (transmission) e desfoque de fundo pesam mais na placa de vídeo.
> Em celulares de 2020 para cá deve rodar bem. Se algum aparelho travar, o primeiro ajuste é trocar
> `transmission` dos degraus por transparência simples em `js/scene.js`.

## Montanha cósmica e dado em destaque
- **Tabuleiro:** é uma **montanha de rocha cristalina** com uma trilha em **espiral** que sobe em terraços até o **cume**, onde fica o Clímax com o coração pulsando.
  Cristais venenosos (magenta, violeta, carmim e verde-ácido) brotam dos penhascos. Velas acesas marcam a beira da trilha, e dois trilhos de luz guiam o caminho.
- **Céu:** uma nebulosa gerada em tempo real que gira devagar em redemoinho, com braços de galáxia, estrelas cintilando e a lua de sangue ao longe.
- **Dado:** ao rolar, o tabuleiro escurece e desfoca, e um **dado de cristal lapidado** (cantos facetados, números dourados aparecendo refratados por dentro) gira em câmera lenta no centro da tela.
  Ele desacelera, pousa no número com um brilho atravessando o cristal e um som de taça de cristal, e só então a peça anda.
- O tamanho da montanha se ajusta à duração escolhida (Rápida, Normal ou Longa).

## Instalar como app
- **iPhone (Safari):** abra o link, toque em **Compartilhar → Adicionar à Tela de Início**.
- **Android (Chrome):** abra o link, toque no menu **⋮ → Instalar app**.

O jogo abre em tela cheia com ícone próprio e funciona **offline** depois da primeira visita (`sw.js`).
Ao publicar mudanças, aumente `VERSAO` em `sw.js` para os aparelhos baixarem a versão nova.

## Gráficos: Alta / Leve
- **Alta:** degraus de vidro com refração, brilho (bloom) e sombras.
- **Leve:** vidro translúcido simples, sem bloom e sem sombras, e resolução menor. É bem mais leve para a placa de vídeo.
- O jogo mede o desempenho nos primeiros segundos da partida. Se o aparelho não aguentar o modo Alta, troca para o Leve sozinho e avisa.
  Dá para trocar manualmente no menu ☰ → **Gráficos**.

## Como rodar
Qualquer servidor estático serve. Localmente:

```bash
cd jogo-casal && python3 -m http.server 8080
```

Depois é só abrir `http://localhost:8080` (no celular, use o IP do computador na mesma rede).
Para publicar: suba a pasta inteira para Netlify, Vercel, GitHub Pages ou Cloudflare Pages.
Não precisa de build e o Three.js já vem junto em `vendor/`, então funciona sem CDN.

## Estrutura
```
index.html        telas (início, regras, HUD, carta, final, pausa)
css/style.css     visual Liquid Glass: vidro fosco, borda especular, componentes iOS
js/data.js        TODO o conteúdo: fases, categorias, perguntas, desafios, desejos
js/scene.js       3D: montanha em espiral, nebulosa, cristais, degraus e peças de vidro, câmera
js/dice.js        dado de cristal lapidado e o palco do dado (giro em destaque)
js/icons.js       ícones vetoriais das categorias (3D e interface)
js/game.js        regras, turnos, baralhos, efeitos, tela final, sons
fonts/            Playfair Display, Great Vibes, Inter (locais)
vendor/three/     Three.js r160 (local)
```

## Regras
1. Duas peças: **♂ Ele** (azul) e **♀ Ela** (rosa).
2. Na sua vez você rola o **dado vermelho** e sobe os degraus.
3. Toda casa tem uma categoria e sempre puxa uma carta:

| Casa | O que faz |
|---|---|
| 💬 Verdade | pergunta para responder com sinceridade |
| 🔥 Desafio | ação, algumas com cronômetro |
| 🪶 Pena | carícia livre (a "pena" do jogo físico) |
| ⛓️ Armadilha | volta casas, perde a vez, troca de lugar, mãos atadas… |
| ⭐ Sorte | avança, joga de novo ou ganha um **passe livre** 🎟️ |

4. **Recusar** uma carta custa 2 casas para trás, a não ser que você tenha um passe livre.
5. Quem chega primeiro ao **Clímax** escolhe 1 entre 3 desejos sorteados para o parceiro ou a parceira realizar.

## Ritmo (por que não fica rápido nem lento demais)
- O tabuleiro é dividido em **4 fases**, e o conteúdo esquenta a cada uma:
  Aquecimento → Provocação → Fogo → Clímax. A cor dos degraus acompanha (azul → roxo → rosa → vermelho).
- A média do dado é 3,5. No modo Normal (40 casas) dá cerca de 11 turnos por pessoa, ou seja, uns 22 a 25 cartas no total.
  Com 1 a 2 minutos por carta, a partida fica em torno de **45 a 55 min**. O modo Rápido tem 28 casas e o Longo, 52.
- O peso de cada categoria muda por fase: no começo há mais Verdades, no fim há mais Desafios e Armadilhas.
  Assim a tensão sobe aos poucos, e a fase final concentra o conteúdo mais intenso.
- As armadilhas (voltar casas, perder a vez) aumentam a duração e mantêm os dois próximos no tabuleiro, então a disputa vai até o fim.
- Cartas não se repetem até o baralho daquela fase acabar.

## Editar o conteúdo
Abra `js/data.js`. Cada carta é `c('texto', para, segundos)`:
- `para`: `'ambos'`, `'ele'` (só aparece quando ele joga) ou `'ela'` (só quando ela joga)
- `segundos`: se for maior que 0, a carta mostra um cronômetro
- Marcadores: `{par}` vira o nome do parceiro ou da parceira; `{eu}` vira o seu nome;
  `{o|a}` faz a concordância de gênero de quem joga; `{par:o|a}` faz a do parceiro ou da parceira.

Para mudar quantas vezes cada casa aparece, ajuste `peso` em `CATEGORIAS`, com um valor por fase.

## Próximos passos sugeridos
- Tela para o casal cadastrar as próprias cartas, salvas no aparelho
- Modo "intensidade" (suave / picante / sem limites) para filtrar as cartas
- Casais do mesmo gênero: hoje o jogo assume ele + ela, e isso só afeta o filtro `para` e a concordância
- Trilha sonora ambiente e vibração no celular ao cair em armadilha
- PWA (instalar na tela inicial e jogar offline)

## Sobre a Godot
Comecei com Three.js em vez de Godot de propósito. A exportação web da Godot 4 gera uns 30 a 40 MB, demora para carregar
no celular e tem problemas conhecidos no Safari/iOS (precisa de cabeçalhos especiais no servidor). Com Three.js
o jogo inteiro tem uns 2 MB, abre na hora e roda em qualquer navegador. Se quiser lançar na loja depois, dá para empacotar a mesma pasta
com Capacitor (Android/iOS) sem reescrever nada.
