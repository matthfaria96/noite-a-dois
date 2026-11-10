# Noite a Dois — jogo de tabuleiro 3D para casais

### ▶ Jogar agora: **https://noiteadois.witchmymac.com/**

> +18 · funciona no celular e no computador · dá para instalar na tela inicial (Compartilhar → Adicionar à Tela de Início)

Web, responsivo (celular e computador), sem instalação. Junta **dado + tabuleiro + cartas**:
um mapa 3D de blocos que serpenteia entre ilhas flutuantes e sobe até o **Clímax**, com a câmera atrás da peça da vez.

## Direção visual: veneno
Escuro, sensual e misterioso: vinho quase preto, carmim e fios de luz rosa-sangue. Nada de reflexo branco.

- **Interface:** vidro fumê escuro, contornos finos em rosa-sangue, botões de veludo carmim, seletores e interruptores em vinho e rubi.
  Componentes no jeito iOS (controle segmentado, avisos que descem do topo, animações com mola).
- **Tipografia:** SF Pro nos aparelhos Apple (Inter como reserva); *Playfair Display* itálico nos títulos e cartas e *Great Vibes* no "a Dois".
- **Tabuleiro:** montanha em espiral até o **Pico do Amor**, em névoa vinho; céu com véus carmim, cristais rubi, lua de sangue, velas e pétalas.
  As fases vão do rosa-vinho (Aquecimento) ao carmim (Clímax). Só os degraus perto da peça da vez se acendem; o botão de mapa mostra a montanha inteira.
- **Dado:** pedra filosofal de rubi (romboedro lapidado). Surge do escuro no centro, gira em torno do próprio eixo e para de frente,
  com glow rosé e números claros. A foto da pedra parada vai para o painel **"Último lance"**, no canto, em estilo RPG.
- **Cartas:** chegam de costas (verso ornamentado) e viram para revelar; enquanto estão abertas, avisos e painel saem de cena.
- **Avisos laterais** em moldura RPG (borda dupla ouro-rosé, losangos nas pontas).

> Desempenho: o único vidro com refração é a pedra, no palco do dado (só durante a rolagem). Os módulos baixam em paralelo
> (`modulepreload`) e a abertura aparece no primeiro quadro, antes de qualquer arquivo.

## Instalar como app
- **iPhone (Safari):** abra o link, toque em **Compartilhar → Adicionar à Tela de Início**.
- **Android (Chrome):** abra o link, toque no menu **⋮ → Instalar app**.

O jogo abre em tela cheia com ícone próprio e funciona **offline** depois da primeira visita (`sw.js`).
Ao publicar mudanças, aumente `VERSAO` em `sw.js`. O jogo confere a cada minuto (e quando o app volta para a frente): a versão nova baixa em segundo plano e aparece um aviso discreto **"Versão nova da noite pronta · Atualizar"**. Ele nunca aparece no meio de uma partida, só nas telas iniciais.

## Configurações (⚙️ na tela inicial ou ☰ → Configurações)
- **Som:** volume da música e dos efeitos, e vibração (Android).
- **Narração:** liga/desliga a narradora, escolhe o volume e tem um botão para ouvir.
- **Gráficos:** Automático, Alta ou Leve.
  - **Alta:** brilho (bloom) e foco suave nas bordas.
  - **Leve:** sem bloom e com resolução menor.
  - **Automático:** começa em Alta e troca para Leve sozinho se o aparelho não aguentar.
- **Dado (Premium):** escolhe a pedra: Rubi, Ametista, Safira ou Esmeralda. No gratuito fica o rubi.
- **Conta:** mostra o plano, criar conta e senha, alterar senha, sair. Visitantes podem entrar a qualquer momento para salvar na nuvem.
- **Desenvolvedor (só admin):** não aparece para os outros planos.
  - **Ver o jogo como** Admin, Premium ou Gratuito, para conferir o que cada plano vê.
  - **Todas as cartas:** o baralho inteiro (verdades, desafios, penas, armadilhas, sortes, desejos e as do casal), por tipo e fase, com busca e um interruptor em cada carta.
  - **Modo de teste:** o jogo se joga sozinho com os dois jogadores automáticos, em 1×, 2× ou 4×. Rola o dado, cumpre as cartas (às vezes recusa, para testar a penalidade), escolhe o desejo e mostra no fim quantas rodadas e quanto tempo levou.
- As configurações ficam salvas no aparelho e, com login na nuvem, no perfil da conta.

## Conta e login (Supabase, banco próprio do jogo)
Segue o mesmo padrão do app de finanças: e-mail e senha no Supabase Auth, chaves públicas e segurança por RLS.
O jogo usa um **projeto Supabase separado**, com um banco só dele.

