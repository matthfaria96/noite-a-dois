// =====================================================================
//  CONTEÚDO DO JOGO — edite aqui para criar/alterar perguntas e desafios
// ---------------------------------------------------------------------
//  Marcadores que o jogo substitui automaticamente:
//   {eu}        -> nome de quem está jogando a vez
//   {par}       -> nome do(a) parceiro(a)
//   {o|a}       -> concordância de gênero de QUEM JOGA  (ele = "o", ela = "a")
//   {par:o|a}   -> concordância de gênero do PARCEIRO(A)
//
//  c(texto, para, segundos)
//   para: 'ambos' (padrão) | 'ele' (só quando ele joga) | 'ela' (só quando ela joga)
//   segundos: se > 0, a carta mostra um cronômetro
// =====================================================================

const c = (t, p = 'ambos', s = 0) => ({ t, p, s });

// As 4 fases do tabuleiro: a intensidade sobe conforme vocês avançam.
export const FASES = [
  { nome: 'Aquecimento', cor: '#7a5cff', desc: 'olhares, confissões e toques leves' },
  { nome: 'Provocação',  cor: '#b45cff', desc: 'beijos, arrepios e as primeiras peças' },
  { nome: 'Fogo',        cor: '#e05cd0', desc: 'pele com pele, sem pressa' },
  { nome: 'Clímax',      cor: '#ff6aa8', desc: 'sem freios — até o final' },
];

// Categorias de casa ("degraus") do tabuleiro.
// peso[f] = chance relativa da categoria aparecer na fase f.
export const CATEGORIAS = {
  verdade:   { nome: 'Verdade',   icone: '💋', cor: '#ff8ab8', peso: [3.2, 2.2, 1.6, 1.2] },
  desafio:   { nome: 'Desafio',   icone: '🔥', cor: '#ff6a7a', peso: [2.0, 3.0, 3.6, 4.2] },
  pena:      { nome: 'Pena',      icone: '🪶', cor: '#c89aff', peso: [1.0, 1.2, 1.2, 1.0] },
  armadilha: { nome: 'Armadilha', icone: '⛓️', cor: '#e8c8a0', peso: [1.0, 1.3, 1.5, 1.5] },
  sorte:     { nome: 'Sorte',     icone: '✨', cor: '#ffb8a0', peso: [1.0, 0.9, 0.7, 0.5] },
};

// ---------------------------------------------------------------- VERDADE
export const VERDADE = [
  [ // Fase 1 — Aquecimento
    c('Qual foi a primeira coisa que você reparou em {par}?'),
    c('Qual parte do corpo de {par} você acha mais irresistível?'),
    c('Conte um sonho romântico (ou picante) que você já teve com {par}.'),
    c('Qual roupa de {par} mais mexe com você?'),
    c('Qual foi o beijo mais marcante de vocês dois? Descreva.'),
    c('O que {par} faz sem perceber que te deixa com vontade na hora?'),
    c('Em que lugar inusitado você já se pegou pensando em {par} de um jeito safado?'),
    c('Qual elogio você mais gosta de ouvir de {par}?'),
    c('Qual perfume ou cheiro de {par} te desmonta?'),
  ],
  [ // Fase 2 — Provocação
    c('Qual fantasia você ainda não teve coragem de contar para {par}?'),
    c('Onde você mais gosta de receber beijos? Aponte.'),
    c('Qual foi a vez que você mais sentiu desejo por {par} em público?'),
    c('Que peça íntima você adoraria ver {par} usando?'),
    c('Descreva, com detalhes, como seria a noite perfeita a dois.'),
    c('Qual som que {par} faz te enlouquece?'),
    c('Você prefere uma provocação lenta ou ser pego{o|a} de surpresa?'),
    c('Que mensagem picante você gostaria de receber de {par} no meio do dia?'),
  ],
  [ // Fase 3 — Fogo
    c('Qual foi o momento mais quente que vocês já viveram? Conte sussurrando.'),
    c('O que você gostaria que {par} fizesse com mais frequência na cama?'),
    c('Qual lugar da casa você ainda quer estrear com {par}?'),
    c('Qual é a sua maior tentação secreta envolvendo {par}?'),
    c('Se tivesse {par} só para você por uma noite sem regras, qual seria o primeiro pedido?'),
    c('Que palavra {par} poderia sussurrar no seu ouvido que te desarmaria por completo?'),
    c('Qual o toque de {par} que você nunca esqueceu?'),
  ],
  [ // Fase 4 — Clímax
    c('Olhando nos olhos de {par}, diga exatamente o que você quer agora.'),
    c('Qual fantasia você toparia realizar ainda hoje?'),
    c('Descreva o que vai fazer com {par} quando o jogo acabar.'),
    c('Qual é o seu ponto fraco? Mostre para {par} onde fica.'),
    c('De 0 a 10, quanto você está com vontade agora? Responda sem usar palavras.'),
    c('O que {par} faz que te leva ao limite? Seja específic{o|a}.'),
  ],
];

