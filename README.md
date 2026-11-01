# Noite a Dois — jogo de tabuleiro 3D para casais

### ▶ Jogar agora: **https://noiteadois.witchmymac.com/**

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

## Rumo ao Pico do Amor
O casal sobe uma montanha envolta em névoa rosa-violeta até o **Pico do Amor**.

- **Mistério e imaginação:** a névoa fica densa na trilha. Só os degraus perto da peça da vez se acendem; o que está à frente vai se revelando aos poucos.
  Na visão de mapa, a névoa se abre e a montanha inteira aparece.
- **Paleta:** tudo em lilás, violeta e rosa, com rocha suave e sem arestas duras. O **vermelho fica reservado aos pontos de foco**:
  o dado, o anel da peça da vez, o farol do Pico do Amor (coração pulsando com um feixe de luz que atravessa a névoa) e o botão de rolar.
- **Foco suave:** as bordas da tela ficam levemente desfocadas, como num sonho. Isso é desligado no modo Leve.
- **Dado em destaque:** ao rolar, o tabuleiro escurece e um dado de cristal lapidado gira em câmera lenta no centro, com os números dourados refratados por dentro. Ele pousa no número e só então a peça anda.
- **Mais leve:** sem refração de vidro no tabuleiro, sem sombras e com menos luzes, partículas e polígonos.
  A refração de verdade ficou só no dado, que é o momento de destaque.

## Instalar como app
- **iPhone (Safari):** abra o link, toque em **Compartilhar → Adicionar à Tela de Início**.
- **Android (Chrome):** abra o link, toque no menu **⋮ → Instalar app**.

O jogo abre em tela cheia com ícone próprio e funciona **offline** depois da primeira visita (`sw.js`).
Ao publicar mudanças, aumente `VERSAO` em `sw.js`. O jogo confere a cada minuto (e quando o app volta para a frente): a versão nova baixa em segundo plano e aparece um aviso discreto **"Versão nova da noite pronta · Atualizar"**. Ele nunca aparece no meio de uma partida, só nas telas iniciais.

## Configurações (⚙️ na tela inicial ou ☰ → Configurações)
- **Som:** volume da música e dos efeitos.
- **Narração:** liga/desliga a narradora, escolhe o volume e tem um botão para ouvir.
- **Gráficos:** Automático, Alta ou Leve.
  - **Alta:** brilho (bloom) e foco suave nas bordas.
  - **Leve:** sem bloom e com resolução menor.
  - **Automático:** começa em Alta e troca para Leve sozinho se o aparelho não aguentar.
- **Conta:** criar conta e senha, alterar senha, sair.
- **Modo de teste:** o jogo se joga sozinho com os dois jogadores automáticos, em 1×, 2× ou 4×. Também tem um atalho na tela inicial.
  Rola o dado, cumpre as cartas (às vezes recusa, para testar a penalidade), escolhe o desejo e mostra no fim quantas rodadas e quanto tempo levou.
- As configurações ficam salvas no aparelho e, com login na nuvem, no perfil da conta.

## Conta e login (Supabase, banco próprio do jogo)
Segue o mesmo padrão do app de finanças: e-mail e senha no Supabase Auth, chaves públicas e segurança por RLS.
O jogo usa um **projeto Supabase separado**, com um banco só dele.

1. Crie um projeto novo em supabase.com (ex.: `noite-a-dois`).
2. No **SQL Editor**, rode `supabase/migrations/20261101120000_inicial.sql`. Ele cria a tabela `perfis` com RLS: cada um só lê e altera o próprio perfil.
3. Em **Authentication → URL Configuration**, coloque `https://noiteadois.witchmymac.com/` como Site URL e Redirect URL.
4. Em **Project Settings → API**, copie a *Project URL* e a *anon public key* para `js/config.js`.

Com isso, o jogo exige login (com "esqueci a senha" por e-mail), e os nomes, as configurações e as estatísticas ficam salvos na nuvem.
**Sem configurar**, o jogo usa uma conta local opcional (usuário e senha só neste aparelho, com hash PBKDF2), criada em Configurações → "Proteger o jogo com senha".

## Narração e música
- **Narradora:** voz feminina sussurrada e sedutora, gravada no VoiceStudio (OmniVoice, clonada de um trecho de ASMR).
  Ela dá as boas-vindas, avisa de quem é a vez, anuncia as fases, o tipo de carta, armadilhas, sorte, o Pico do Amor e o desejo. A música abaixa enquanto ela fala.
  **Só toca falas gravadas** (`audio/voz/ROTEIRO.md`, listadas em `audio/lista.json`): o jogo não usa a voz do aparelho. Nomes, texto das cartas e desejos aparecem só na tela.
- **Música:** trilha lounge sensual **gerada em tempo real**, sem arquivo e fixa (não muda com as fases): piano elétrico, baixo quente, batida trip-hop baixinha, colchão e chiado de vinil, a 70 BPM. Partes cheia e vazia se alternam a cada 16 compassos e as frases de melodia variam, para não enjoar. Para usar uma faixa própria, coloque `audio/musica.mp3` e marque `"musica": true` em `audio/lista.json`.
- O 3D do tabuleiro **pausa** enquanto o dado gira em destaque e cai para **30 fps** quando uma tela (carta, menu, configurações) cobre o tabuleiro.
- No modo Alta, a resolução vai até 1,75× (antes era 2×), e o bloom é calculado em meia resolução.
- Não há refração no tabuleiro (só no dado), nem sombras, e a montanha tem uma malha reduzida.
- O laço de animação não cria objetos novos a cada quadro.
- Three.js minificado e só com os módulos usados: de 1,9 MB para 780 KB.
- O app fica salvo no aparelho e abre offline. Login e banco nunca passam pelo cache.

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
index.html        telas (login, início, configurações, regras, HUD, carta, final, pausa)
css/style.css     visual Liquid Glass: vidro fosco, borda especular, componentes iOS
js/data.js        TODO o conteúdo: fases, categorias, perguntas, desafios, desejos
js/scene.js       3D: montanha em espiral, nebulosa, cristais, degraus e peças de vidro, câmera
js/dice.js        dado de cristal lapidado e o palco do dado (giro em destaque)
js/icons.js       ícones vetoriais das categorias (3D e interface)
js/game.js        regras, turnos, cartas, configurações, login, modo de teste
js/audio.js       música ambiente gerada em tempo real + efeitos sonoros
js/voice.js       narradora (voz do aparelho ou falas gravadas)
js/auth.js        login: Supabase (nuvem) ou conta local
js/config.js      chaves públicas do Supabase (vazio = conta local)
js/util.js        utilidades e armazenamento local
audio/            lista.json, voz/ROTEIRO.md (falas para gravar)
supabase/         migração SQL do banco do jogo
fonts/            Playfair Display, Great Vibes, Inter (locais)
vendor/three/     Three.js r160 minificado, só os módulos usados
vendor/supabase/  cliente Supabase (carregado só se configurado)
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