1. Crie um projeto novo em supabase.com (ex.: `noite-a-dois`).
2. No **SQL Editor**, rode `supabase/migrations/20261101120000_inicial.sql`. Ele cria a tabela `perfis` com RLS: cada um só lê e altera o próprio perfil.
3. Em **Authentication → URL Configuration**, coloque `https://noiteadois.witchmymac.com/` como Site URL e Redirect URL.
4. Em **Project Settings → API**, copie a *Project URL* e a *anon public key* para `js/config.js`.
5. Rode também `supabase/migrations/20261109120000_planos.sql`: cria o **plano** de cada conta e deixa como **admin** todas as contas que já existem.

Com isso, o jogo exige login (com "esqueci a senha" por e-mail), e os nomes, as configurações e as estatísticas ficam salvos na nuvem.
### Planos
| | Gratuito | Premium | Admin |
|---|---|---|---|
| Jogo completo, cartas padrão (surpresa) e "O que vale hoje?" | ✓ | ✓ | ✓ |
| Criar e editar cartas próprias (quem faz, quem recebe, foto) | | ✓ | ✓ |
| Escolher a pedra do dado | | ✓ | ✓ |
| Área do desenvolvedor (todas as cartas, modo de teste, ver como) | | | ✓ |

O plano fica na coluna `perfis.plano`, e **o app não consegue alterá-lo**: um gatilho no banco ignora qualquer mudança vinda do jogo. Contas novas começam no gratuito.
Para mudar o plano de alguém, use o SQL Editor (o exemplo está no fim da migração). Visitante sem conta é sempre gratuito.
> As cartas padrão estão em `js/data.js`, que é público como todo site estático. A área de admin esconde o conteúdo da experiência do jogador, mas não é um cofre.

**Sem configurar**, o jogo usa uma conta local opcional (usuário e senha só neste aparelho, com hash PBKDF2), criada em Configurações → "Proteger o jogo com senha".

## Narração e música
- **Narradora:** voz feminina sussurrada e sedutora, gravada no VoiceStudio (OmniVoice, clonada de um trecho de ASMR).
  Há duas versões em Configurações → Narração: **Original** (`audio/voz`, padrão, as gravações como vieram) e **Doce** (`audio/voz2`):
  as mesmas falas tratadas, sem sopro no microfone nem estalo de consoante, com bordas suaves, volume igual (−19 LUFS, pico até −3 dB)
  e o timbre um pouco mais doce (formantes +4% com o Rubber Band R3, sem eco e sem som metálico). As duas têm as 64 falas.
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
css/style.css     visual "veneno": vidro fumê, veludo carmim, painéis RPG, abertura e transições
js/data.js        TODO o conteúdo: fases, categorias, perguntas, desafios, desejos
js/scene.js       3D: montanha em espiral, céu, cristais, degraus e peças, câmera
js/dice.js        pedra filosofal (dado de rubi) e o palco da rolagem; foto para o painel do último lance
js/icons.js       ícones vetoriais das categorias (3D e interface)
js/game.js        regras, turnos, cartas, configurações, login, modo de teste
js/audio.js       trilha lounge gerada em tempo real (fixa) + efeitos sonoros
js/voice.js       narradora: 64 falas gravadas, sorteadas sem repetir por momento do jogo
js/cartas.js      baralho da noite: limites, catálogo (admin), cartas do casal (quem faz/recebe), alternativas de acessório, ritmo
js/lembranca.js   resumo da noite e imagem para guardar
js/auth.js        login: Supabase (nuvem) ou conta local
js/config.js      chaves públicas do Supabase (vazio = conta local)
js/util.js        utilidades e armazenamento local
audio/            lista.json e voz/ (64 falas em MP3 + ROTEIRO.md)
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
  Com 1 a 2 minutos por carta, a partida fica em torno de **45 a 55 min**. O número de casas é escolhido na tela inicial (de 20 a 64, de 4 em 4) e só muda o tamanho do percurso: todas as cartas continuam no baralho e as 4 fases se espalham pelo tabuleiro todo.
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
- Casais do mesmo gênero: hoje o jogo assume ele + ela, e isso só afeta o filtro `para` e a concordância
- Narração das cartas (gravar versões genéricas, sem nomes) quando o conteúdo estiver fechado

## Sobre a Godot
Comecei com Three.js em vez de Godot de propósito. A exportação web da Godot 4 gera uns 30 a 40 MB, demora para carregar
no celular e tem problemas conhecidos no Safari/iOS (precisa de cabeçalhos especiais no servidor). Com Three.js
o jogo inteiro tem uns 2 MB, abre na hora e roda em qualquer navegador. Se quiser lançar na loja depois, dá para empacotar a mesma pasta
com Capacitor (Android/iOS) sem reescrever nada.