// ---------------------------------------------------------------- DESAFIO
export const DESAFIO = [
  [ // Fase 1
    c('Fiquem 30 segundos se olhando nos olhos, sem rir e sem falar.', 'ambos', 30),
    c('Faça uma massagem nos ombros de {par} por 1 minuto.', 'ambos', 60),
    c('Dê um beijo lento e demorado no pescoço de {par}.'),
    c('Sussurre no ouvido de {par} três coisas que você ama no corpo del{par:e|a}.'),
    c('Dance de um jeito sensual para {par} por 30 segundos.', 'ambos', 30),
    c('Beije {par} em um lugar que você ainda não beijou hoje.'),
    c('Coloque uma música para o clima e beije {par} devagar até o refrão.'),
    c('Sente no colo de {par} e faça carinho no cabelo dele por 1 minuto.', 'ela', 60),
    c('Puxe {par} pela cintura e dê um beijo de cinema.', 'ele'),
    c('Beije a mão de {par} e vá subindo pelo braço até o ombro.', 'ele'),
    c('Morda o lábio, olhe para {par} e dê um beijo que comece bem devagar.', 'ela'),
  ],
  [ // Fase 2
    c('Tire uma peça de roupa de {par} — se conseguir, só com a boca.'),
    c('Tire uma peça de roupa sua, bem devagar, sem tirar os olhos de {par}.'),
    c('Beije a barriga de {par} por 20 segundos.', 'ambos', 20),
    c('Vende os olhos de {par} e beije 3 lugares diferentes. {par} tenta adivinhar onde vem o próximo.'),
    c('Morda de leve a orelha de {par} e sussurre algo bem provocante.'),
    c('Faça um strip-tease de uma peça para {par}, com música.', 'ela'),
    c('Passe as unhas devagar pelas costas de {par} por 30 segundos.', 'ela', 30),
    c('Beije as costas de {par}, da nuca até a cintura.', 'ele'),
    c('Massageie os pés e as pernas de {par}, subindo até onde ela deixar.', 'ele', 60),
    c('Use a pena (ou a ponta dos dedos) para arrepiar {par} por 1 minuto.', 'ambos', 60),
    c('Beije {par} sem usar as mãos por 30 segundos.', 'ambos', 30),
  ],
  [ // Fase 3
    c('Deite {par} de bruços e faça uma massagem com óleo ou creme por 2 minutos.', 'ambos', 120),
    c('{par} fica imóvel por 1 minuto enquanto você provoca com beijos. Se {par} se mexer, recomeça.', 'ambos', 60),
    c('Tire uma peça de roupa de {par} usando apenas os dentes.'),
    c('Beije {par} do pescoço até o umbigo, bem devagar.'),
    c('Vende os olhos de {par} e use boca e mãos para provocar por 1 minuto.', 'ambos', 60),
    c('Escolha uma parte do corpo de {par} e dedique 1 minuto inteiro só a ela.', 'ambos', 60),
    c('Sente em cima de {par} e provoque — ele não pode te tocar por 1 minuto.', 'ela', 60),
    c('Sussurre no ouvido de {par} o que vai fazer com ele mais tarde, nos mínimos detalhes.', 'ela'),
    c('Encoste {par} na parede e beije o pescoço dela por 30 segundos.', 'ele', 30),
    c('Segure as mãos de {par} acima da cabeça dela e beije onde quiser por 1 minuto.', 'ele', 60),
  ],
  [ // Fase 4
    c('Daqui em diante, nenhuma peça de roupa. Quem ainda estiver vestid{o|a}, resolve agora.'),
    c('Por 2 minutos, {par} manda e você obedece.', 'ambos', 120),
    c('Provoque {par} até ouvir um gemido. Sem pressa.'),
    c('Faça em {par} aquilo que você sabe que {par} mais gosta, por 2 minutos.', 'ambos', 120),
    c('Beije cada centímetro de {par}, começando pelos pés. Você tem 2 minutos.', 'ambos', 120),
    c('Escolha o lugar, o ritmo e a intensidade do próximo beijo — e não pare até {par} pedir.'),
    c('Assuma o controle: leve {par} para o lugar da casa que você escolher e continue lá por 1 minuto.', 'ela', 60),
    c('Pegue {par} no colo e leve até onde você quer que o jogo continue.', 'ele'),
  ],
];

// ------------------------------------------------------------------ PENA
// Inspirada na pena do jogo físico: carícia livre, com criatividade.
export const PENA = [
  [ c('Com a pena (ou a ponta dos dedos), acaricie o rosto e os braços de {par} por 1 minuto.', 'ambos', 60),
    c('Desenhe um coração nas costas de {par} com a pena. {par} tem que dizer o que você desenhou.', 'ambos', 0) ],
  [ c('Passe a pena pelo pescoço e pela nuca de {par} por 1 minuto. Arrepio garantido.', 'ambos', 60),
    c('Escreva uma palavra safada na barriga de {par} com a pena. {par} precisa adivinhar.') ],
  [ c('Pena nas costas e nas coxas de {par} por 1 minuto. Sem pressa.', 'ambos', 60),
    c('Olhos fechados: {par} escolhe onde quer sentir a pena, e você obedece por 1 minuto.', 'ambos', 60) ],
  [ c('Pena livre: use onde quiser, como quiser, por 90 segundos. Seja criativ{o|a}.', 'ambos', 90),
    c('Alterne a pena e os seus lábios no corpo de {par} por 1 minuto.', 'ambos', 60) ],
];

// ------------------------------------------------------------- ARMADILHA
// efeito: 'voltar' (n casas) | 'perde' (perde a próxima vez) | 'trocar' (troca de posição) | 'nada'
export const ARMADILHA = [
  { t: 'Corrente do desejo! Volte 2 casas.', e: 'voltar', n: 2 },
  { t: 'Pres{o|a} na tentação: você perde a próxima vez.', e: 'perde' },
  { t: 'Troca de lugar! Você e {par} trocam de posição no tabuleiro.', e: 'trocar' },
  { t: 'Tire uma peça de roupa. Sem negociação.', e: 'nada' },
  { t: 'Refém do desejo: {par} pode te dar uma ordem agora.', e: 'nada' },
  { t: 'Mãos atadas: até a sua próxima vez, você não pode usar as mãos.', e: 'nada' },
  { t: 'Volte 3 casas… mas ganhe um beijo de consolo de {par}.', e: 'voltar', n: 3 },
  { t: 'Silêncio! Até a sua próxima vez você não pode falar. Se falhar, tira uma peça.', e: 'nada' },
  { t: 'Olhos vendados até a sua próxima vez — {par} vai aproveitar.', e: 'nada' },
];

// ----------------------------------------------------------------- SORTE
// efeito: 'avancar' (n) | 'denovo' (joga de novo) | 'passe' (ganha passe para recusar carta) | 'nada'
export const SORTE = [
  { t: 'Sorte! Avance 2 casas.', e: 'avancar', n: 2 },
  { t: 'Role o dado de novo!', e: 'denovo' },
  { t: 'Passe livre: guarde-o. Você pode recusar uma carta sem penalidade.', e: 'passe' },
  { t: '{par} te deve um beijo onde você escolher. Cobre agora!', e: 'nada' },
  { t: 'Avance 1 casa e ganhe uma massagem de 30 segundos.', e: 'avancar', n: 1 },
];

// ---------------------------------------------------------------- DESEJOS
// Ao chegar no Clímax, quem venceu escolhe 1 entre 3 desejos para o(a) parceiro(a) realizar.
// Escritos na voz de QUEM VENCEU.
export const DESEJOS = {
  ambos: [
    'Uma massagem completa de 15 minutos, do jeito que eu mandar.',
    'Nos próximos 20 minutos, eu mando e você obedece.',
    'Um banho a dois — e você cuida de tudo.',
    'Você vai me provocar bem devagar até eu implorar.',
    'Eu escolho o lugar da casa e você me segue, sem perguntas.',
    'Uma fantasia minha, escolhida por mim, realizada hoje.',
    'Vendas nos seus olhos — e eu faço o que eu quiser.',
    'Strip-tease completo, com a música que eu escolher.',
  ],
  ele: [ // pedidos quando ELE vence
    'Quero você só de lingerie, desfilando para mim.',
    'Hoje é você quem conduz tudo, do começo ao fim.',
    'Me beija inteiro, dos pés à boca, sem pular nada.',
  ],
  ela: [ // pedidos quando ELA vence
    'Quero ser beijada inteira, dos pés à boca, sem você pular nada.',
    'Me pega no colo e me leva para onde eu apontar.',
    'Hoje eu fico no controle — e você não pode me tocar até eu deixar.',
  ],
};
