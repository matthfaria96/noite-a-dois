// Regras, fluxo de turnos, interface, configurações, conta, modo de teste, narração e música.
import { Board3D } from './scene.js';
import { DiceStage, GEMAS } from './dice.js';
import { FASES, CATEGORIAS, VERDADE } from './data.js';
import { LIMITES, limitesAtivos, catalogo, baralho, armadilhas, sortes, desejos, faseDaCasa, pesoNoRitmo, normalizarCarta, paraQuem, alternativa } from './cartas.js';
import * as lembranca from './lembranca.js';

window.progresso?.(0.74, 'Preparando o tabuleiro…');
import { iconURL, pedraSVG, setPedra } from './icons.js';
import { $, wait, rnd, shuffle, store } from './util.js';
import { GameAudio } from './audio.js';
import { Narrator } from './voice.js';
import { auth, PLANOS, nomePlano } from './auth.js';

// ------------------------------------------------------------ configurações (salvas no aparelho e na nuvem)
const CFG_DEFAULT = { musica: 0.6, efeitos: 0.7, voz: 1, narracao: true, vibrar: true, graficos: 'auto', vozNarradora: 'original', dur: 40, start: 'ela', ritmo: 'provocante', testeVel: 2, limites: {}, cartas: [], desligadas: [], gema: 'rubi' };
const cfg = { ...CFG_DEFAULT, ...store.get('cfg', {}) };
// cartas do casal no formato atual (id, quem faz, quem recebe, ativa); as antigas viram "ambos" e ficam como estavam
const normalizarCartas = () => { cfg.cartas = (cfg.cartas ?? []).map(c => normalizarCarta(c, cfg.desligadas)); };
normalizarCartas();

// ------------------------------------------------------------ planos: gratuito < premium < admin
// O admin pode ligar "ver como gratuito" para testar; a área do desenvolvedor segue o plano real.
const ehAdmin = () => auth.plano === 'admin';
const planoEfetivo = () => (ehAdmin() ? (store.get('ver-como', 'admin') === 'gratuito' ? 'gratuito' : 'admin') : auth.plano);
const podeUsar = nivel => PLANOS.indexOf(planoEfetivo()) >= PLANOS.indexOf(nivel);
let saveT;
function saveCfg() {
  store.set('cfg', cfg);
  clearTimeout(saveT);
  saveT = setTimeout(() => auth.saveProfile({ config: cfg, nome_ele: $('#name-ele').value, nome_ela: $('#name-ela').value }).catch(() => {}), 1200);
}

const audio = new GameAudio();
const voice = new Narrator(audio);
function applyCfg() {
  audio.setVolume('musica', cfg.musica);
  audio.setVolume('efeitos', cfg.efeitos);
  voice.enabled = cfg.narracao;
  voice.volume = cfg.voz;
  voice.setVoz(cfg.vozNarradora);
}
applyCfg();

// ------------------------------------------------------------ tabuleiro
function generateBoard(N) {
  const tiles = [{ tipo: 'inicio', fase: 0 }];
  let prev = null;
  for (let i = 1; i < N - 1; i++) {
    const fase = faseDaCasa(i, N, cfg.ritmo);
    const pool = Object.entries(CATEGORIAS).filter(([k]) =>
      k !== prev && !(k === 'armadilha' && i < 3) && !(k === 'sorte' && prev === 'armadilha'));
    const peso = ([k, c]) => c.peso[fase] * pesoNoRitmo(k, cfg.ritmo);
    const total = pool.reduce((s, e) => s + peso(e), 0);
    let r = Math.random() * total, tipo = pool[0][0];
    for (const e of pool) { r -= peso(e); if (r <= 0) { tipo = e[0]; break; } }
    tiles.push({ tipo, fase });
    prev = tipo;
  }
  tiles.push({ tipo: 'fim', fase: 3 });
  return tiles;
}

// baralhos sem repetição
const used = new Map();
// (as cartas do casal têm destaque: enquanto houver uma inédita, ela sai em metade dos sorteios)
function draw(key, list, gender) {
  const ok = list.filter(c => !c.p || c.p === 'ambos' || c.p === gender);
  if (!ok.length) return null;
  let seen = used.get(key) ?? new Set();
  let free = ok.filter(c => !seen.has(c.t));
  if (!free.length) { seen = new Set(); free = ok; }
  const nossas = free.filter(c => c.nossa);
  const pool = nossas.length && Math.random() < 0.5 ? nossas : free;
  const card = pool[rnd(pool.length)];
  seen.add(card.t); used.set(key, seen);
  return card;
}

// ------------------------------------------------------------ estado
const G = { N: cfg.dur, starter: cfg.start, players: {}, turn: 'ela', busy: false, tiles: [], fase: 0, rodadas: 0 };
const TESTE = { on: false, vel: 1 };
const other = g => (g === 'ele' ? 'ela' : 'ele');
const pause = ms => wait(ms / (TESTE.on ? TESTE.vel : 1));
// narradora: falas curtas por momento do jogo. As opcionais (vez, dado, reações) só às vezes
// e nunca em duas rodadas seguidas, para soarem espontâneas
const fala = momento => (TESTE.on && TESTE.vel > 1 ? Promise.resolve() : voice.fala(momento));
let ultimaOpcional = -9;
function talvez(momento, chance) {
  if (G.rodadas - ultimaOpcional < 2 || Math.random() > chance) return;
  ultimaOpcional = G.rodadas;
  fala(momento);
}
// vibração (Android; o iPhone não permite em páginas web)
const vibrar = padrao => { if (cfg.vibrar && !TESTE.on) try { navigator.vibrate?.(padrao); } catch {} };

function fill(text, who) {
  const me = G.players[who], par = G.players[other(who)];
  return text
    .replace(/\{par:([^|{}]*)\|([^{}]*)\}/g, (_, m, f) => (par.g === 'ele' ? m : f))
    .replace(/\{([^|{}:]*)\|([^{}]*)\}/g, (_, m, f) => (me.g === 'ele' ? m : f))
    .replaceAll('{eu}', me.name)
    .replaceAll('{par}', par.name);
}

// ------------------------------------------------------------ UI helpers
// telas entram e saem com transição: `leaving` toca a saída e só depois esconde
const showEl = el => { el.classList.remove('leaving', 'hidden'); };
const hideEl = el => {
  if (el.classList.contains('hidden') || el.classList.contains('leaving')) return;
  if (!el.classList.contains('screen') || matchMedia('(prefers-reduced-motion: reduce)').matches) return el.classList.add('hidden');
  el.classList.add('leaving');
  setTimeout(() => { if (el.classList.contains('leaving')) el.classList.replace('leaving', 'hidden'); }, 280);
};
const show = id => showEl($(id));
const hide = id => hideEl($(id));
const visible = id => { const c = $(id).classList; return !c.contains('hidden') && !c.contains('leaving'); };
let toastT;
function toast(msg, ms = 2200) {
  const t = $('#toast'); t.textContent = msg; show('#toast');
  clearTimeout(toastT); toastT = setTimeout(() => hide('#toast'), ms);
}

function updateHUD() {
  for (const g of ['ele', 'ela']) {
    const p = G.players[g];
    $(`#chip-${g} .nm`).textContent = p.name;
    $(`#chip-${g} .pos`).textContent = `${p.pos}/${G.N - 1}${p.passe ? ' · passe ×' + p.passe : ''}`;
    $(`#chip-${g}`).classList.toggle('on', G.turn === g);
    $(`#dot-${g}`).style.left = (p.pos / (G.N - 1)) * 100 + '%';
  }
  const cur = G.players[G.turn];
  const f = FASES[G.tiles[cur.pos].fase];
  $('#fase-label').innerHTML = `Fase <b style="color:color-mix(in srgb, ${f.cor} 65%, #fff)">${f.nome}</b><i> · ${f.desc}</i>`;
  $('#turn-label').innerHTML = `Vez de <b style="color:var(--${G.turn})">${cur.name}</b>`;
  $('#btn-roll').disabled = G.busy || TESTE.on;
}

// Indicadores laterais: à esquerda o tipo da casa, à direita a ação que acontece
const ACAO = {
  verdade: 'Responda com sinceridade', desafio: 'Cumpra o desafio', pena: 'Carícia livre',
  armadilha: 'Cuidado…', sorte: 'Um presente pra você',
};
let sideT;
function sides(tipo, acao, { titulo = CATEGORIAS[tipo]?.nome, sub = 'Casa', subR = 'Acontece', ms = 2600 } = {}) {
  const L = $('#side-l'), R = $('#side-r'), cor = CATEGORIAS[tipo]?.cor ?? '#ff8ab8';
  for (const el of [L, R]) { el.style.setProperty('--c', cor); el.classList.remove('hidden', 'out'); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }
  L.querySelector('.side-ico').style.backgroundImage = `url(${iconURL(tipo, 96)}), linear-gradient(145deg, rgba(255,255,255,.25), rgba(255,255,255,.05))`;
  L.querySelector('small').textContent = sub; L.querySelector('b').textContent = titulo;
  R.querySelector('small').textContent = subR; R.querySelector('b').textContent = acao;
  clearTimeout(sideT);
  sideT = setTimeout(() => { L.classList.add('out'); R.classList.add('out'); setTimeout(() => { L.classList.add('hidden'); R.classList.add('hidden'); }, 450); }, ms / (TESTE.on ? TESTE.vel : 1));
}

// O 3D trabalha menos quando uma tela cobre o tabuleiro (economia de bateria e fluidez)
const OVERLAYS = ['#setup', '#lock', '#card', '#menu', '#rules', '#final', '#settings'];
// menus em folha: fundo totalmente borrado e o 3D congelado por baixo (o desfoque é feito uma vez, sobre uma imagem parada)
const MODAIS = ['#settings', '#limites', '#cartas', '#rules', '#catalogo', '#info'];
const refreshThrottle = () => {
  board.setThrottle(OVERLAYS.some(visible));
  const modal = MODAIS.some(visible);
  document.body.classList.toggle('modal-aberto', modal);
  board.congelado = modal;
};
new MutationObserver(refreshThrottle).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });

// Mostra uma carta e devolve 'feito' | 'recusou'
function showCard({ cat, text, secs = 0, who, fase, refusable = true, falar = true, nossa = false, foto = null }) {
  return new Promise(resolve => {
    const card = $('#card .card');
    card.style.setProperty('--c', cat.cor);
    card.classList.toggle('nossa', nossa);
    $('#card .nossa-selo').classList.toggle('hidden', !nossa);
    const tipo = Object.keys(CATEGORIAS).find(k => CATEGORIAS[k] === cat);
    const ico = $('#card .ico');
    ico.classList.toggle('foto', !!foto);
    ico.style.backgroundImage = foto ? `url(${foto})` : `url(${iconURL(tipo, 160)}), linear-gradient(145deg, rgba(255,255,255,.28), rgba(255,255,255,.06))`;
    $('#card .cat').textContent = cat.nome;
    $('#card .fase-tag').textContent = FASES[fase].nome;
    const nome = g => `<b style="color:var(--${g})">${G.players[g].name}</b>`;
    $('#card .card-who').innerHTML = nossa ? `De ${nome(who)} para ${nome(other(who))}` : `Para ${nome(who)}`;
    $('#card .card-text').textContent = text;
    const dica = alternativa(text);
    $('#card .card-dica').textContent = dica;
    $('#card .card-dica').classList.toggle('hidden', !dica);
    const p = G.players[who];
    const refuse = $('#btn-refuse');
    refuse.classList.toggle('hidden', !refusable);
    refuse.textContent = p.passe ? 'Usar passe' : 'Recusar · −2';

    const tm = $('#card .timer'), fg = tm.querySelector('.fg'), lbl = tm.querySelector('b');
    let iv = null;
    const C = 276.5;
    const reset = () => { clearInterval(iv); iv = null; fg.style.strokeDashoffset = 0; lbl.textContent = '▶ ' + secs + 's'; };
    tm.classList.toggle('hidden', !secs);
    if (secs) {
      reset();
      tm.onclick = () => {
        if (iv) return reset();
        const t0 = Date.now();
        fala('tempo');
        iv = setInterval(() => {
          const left = Math.max(0, secs - (Date.now() - t0) / 1000);
          fg.style.strokeDashoffset = C * (1 - left / secs);
          lbl.textContent = Math.ceil(left) + 's';
          if (left <= 0) { clearInterval(iv); iv = null; lbl.textContent = '⏰'; audio.alarm(); vibrar([60, 80, 60]); fala('fimtempo'); }
        }, 200);
      };
    }
    let autoT;
    const done = r => {
      clearInterval(iv); clearTimeout(autoT); hide('#card'); voice.stop(); document.body.classList.remove('carta-aberta');
      if (r === 'feito') { G.diario.feitas++; if (falar) talvez(fase < 2 ? 'suave' : 'quente', 0.5); }
      else G.diario.recusadas++;
      resolve(r);
    };
    $('#btn-done').onclick = () => done('feito');
    refuse.onclick = () => done('recusou');
    card.style.animation = 'none'; card.querySelector('.verso').style.animation = 'none'; void card.offsetWidth;
    card.style.animation = ''; card.querySelector('.verso').style.animation = '';
    document.body.classList.add('carta-aberta');
    show('#card');
    audio.card();
    if (falar) fala(tipo);
    if (TESTE.on) autoT = setTimeout(() => done(refusable && Math.random() < 0.12 ? 'recusou' : 'feito'), 1800 / TESTE.vel);
  });
}

// ------------------------------------------------------------ 3D, dado e qualidade
const board = new Board3D($('#stage'));
const dice = new DiceStage($('#dice-layer'));
// iPhone: ao voltar para o app ou quando a área visível muda, a altura real da tela pode mudar; a cena acompanha
const remedir = () => { board.resize(); dice.resize(); };
window.addEventListener('pageshow', remedir);
window.visualViewport?.addEventListener('resize', remedir);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(remedir, 250); });
function setGraficos(mode) {
  cfg.graficos = mode;
  const q = mode === 'leve' ? 'leve' : 'alta';
  board.setQuality(q); dice.setQuality(q);
  segSet('#seg-graf', mode);
}
board.onLowFps = () => {
  if (cfg.graficos !== 'auto') return;
  board.setQuality('leve'); dice.setQuality('leve');
  toast('Gráficos ajustados para o modo leve');
};
// ------------------------------------------------------------ app instalado (PWA)
const instalado = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone === true;
document.documentElement.classList.toggle('app', instalado);
// versão nova: baixa em segundo plano e fica pronta; um aviso discreto oferece "Atualizar".
// Nunca no meio da partida: se chegar durante o jogo, o aviso espera a volta à tela inicial.
let swNovo = null;
function avisarAtualizacao() {
  if (!swNovo || visible('#hud')) return;
  hide('#instalar');
  show('#atualizar');
}
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    const pronto = sw => { if (sw && navigator.serviceWorker.controller) { swNovo = sw; avisarAtualizacao(); } };
    pronto(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      sw?.addEventListener('statechange', () => { if (sw.state === 'installed') pronto(sw); });
    });
    // confere a cada minuto e sempre que o app volta para a frente (app instalado retomado no iPhone)
    const conferir = () => reg.update().catch(() => {});
    setInterval(conferir, 60_000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') conferir(); });
  }).catch(() => {});
  let recarregando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (swNovo && !recarregando) { recarregando = true; location.reload(); } });
  window.addEventListener('nad:inicio', avisarAtualizacao);
}
$('#btn-atualizar').onclick = () => { $('#btn-atualizar').disabled = true; $('#btn-atualizar').textContent = 'Atualizando…'; swNovo?.postMessage('atualizar'); };
// tela acesa durante a partida
let wake = null;
async function manterTelaAcesa(on) {
  try {
    if (on && !wake && document.visibilityState === 'visible') { wake = await navigator.wakeLock?.request('screen'); wake?.addEventListener('release', () => { wake = null; }); }
    if (!on && wake) { await wake.release(); wake = null; }
  } catch { wake = null; }
}
document.addEventListener('visibilitychange', () => { if (visible('#hud')) manterTelaAcesa(document.visibilityState === 'visible'); });
// convite para instalar: botão nativo no Android/desktop, instrução no iPhone; nunca dentro do app instalado
let pedidoInstalar = null;
const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function convidarInstalar() {
  if (instalado || store.get('instalar-dispensado', 0) > Date.now() || TESTE.on) return;
  if (!pedidoInstalar && !ios) return;
  if (!visible('#setup')) return setTimeout(convidarInstalar, 3000); // só na tela inicial, nunca por cima do login
  if (visible('#atualizar')) return;
  $('#btn-instalar').classList.toggle('hidden', !pedidoInstalar);
  if (!pedidoInstalar) $('#instalar-dica').innerHTML = 'Toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>: abre em tela cheia, como um app.';
  show('#instalar');
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); pedidoInstalar = e; setTimeout(convidarInstalar, 2500); });
$('#btn-instalar').onclick = async () => { hide('#instalar'); await pedidoInstalar?.prompt(); pedidoInstalar = null; };
$('#instalar-fechar').onclick = () => { hide('#instalar'); store.set('instalar-dispensado', Date.now() + 7 * 864e5); };
window.addEventListener('appinstalled', () => hide('#instalar'));
if (ios) setTimeout(convidarInstalar, 4000);

// ------------------------------------------------------------ fluxo da partida
// os dois nomes são obrigatórios para começar
function nomesOk() {
  const vazios = ['ele', 'ela'].filter(g => !$(`#name-${g}`).value.trim());
  for (const g of ['ele', 'ela']) $(`#name-${g}`).closest('label').classList.toggle('erro', vazios.includes(g));
  if (!vazios.length) return true;
  $(`#name-${vazios[0]}`).focus();
  toast(vazios.length === 2 ? 'Escrevam os dois nomes para começar' : `Falta o nome ${vazios[0] === 'ele' ? 'dele' : 'dela'}`);
  return false;
}
function pintarInicio() { $('#btn-start').classList.toggle('falta', ['ele', 'ela'].some(g => !$(`#name-${g}`).value.trim())); }
for (const g of ['ele', 'ela']) $(`#name-${g}`).addEventListener('input', e => { e.target.closest('label').classList.remove('erro'); pintarInicio(); });

function startGame(teste = false) {
  if (teste && !ehAdmin()) return; // modo de teste: só admins
  if (!teste && !nomesOk()) return;
  TESTE.on = teste; TESTE.vel = teste ? cfg.testeVel : 1;
  board.speed = dice.speed = TESTE.on ? TESTE.vel : 1;
  const nEle = teste ? 'Ele (teste)' : $('#name-ele').value.trim();
  const nEla = teste ? 'Ela (teste)' : $('#name-ela').value.trim();
  if (!teste) { store.set('names', [nEle, nEla]); saveCfg(); }
  G.players = {
    ele: { g: 'ele', name: nEle, pos: 0, skip: false, passe: 0 },
    ela: { g: 'ela', name: nEla, pos: 0, skip: false, passe: 0 },
  };
  G.turn = G.starter === 'sorte' ? (Math.random() < 0.5 ? 'ele' : 'ela') : G.starter;
  G.tiles = generateBoard(G.N);
  G.fase = 0; G.rodadas = 0; G.t0 = Date.now(); ultimaOpcional = -9;
  G.diario = { feitas: 0, recusadas: 0, verdade: 0, desafio: 0, pena: 0, armadilha: 0, sorte: 0 };
  used.clear();
  G.busy = false;
  board.build(G.tiles);
  board.focus(G.turn);
  board.setMode('follow');
  audio.setPhase(0);
  $('#btn-map').classList.remove('on');
  ['#setup', '#final', '#menu', '#settings'].forEach(hide);
  show('#hud');
  hide('#instalar');
  $('#dado-hud').classList.add('hidden');
  manterTelaAcesa(true);
  $('#test-badge').classList.toggle('hidden', !TESTE.on);
  $('#test-badge b').textContent = `Modo de teste · ${TESTE.vel}×`;
  updateHUD();
  toast(`${G.players[G.turn].name} começa a noite…`);
  fala('inicio'); // uma fala só: quem começa já aparece na tela
  autoNext();
}

function autoNext() { if (TESTE.on) setTimeout(() => { if (TESTE.on && !G.busy && visible('#hud')) roll(); }, 1100 / TESTE.vel); }

async function move(who, to) {
  const p = G.players[who];
  to = Math.max(0, Math.min(G.N - 1, to));
  if (to === p.pos) return;
  await board.movePiece(who, p.pos, to, () => audio.hop());
  p.pos = to;
  updateHUD();
  // entrou numa fase nova: a narradora anuncia e a música esquenta
  const f = G.tiles[p.pos].fase;
  if (f > G.fase) { G.fase = f; audio.setPhase(f); fala(`fase${f + 1}`); }
  // alguém está quase no Pico: ela avisa uma vez por jogador
  if (!p.quase && p.pos >= G.N - 6 && p.pos < G.N - 1) { p.quase = true; fala('quase'); }
}

// último lance: a pedra em vetor com o número, e quem tirou; o botão de rolar mostra a mesma pedra
function ultimoLance(v, who) {
  const el = $('#dado-hud');
  el.querySelector('.medalhao').innerHTML = pedraSVG(v);
  $('#btn-roll .die-ico').innerHTML = pedraSVG(v);
  el.querySelector('b').textContent = v;
  el.querySelector('.quem').innerHTML = `<i style="color:var(--${who})">${G.players[who].name}</i>`;
  el.style.setProperty('--c', `var(--${who})`);
  el.classList.remove('hidden', 'novo'); void el.offsetWidth; el.classList.add('novo');
}
$('#btn-roll .die-ico').innerHTML = pedraSVG(); // a pedra, sem número até o primeiro lance
async function roll() {
  if (G.busy) return;
  G.busy = true; updateHUD();
  voice.stop();
  board.setMode('follow'); $('#btn-map').classList.remove('on');
  const who = G.turn, p = G.players[who];
  const v = 1 + rnd(6);
  audio.roll();
  board.paused = true; // o palco do dado cobre a tela: o 3D do tabuleiro descansa
  await dice.roll(v, () => { audio.land(); vibrar(25); });
  board.paused = false;
  ultimoLance(v, who);
  if (v >= 5) talvez('dadoalto', 0.5);
  else if (v === 1) talvez('dadobaixo', 0.5);
  await pause(250);
  await move(who, p.pos + v);
  if (p.pos >= G.N - 1) return finish(who);
  await pause(250);
  const again = await resolveTile(who);
  if (p.pos >= G.N - 1) return finish(who);
  endTurn(again);
}

async function refusePenalty(who) {
  const p = G.players[who];
  const tipo = G.tiles[p.pos].tipo in CATEGORIAS ? G.tiles[p.pos].tipo : 'armadilha';
  if (p.passe) { p.passe--; sides(tipo, 'Usou o passe livre', { titulo: 'Recusou', sub: p.name, subR: 'Sem penalidade' }); updateHUD(); fala('passe'); return; }
  sides(tipo, 'Volta 2 casas', { titulo: 'Recusou', sub: p.name, subR: 'Penalidade' });
  fala('recusou');
  audio.trap();
  await move(who, p.pos - 2);
}

// Retorna true se o jogador joga de novo
async function resolveTile(who) {
  const p = G.players[who];
  const tile = G.tiles[p.pos];
  const cat = CATEGORIAS[tile.tipo];
  if (!cat) return false;
  const f = tile.fase;
  sides(tile.tipo, ACAO[tile.tipo]);
  await pause(950);

  if (tile.tipo === 'verdade' || tile.tipo === 'desafio' || tile.tipo === 'pena') {
    // se nenhuma carta da casa servir para quem joga, vale uma verdade da fase
    const card = draw(tile.tipo + f, baralho(tile.tipo, f, cfg), who) ?? draw('verdade' + f, baralho('verdade', f, cfg), who) ?? VERDADE[f][0];
    G.diario[tile.tipo]++;
    const r = await showCard({ cat, text: fill(card.t, who), secs: card.s, who, fase: f, nossa: !!card.nossa, foto: card.foto });
    if (r === 'recusou') await refusePenalty(who);
    return false;
  }

  if (tile.tipo === 'armadilha') {
    audio.trap();
    const card = draw('armadilha', armadilhas(cfg), who);
    G.diario.armadilha++;
    vibrar([40, 60, 40]);
    fala('armadilha');
    const text = fill(card.t, who);
    const r = await showCard({ cat, text, who, fase: f, falar: false });
    if (r === 'recusou') { await refusePenalty(who); return false; }
    if (card.e === 'voltar') { sides('armadilha', `Volta ${card.n} casas`, { sub: 'Efeito', subR: p.name }); await move(who, p.pos - card.n); }
    if (card.e === 'perde') { p.skip = true; sides('armadilha', 'Perde a próxima vez', { sub: 'Efeito', subR: p.name }); }
    if (card.e === 'trocar') {
      sides('armadilha', 'Troca de lugar', { sub: 'Efeito', subR: 'Os dois' });
      const o = G.players[other(who)];
      const a = p.pos, b = o.pos;
      if (a !== b) {
        await Promise.all([board.movePiece(who, a, b), board.movePiece(o.g, b, a)]);
        p.pos = b; o.pos = a; updateHUD();
      }
    }
    return false;
  }

  if (tile.tipo === 'sorte') {
    const card = draw('sorte', sortes(cfg), who);
    G.diario.sorte++;
    fala('sorte');
    await showCard({ cat, text: fill(card.t, who), who, fase: f, refusable: false, falar: false });
    if (card.e === 'avancar') { sides('sorte', `Avança ${card.n} casa${card.n > 1 ? 's' : ''}`, { sub: 'Efeito', subR: p.name }); await move(who, p.pos + card.n); }
    if (card.e === 'passe') { p.passe++; updateHUD(); sides('sorte', 'Ganhou um passe livre', { sub: 'Efeito', subR: p.name }); }
    if (card.e === 'denovo') { sides('sorte', 'Joga de novo', { sub: 'Efeito', subR: p.name }); return true; }
  }
  return false;
}

function endTurn(again) {
  G.rodadas++;
  let next = again ? G.turn : other(G.turn);
  if (!again && G.players[next].skip) {
    G.players[next].skip = false;
    sides('armadilha', 'Perde esta vez', { titulo: G.players[next].name, sub: 'Presa na armadilha'.replace('Presa', next === 'ele' ? 'Preso' : 'Presa'), subR: 'Joga de novo: ' + G.players[G.turn].name });
    next = G.turn;
  }
  G.turn = next;
  board.focus(next);
  G.busy = false;
  updateHUD();
  talvez('vez', 0.5);
  autoNext();
}

function finish(winner) {
  audio.win();
  const w = G.players[winner], l = G.players[other(winner)];
  updateHUD();
  vibrar([30, 50, 30, 50, 120]);
  fala(winner === 'ele' ? 'vencedor' : 'vencedora');
  fala('pico');
  fala('desejo');
  if (!TESTE.on) {
    const st = store.get('stats', { partidas: 0, ele: 0, ela: 0 });
    st.partidas++; st[winner]++;
    store.set('stats', st);
    auth.saveProfile({ estatisticas: st }).catch(() => {});
  }
  $('#final-title').innerHTML = `<span style="color:var(--${winner})">${w.name}</span> chegou ao Pico do Amor!`;
  $('#final-sub').textContent = `Escolha a dedo 1 desejo para ${l.name} realizar:`;
  const opts = shuffle(desejos(winner, cfg)).slice(0, 3);
  const box = $('#wishes'); box.innerHTML = '';
  hide('#wish-chosen'); box.classList.remove('hidden');
  const choose = t => {
    box.classList.add('hidden');
    $('#final-sub').textContent = `${w.name} escolheu. ${l.name}, agora é com você:`;
    $('#wish-chosen .chosen-text').textContent = TESTE.on
      ? `Teste concluído: ${G.rodadas} rodadas em ${Math.round((Date.now() - G.t0) / 1000)}s (${TESTE.vel}×).`
      : `“${t}”`;
    G.noite = {
      data: new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }),
      ele: G.players.ele.name, ela: G.players.ela.name, vencedor: w.name, desejo: t, numeros: lembranca.resumo(G),
    };
    G.noite.vezes = TESTE.on ? 0 : lembranca.registrar(G.noite);
    lembranca.mostrar($('#memoria'), G.noite);
    $('#btn-lembranca').classList.toggle('hidden', TESTE.on);
    show('#wish-chosen');
    audio.card();
  };
  opts.forEach((t, i) => {
    const b = document.createElement('button');
    b.className = 'wish';
    b.innerHTML = `<i>${['I', 'II', 'III'][i]}</i>`;
    b.append(t);
    b.onclick = () => choose(t);
    box.append(b);
  });
  setTimeout(() => show('#final'), 700);
  if (TESTE.on) setTimeout(() => choose(opts[0]), 2500 / TESTE.vel);
}

function stopTest() { TESTE.on = false; board.speed = dice.speed = 1; hide('#test-badge'); toSetup(); }

// ------------------------------------------------------------ controles segmentados
function segSet(id, v) { document.querySelectorAll(`${id} button`).forEach(b => b.classList.toggle('on', b.dataset.v === String(v))); }
function segment(id, get, set) {
  segSet(id, get());
  document.querySelectorAll(`${id} button`).forEach(b => b.onclick = () => { set(b.dataset.v); segSet(id, get()); saveCfg(); });
}
// casas no tabuleiro: só mudam o tamanho do percurso (todas as cartas continuam no baralho)
const CASAS = { min: 20, max: 64, passo: 4 };
const minutosDe = n => Math.round((n * 1.3) / 5) * 5; // ~1,3 min por casa (média do dado 3,5 e 1 a 2 min por carta)
function pintarCasas() {
  const n = G.N, el = $('#casas');
  el.value = n;
  el.style.setProperty('--p', (n - CASAS.min) / (CASAS.max - CASAS.min));
  $('#casas-val').textContent = `${n} casas`;
  $('#casas-tempo').textContent = `~${minutosDe(n)} min`;
  $('#casas-menos').disabled = n <= CASAS.min; $('#casas-mais').disabled = n >= CASAS.max;
}
let casasT;
function setCasas(n) {
  n = Math.max(CASAS.min, Math.min(CASAS.max, Math.round(n / CASAS.passo) * CASAS.passo));
  if (n === G.N) return;
  G.N = cfg.dur = n;
  pintarCasas(); saveCfg();
  // o tabuleiro do fundo acompanha o tamanho escolhido
  clearTimeout(casasT); casasT = setTimeout(() => { if (visible('#setup')) { G.tiles = generateBoard(G.N); board.build(G.tiles); board.setMode('orbit'); } }, 350);
}
$('#casas').oninput = e => setCasas(Number(e.target.value));
$('#casas-menos').onclick = () => setCasas(G.N - CASAS.passo);
$('#casas-mais').onclick = () => setCasas(G.N + CASAS.passo);
G.N = cfg.dur = Math.max(CASAS.min, Math.min(CASAS.max, cfg.dur || 40));
pintarCasas();
segment('#seg-start', () => G.starter, v => { G.starter = cfg.start = v; });
segment('#seg-graf', () => cfg.graficos, v => setGraficos(v));
segment('#seg-vel', () => cfg.testeVel, v => { cfg.testeVel = Number(v); });
segment('#seg-voz', () => cfg.vozNarradora, v => { cfg.vozNarradora = v; applyCfg(); voice.stop(); const was = voice.enabled; voice.enabled = true; voice.fala('inicio').then(() => { voice.enabled = was; }); });
setGraficos(cfg.graficos);

// ------------------------------------------------------------ tela de configurações
function bindRange(id, key, after) {
  const el = $(id); el.value = cfg[key];
  el.oninput = () => { cfg[key] = Number(el.value); applyCfg(); after?.(); saveCfg(); };
}
bindRange('#cfg-musica', 'musica');
bindRange('#cfg-efeitos', 'efeitos', () => audio.hop());
bindRange('#cfg-voz', 'voz');
$('#cfg-vibrar').checked = cfg.vibrar;
$('#cfg-vibrar').onchange = e => { cfg.vibrar = e.target.checked; saveCfg(); if (cfg.vibrar) vibrar(30); };
$('#cfg-narracao').checked = cfg.narracao;
$('#cfg-narracao').onchange = e => { cfg.narracao = e.target.checked; applyCfg(); saveCfg(); };
$('#btn-voz-teste').onclick = () => { voice.stop(); const was = voice.enabled; voice.enabled = true; voice.fala('inicio').then(() => { voice.enabled = was; }); };

// primeira vez: três passos rápidos (deslizar ou "Próximo"); não volta a aparecer
let apPasso = 0;
function apresentar() {
  if (store.get('apresentado', false)) return;
  apIr(0); show('#apresentacao');
}
function apIr(n) {
  apPasso = Math.max(0, Math.min(2, n));
  $('#ap-passos').style.transform = `translateX(${-apPasso * 100}%)`;
  document.querySelectorAll('#ap-pontos i').forEach((d, i) => d.classList.toggle('on', i === apPasso));
  $('#ap-proximo').classList.toggle('invisivel', apPasso === 2);
}
function apFechar() { store.set('apresentado', true); hide('#apresentacao'); }
$('#ap-proximo').onclick = () => apIr(apPasso + 1);
$('#ap-pular').onclick = apFechar;
$('#ap-fim').onclick = apFechar;
$('#ap-limites').onclick = () => { apFechar(); abrirLimites(); };
document.querySelectorAll('#ap-pontos i').forEach((d, i) => d.onclick = () => apIr(i));
{ // deslizar entre os passos no celular
  let x0 = null;
  $('#ap-passos').addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  $('#ap-passos').addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) apIr(apPasso + (dx < 0 ? 1 : -1)); x0 = null; });
}

// visitante: joga sem conta (com a nuvem ligada, nada é salvo nela até entrar)
let visitante = false;
function entrarComoVisitante() {
  visitante = true;
  auth.setPlano('gratuito'); aplicarPlano();
  hide('#lock');
  $('#btn-entrar-setup').classList.toggle('hidden', !auth.cloud);
  show('#setup');
  board.setMode('orbit');
  toast('Modo visitante: joguem à vontade');
  apresentar();
}
function renderConta() {
  const box = $('#conta');
  box.querySelector('#btn-entrar').classList.toggle('hidden', !(auth.cloud && !auth.session));
  const logged = auth.hasAccount() && auth.isLogged();
  box.querySelector('.conta-user').textContent = auth.cloud
    ? (auth.session ? `Conectado como ${auth.user()} (salvo na nuvem)` : 'Visitante: entre para salvar nomes, limites e cartas na nuvem.')
    : auth.hasAccount() ? `Conta local: ${auth.user()} (só neste aparelho)` : 'Sem senha: qualquer pessoa com este aparelho abre o jogo.';
  box.querySelector('#btn-proteger').classList.toggle('hidden', auth.cloud || auth.hasAccount());
  box.querySelector('#btn-senha').classList.toggle('hidden', !logged);
  box.querySelector('#btn-sair').classList.toggle('hidden', !logged);
  box.querySelector('#btn-apagar').classList.toggle('hidden', auth.cloud || !auth.hasAccount());
}
function openSettings() { renderConta(); aplicarPlano(); hide('#menu'); show('#settings'); }
$('#btn-settings').onclick = openSettings;
$('#btn-lembranca').onclick = () => G.noite && lembranca.guardar(G.noite).catch(() => toast('Não deu para salvar a imagem'));

// ------------------------------------------------------------ ritmo, limites e cartas do casal
segment('#seg-ritmo', () => cfg.ritmo, v => { cfg.ritmo = v; });
// (i) dos ajustes: explicação numa folha com o fundo borrado
const INFOS = {
  ritmo: { titulo: 'Ritmo', corpo: `
    <p class="lead">O ritmo decide <b>o que aparece</b> nas casas e <b>quando o clima esquenta</b>. Ele não muda o tamanho da partida.</p>
    <ul class="info-lista">
      <li><b>Romântico</b><span>Mais verdades e carícias. As fases quentes chegam mais tarde, sem pressa.</span></li>
      <li><b>Provocante</b><span>O equilíbrio entre conversa e ação. É o ritmo padrão.</span></li>
      <li><b>Intenso</b><span>Mais desafios, e o Fogo e o Clímax chegam mais cedo.</span></li>
    </ul>` },
  casas: { titulo: 'Casas no tabuleiro', corpo: `
    <p class="lead">As casas são os degraus da subida até o <b>Pico do Amor</b>. O número de casas decide <b>quanto tempo a noite dura</b>.</p>
    <ul class="info-lista">
      <li><b>Menos casas</b><span>Partida mais curta: com 20 casas, cerca de 25 minutos.</span></li>
      <li><b>Mais casas</b><span>Noite mais longa e com mais cartas: com 64 casas, cerca de 85 minutos.</span></li>
      <li><b>As cartas não mudam</b><span>Todas continuam no baralho e as 4 fases se espalham pelo tabuleiro inteiro. Só muda quanto tempo vocês passam em cada uma.</span></li>
    </ul>
    <p class="fine">A estimativa considera cerca de 3,5 casas por jogada e 1 a 2 minutos por carta.</p>` },
};
document.querySelectorAll('[data-info]').forEach(b => b.onclick = () => {
  const i = INFOS[b.dataset.info];
  $('#info-titulo').textContent = i.titulo;
  $('#info-corpo').innerHTML = i.corpo;
  show('#info');
});
function resumoNoite() {
  const n = limitesAtivos(cfg.limites).length, c = cfg.cartas.length, ativas = cfg.cartas.filter(x => x.ativa !== false).length;
  $('#limites-resumo').textContent = n ? `${n} ${n === 1 ? 'limite' : 'limites'} hoje` : 'Tudo liberado';
  $('#cartas-resumo').textContent = c ? `${ativas} ${ativas === 1 ? 'carta ativa' : 'cartas ativas'}` : podeUsar('premium') ? 'Criem as suas' : '✦ Premium';
}
function abrirLimites() {
  $('#limites-lista').innerHTML = LIMITES.map(l => `
    <label class="limite"><span><b>${l.nome}</b><small>${l.desc}</small></span>
      <span class="switch"><input type="checkbox" data-id="${l.id}" ${cfg.limites[l.id] === false ? '' : 'checked'}><i></i></span></label>`).join('');
  $('#limites-lista').querySelectorAll('input').forEach(i => i.onchange = () => {
    cfg.limites = { ...cfg.limites, [i.dataset.id]: i.checked };
    saveCfg(); resumoNoite();
  });
  hide('#menu'); show('#limites');
}
$('#btn-limites').onclick = abrirLimites;
$('#btn-limites-menu').onclick = abrirLimites;

// ------------------------------------------------------------ nossas cartas: criar e editar é Premium
// Cada carta diz quem faz e quem recebe; pode ter foto no lugar do ícone; liga e desliga sem apagar.
const NOVA = () => ({ tipo: 'verdade', f: 0, s: 0, faz: 'ambos', recebe: 'ambos', foto: null });
let nova = NOVA(), editando = null;
const nomeDe = g => $(`#name-${g}`).value.trim() || (g === 'ele' ? 'Ele' : 'Ela');
function quemTexto(c) {
  const p = paraQuem(c);
  if (!p) return 'Ninguém pode fazer: revise quem faz e quem recebe';
  return p === 'ambos' ? 'Os dois fazem · o par recebe' : `${nomeDe(p)} faz · ${nomeDe(other(p))} recebe`;
}
const tempoTexto = s => (s ? (s < 60 ? s + 's' : s / 60 + ' min') : '');
// com dois jogadores, ninguém faz e recebe ao mesmo tempo: "Ele faz" tira "Ele recebe", e vice-versa
function ajustarQuem(k) {
  if (k === 'faz' && nova.faz !== 'ambos' && nova.recebe === nova.faz) nova.recebe = other(nova.faz);
  if (k === 'recebe' && nova.recebe !== 'ambos' && nova.faz === nova.recebe) nova.faz = other(nova.recebe);
}
function pintarForm() {
  segSet('#seg-nc-tipo', nova.tipo); segSet('#seg-nc-fase', nova.f); segSet('#seg-nc-tempo', nova.s);
  segSet('#seg-nc-faz', nova.faz); segSet('#seg-nc-recebe', nova.recebe);
  const prev = $('#nc-foto-prev');
  prev.classList.toggle('com-foto', !!nova.foto);
  prev.style.backgroundImage = nova.foto ? `url(${nova.foto})` : `url(${iconURL(nova.tipo, 96)})`;
  $('#nc-foto-tirar').classList.toggle('hidden', !nova.foto);
  $('#nc-foto-btn').textContent = nova.foto ? 'Trocar foto' : 'Escolher foto';
  $('#nc-titulo').textContent = editando ? 'Editar carta' : 'Nova carta';
  $('#nc-ok').textContent = editando ? 'Salvar alterações' : 'Adicionar carta';
  $('#nc-cancelar').classList.toggle('hidden', !editando);
}
const segNova = (id, k, num) => document.querySelectorAll(`${id} button`).forEach(b => b.onclick = () => {
  nova[k] = num ? Number(b.dataset.v) : b.dataset.v; ajustarQuem(k); pintarForm();
});
segNova('#seg-nc-tipo', 'tipo'); segNova('#seg-nc-fase', 'f', true); segNova('#seg-nc-tempo', 's', true);
segNova('#seg-nc-faz', 'faz'); segNova('#seg-nc-recebe', 'recebe');

// foto: recorte quadrado no centro, 320 px em JPEG (leve para salvar no aparelho e na nuvem)
function lerFoto(file) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const S = 320, k = Math.min(img.naturalWidth, img.naturalHeight), cv = document.createElement('canvas');
      cv.width = cv.height = S;
      cv.getContext('2d').drawImage(img, (img.naturalWidth - k) / 2, (img.naturalHeight - k) / 2, k, k, 0, 0, S, S);
      URL.revokeObjectURL(url); res(cv.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('foto')); };
    img.src = url;
  });
}
$('#nc-foto-btn').onclick = () => $('#nc-foto').click();
$('#nc-foto').onchange = async e => {
  const f = e.target.files?.[0]; e.target.value = '';
  if (!f) return;
  try { nova.foto = await lerFoto(f); pintarForm(); } catch { toast('Não deu para abrir essa foto'); }
};
$('#nc-foto-tirar').onclick = () => { nova.foto = null; pintarForm(); };

function limparForm() { nova = NOVA(); editando = null; $('#nc-texto').value = ''; pintarForm(); }
$('#nc-cancelar').onclick = limparForm;
function editarCarta(id) {
  const c = cfg.cartas.find(x => x.id === id);
  if (!c || !podeUsar('premium')) return;
  editando = id;
  nova = { tipo: c.tipo, f: c.f, s: c.s, faz: c.faz, recebe: c.recebe, foto: c.foto ?? null };
  $('#nc-texto').value = c.t;
  pintarForm();
  $('#nova-carta').scrollIntoView({ block: 'start', behavior: 'smooth' });
  $('#nc-texto').focus({ preventScroll: true });
}
function listarCartas() {
  const premium = podeUsar('premium'), ul = $('#lista-cartas');
  $('#cartas-premium').classList.toggle('hidden', premium);
  $('#cartas').classList.toggle('so-premium', !premium && !cfg.cartas.length);
  $('#nova-carta').classList.toggle('hidden', !premium);
  $('#cartas .cartas-grid').classList.toggle('so-lista', !premium);
  $('#cartas .cartas-grid').classList.toggle('tem-cartas', cfg.cartas.length > 0);
  $('#cartas .do-casal').classList.toggle('hidden', !premium && !cfg.cartas.length);
  const ativas = cfg.cartas.filter(c => c.ativa !== false).length;
  $('#cartas-total').textContent = cfg.cartas.length ? `· ${ativas} de ${cfg.cartas.length} ativas` : '';
  ul.innerHTML = cfg.cartas.length ? '' : '<li class="vazio">Nenhuma ainda. As cartas que vocês criarem aparecem aqui, com destaque no jogo.</li>';
  for (const c of cfg.cartas) {
    const li = document.createElement('li');
    li.className = 'carta-casal' + (c.ativa === false ? ' off' : '');
    li.style.setProperty('--c', CATEGORIAS[c.tipo].cor);
    li.innerHTML = `<span class="mini-ico${c.foto ? ' foto' : ''}"></span>
      <div class="info"><span class="tag t-${c.tipo}">${CATEGORIAS[c.tipo].nome} · ${FASES[c.f].nome}${c.s ? ' · ' + tempoTexto(c.s) : ''}</span><p></p><small></small></div>
      <div class="acoes">
        <span class="switch" title="Ativa no baralho"><input type="checkbox" aria-label="Carta ativa" ${c.ativa === false ? '' : 'checked'}><i></i></span>
        ${premium ? '<button type="button" class="editar" aria-label="Editar carta"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg></button>' : ''}
        <button type="button" class="apagar" aria-label="Apagar carta"><svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/></svg></button>
      </div>`;
    li.querySelector('.mini-ico').style.backgroundImage = `url(${c.foto || iconURL(c.tipo, 96)})`;
    li.querySelector('p').textContent = c.t;
    li.querySelector('small').textContent = quemTexto(c);
    li.querySelector('input').onchange = e => {
      c.ativa = e.target.checked; li.classList.toggle('off', !c.ativa);
      saveCfg(); resumoNoite();
      $('#cartas-total').textContent = `· ${cfg.cartas.filter(x => x.ativa !== false).length} de ${cfg.cartas.length} ativas`;
    };
    li.querySelector('.editar')?.addEventListener('click', () => editarCarta(c.id));
    li.querySelector('.apagar').onclick = () => {
      if (!confirm('Apagar esta carta? Para tirar só desta noite, é só desligar.')) return;
      cfg.cartas = cfg.cartas.filter(x => x.id !== c.id);
      if (editando === c.id) limparForm();
      saveCfg(); listarCartas(); resumoNoite();
    };
    ul.append(li);
  }
}
document.querySelectorAll('.mc-ico[data-t]').forEach(el => { el.style.backgroundImage = `url(${iconURL(el.dataset.t, 96)})`; });
$('#btn-quero-premium').onclick = () => toast('O Premium chega em breve. Vocês vão ser os primeiros a saber.', 3200);
$('#btn-cartas').onclick = () => { limparForm(); listarCartas(); show('#cartas'); };
$('#nova-carta').onsubmit = e => {
  e.preventDefault();
  if (!podeUsar('premium')) return toast('Criar cartas é um recurso Premium');
  const t = $('#nc-texto').value.trim().replace(/\s+/g, ' ');
  if (t.length < 6) { $('#nc-texto').focus(); return toast('Escreva a carta primeiro'); }
  const dados = { t, tipo: nova.tipo, f: nova.f, s: nova.s, faz: nova.faz, recebe: nova.recebe };
  const comFoto = c => { const { foto, ...resto } = c; return nova.foto ? { ...resto, foto: nova.foto } : resto; };
  if (editando) cfg.cartas = cfg.cartas.map(c => (c.id === editando ? comFoto({ ...c, ...dados }) : c));
  else cfg.cartas = [comFoto({ id: Date.now().toString(36) + rnd(1e6).toString(36), ativa: true, ...dados }), ...cfg.cartas];
  toast(editando ? 'Carta atualizada' : 'Carta adicionada ao baralho');
  limparForm();
  saveCfg(); listarCartas(); resumoNoite();
};
pintarForm();
resumoNoite();

// ------------------------------------------------------------ dado: escolher a pedra é Premium
function aplicarGema() {
  const k = podeUsar('premium') && GEMAS[cfg.gema] ? cfg.gema : 'rubi';
  dice.setGema(k); setPedra(k);
  if (!G.players.ele) $('#btn-roll .die-ico').innerHTML = pedraSVG();
}
function desenharGemas() {
  const premium = podeUsar('premium'), atual = premium ? cfg.gema : 'rubi';
  $('#gemas').innerHTML = Object.entries(GEMAS).map(([k, g]) =>
    `<button type="button" role="radio" data-v="${k}" aria-checked="${k === atual}" class="${k === atual ? 'on' : ''}"${!premium && k !== 'rubi' ? ' disabled' : ''}>${pedraSVG('', k)}<small>${g.nome}</small></button>`).join('');
  $('#gemas').querySelectorAll('button').forEach(b => b.onclick = () => { cfg.gema = b.dataset.v; aplicarGema(); saveCfg(); desenharGemas(); });
  $('#dado-premium').classList.toggle('hidden', premium);
  $('#grupo-dado').classList.toggle('bloqueado', !premium);
}

// ------------------------------------------------------------ plano na interface
function aplicarPlano() {
  const admin = ehAdmin();
  $('#dev').classList.toggle('hidden', !admin);
  if (admin) $('#cfg-vercomo').checked = planoEfetivo() === 'gratuito';
  else ['#catalogo'].forEach(hide);
  $('#plano-nome').textContent = nomePlano(auth.plano) + (admin && planoEfetivo() !== 'admin' ? ` · vendo como ${nomePlano(planoEfetivo())}` : '');
  resumoNoite(); aplicarGema(); desenharGemas();
  if (visible('#cartas')) listarCartas();
}
$('#cfg-vercomo').onchange = e => {
  if (!ehAdmin()) return;
  store.set('ver-como', e.target.checked ? 'gratuito' : 'admin');
  aplicarPlano();
  toast(e.target.checked ? 'Vendo o jogo como gratuito' : 'De volta ao modo admin');
};

// ------------------------------------------------------------ desenvolvedor (só admin): todas as cartas, ligar/desligar uma a uma
const ABAS = [['verdade', 'Verdades'], ['desafio', 'Desafios'], ['pena', 'Penas'], ['armadilha', 'Armadilhas'], ['sorte', 'Sortes'], ['desejo', 'Desejos'], ['nossas', 'Do casal']];
let catAba = 'verdade';
const legivel = t => t.replace(/\{par\}/g, 'seu par').replace(/\{eu\}/g, 'você').replace(/\{(?:par:)?([^|{}]*)\|([^{}]*)\}/g, '$1/$2');
// desligadas: as padrão ficam em cfg.desligadas; as do casal, no próprio "ativa"
const desligadasAgora = () => new Set([...cfg.desligadas, ...cfg.cartas.filter(c => c.ativa === false).map(c => c.id)]);
function resumoCatalogo() {
  const n = cfg.desligadas.length;
  $('#catalogo-resumo').textContent = n ? `· ${n} ${n === 1 ? 'desligada' : 'desligadas'}` : '';
}
function abrirCatalogo() {
  if (!ehAdmin()) return;
  $('#cat-busca').value = '';
  ['#settings', '#limites', '#menu'].forEach(hide);
  desenharCatalogo(); show('#catalogo');
}
function desenharCatalogo() {
  const cat = catalogo(cfg), off = desligadasAgora(), busca = $('#cat-busca').value.trim().toLowerCase();
  if (catAba === 'nossas' && !cat.nossas.length) catAba = 'verdade';
  $('#cat-abas').innerHTML = ABAS.filter(([k]) => k !== 'nossas' || cat.nossas.length).map(([k, nome]) => {
    const l = cat[k], ligadas = l.filter(c => !off.has(c.id)).length;
    return `<button role="tab" data-k="${k}" class="${k === catAba ? 'on' : ''}">${nome}<small>${ligadas}/${l.length}</small></button>`;
  }).join('');
  $('#cat-abas').querySelectorAll('button').forEach(b => b.onclick = () => { catAba = b.dataset.k; desenharCatalogo(); });
  const lista = cat[catAba].filter(c => !busca || legivel(c.t).toLowerCase().includes(busca));
  const contar = () => {
    const offAgora = desligadasAgora(), toda = catalogo(cfg)[catAba];
    $('#cat-contagem').textContent = `${lista.filter(c => !offAgora.has(c.id)).length} de ${lista.length} ligadas`;
    const sm = $(`#cat-abas [data-k="${catAba}"] small`); if (sm) sm.textContent = `${toda.filter(c => !offAgora.has(c.id)).length}/${toda.length}`;
  };
  let fase = -1, html = '';
  for (const c of lista) {
    if (c.f !== null && c.f !== fase) { fase = c.f; html += `<h4>${FASES[c.f].nome}</h4>`; }
    const meta = [c.nossa && `do casal · ${CATEGORIAS[c.tipo].nome}`, c.p !== 'ambos' && `só quando ${c.p} joga`, c.s && tempoTexto(c.s), c.limite && 'fora pelos limites de hoje', alternativa(c.t) && 'mostra alternativa de acessório'].filter(Boolean).join(' · ');
    html += `<label class="cat-carta${off.has(c.id) ? ' off' : ''}${c.limite ? ' limite' : ''}${c.nossa ? ' nossa' : ''}"><span><p></p>${meta ? `<small>${meta}</small>` : ''}</span>
      <span class="switch"><input type="checkbox" data-id="${c.id}" ${off.has(c.id) ? '' : 'checked'}><i></i></span></label>`;
  }
  const el = $('#cat-lista');
  el.innerHTML = html || '<p class="lead">Nenhuma carta encontrada.</p>';
  el.querySelectorAll('.cat-carta p').forEach((p, i) => { p.textContent = legivel(lista[i].t); });
  el.querySelectorAll('input').forEach(i => i.onchange = () => {
    const nossa = cfg.cartas.find(c => c.id === i.dataset.id);
    if (nossa) nossa.ativa = i.checked;
    else cfg.desligadas = i.checked ? cfg.desligadas.filter(x => x !== i.dataset.id) : [...new Set([...cfg.desligadas, i.dataset.id])];
    i.closest('.cat-carta').classList.toggle('off', !i.checked);
    saveCfg(); resumoCatalogo(); resumoNoite(); contar();
  });
  contar();
}
$('#cat-busca').oninput = desenharCatalogo;
$('#cat-ligar').onclick = () => {
  if (catAba === 'nossas') cfg.cartas.forEach(c => { c.ativa = true; });
  const ids = new Set(catalogo(cfg)[catAba].map(c => c.id));
  cfg.desligadas = cfg.desligadas.filter(x => !ids.has(x));
  saveCfg(); resumoCatalogo(); resumoNoite(); desenharCatalogo();
};
$('#btn-catalogo').onclick = abrirCatalogo;
resumoCatalogo();
$('#btn-settings-menu').onclick = openSettings;
$('#btn-proteger').onclick = () => { hide('#settings'); openLock('criar'); };
$('#btn-sair').onclick = async () => { await auth.logout(); aplicarPlano(); hide('#settings'); hide('#hud'); hide('#setup'); openLock('entrar'); };
$('#btn-apagar').onclick = () => { if (confirm('Apagar a conta e os dados salvos neste aparelho?')) { auth.removeLocal(); store.clearAll(); location.reload(); } };
$('#btn-senha').onclick = () => $('#troca-senha').classList.toggle('hidden');
$('#troca-senha').onsubmit = async e => {
  e.preventDefault();
  const a = $('#ts-atual').value, n = $('#ts-nova').value;
  if (n.length < 6) return toast('A nova senha precisa ter pelo menos 6 caracteres');
  const err = await auth.changePassword(a, n);
  toast(err || 'Senha alterada');
  if (!err) { e.target.reset(); e.target.classList.add('hidden'); }
};
$('#btn-teste').onclick = () => { if (!ehAdmin()) return; hide('#settings'); startGame(true); };
$('#test-badge button').onclick = stopTest;

// ------------------------------------------------------------ tela de login
let lockMode = 'entrar';
function openLock(mode) {
  lockMode = mode;
  const criar = mode === 'criar';
  $('#lock h2').textContent = criar ? 'Criar conta' : 'Entrar';
  $('#lk-user').placeholder = auth.cloud ? 'E-mail' : 'Usuário';
  $('#lk-user').type = auth.cloud ? 'email' : 'text';
  $('#lk-pass2').classList.toggle('hidden', !criar);
  $('#lk-lembrar').parentElement.classList.toggle('hidden', auth.cloud || criar);
  $('#lk-ok').textContent = criar ? 'Criar conta' : 'Entrar';
  $('#lk-troca').textContent = criar ? 'Já tenho conta' : 'Criar uma conta';
  $('#lk-troca').classList.toggle('hidden', !auth.cloud && auth.hasAccount() && !criar);
  $('#lk-esqueci').classList.toggle('hidden', criar);
  ['#lk-convidado', '#lock .ou'].forEach(q => $(q).classList.toggle('hidden', criar));
  $('#lk-msg').textContent = auth.cloud ? '' : 'Conta local: fica salva só neste aparelho.';
  $('#lk-user').value = criar ? '' : auth.user();
  ['#setup', '#hud'].forEach(hide);
  show('#lock');
}
$('#lk-troca').onclick = () => openLock(lockMode === 'criar' ? 'entrar' : 'criar');
$('#lk-convidado').onclick = () => entrarComoVisitante();
$('#btn-entrar').onclick = () => { hide('#settings'); openLock('entrar'); };
$('#btn-entrar-setup').onclick = () => openLock('entrar');
$('#lk-esqueci').onclick = async () => {
  if (!auth.cloud) {
    if (confirm('Na conta local não existe recuperação. Apagar a conta e os dados deste aparelho para começar de novo?')) { auth.removeLocal(); store.clearAll(); location.reload(); }
    return;
  }
  const email = $('#lk-user').value;
  if (!email) return ($('#lk-msg').textContent = 'Digite seu e-mail acima.');
  $('#lk-msg').textContent = await auth.reset(email);
};
// login no celular: "Próximo" vai para a senha, olho mostra a senha, e o campo em foco fica visível acima do teclado
$('#lk-user').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#lk-pass').focus(); } });
$('#lk-olho').onclick = () => {
  const ver = $('#lk-pass').type === 'password';
  for (const id of ['#lk-pass', '#lk-pass2']) $(id).type = ver ? 'text' : 'password';
  $('#lk-olho').classList.toggle('on', ver);
  $('#lk-olho').setAttribute('aria-label', ver ? 'Esconder senha' : 'Mostrar senha');
};
document.addEventListener('focusin', e => {
  if (!e.target.matches('input, textarea')) return;
  setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 320);
});
if (window.visualViewport) {
  const teclado = () => document.documentElement.classList.toggle('teclado', visualViewport.height < window.innerHeight * 0.78);
  visualViewport.addEventListener('resize', teclado);
}
$('#lock form').onsubmit = async e => {
  e.preventDefault();
  const u = $('#lk-user').value.trim(), s1 = $('#lk-pass').value, s2 = $('#lk-pass2').value;
  const m = $('#lk-msg');
  if (!u || !s1) return (m.textContent = 'Preencha os campos.');
  if (lockMode === 'criar') {
    if (s1.length < 6) return (m.textContent = 'A senha precisa ter pelo menos 6 caracteres.');
    if (s1 !== s2) return (m.textContent = 'As senhas não conferem.');
  }
  $('#lk-ok').disabled = true;
  const err = lockMode === 'criar' ? await auth.create(u, s1) : await auth.login(u, s1, $('#lk-lembrar').checked);
  $('#lk-ok').disabled = false;
  if (err || !auth.isLogged()) { m.textContent = err; if (lockMode === 'criar' && err && !auth.isLogged()) openLock('entrar'), (m.textContent = err); return; }
  e.target.reset();
  await afterLogin();
};

async function afterLogin() {
  visitante = false;
  $('#btn-entrar-setup').classList.add('hidden');
  hide('#lock');
  const prof = await auth.loadProfile().catch(() => null);
  // o plano vem do banco; sem conexão, vale o último conhecido desta conta
  auth.setPlano(prof?.plano ?? auth.planoSalvo());
  auth.guardarPlano();
  if (prof) {
    Object.assign(cfg, prof.config ?? {});
    normalizarCartas();
    store.set('cfg', cfg);
    if (prof.nome_ele) $('#name-ele').value = prof.nome_ele;
    if (prof.nome_ela) $('#name-ela').value = prof.nome_ela;
    applyCfg(); setGraficos(cfg.graficos);
    G.N = cfg.dur = Math.max(CASAS.min, Math.min(CASAS.max, cfg.dur || 40)); G.starter = cfg.start; pintarCasas(); segSet('#seg-start', G.starter); segSet('#seg-ritmo', cfg.ritmo);
    $('#cfg-vibrar').checked = cfg.vibrar; resumoCatalogo();
    pintarInicio();
  }
  aplicarPlano();
  show('#setup');
  board.setMode('orbit');
  apresentar();
}

// ------------------------------------------------------------ navegação
const toSetup = () => {
  manterTelaAcesa(false);
  ['#menu', '#final', '#hud', '#settings'].forEach(hide); show('#setup'); board.setMode('orbit'); voice.stop(); TESTE.on = false; board.speed = dice.speed = 1;
  window.dispatchEvent(new Event('nad:inicio')); // depois de sair do jogo: o aviso de versão nova pode aparecer
};
const [sn1, sn2] = store.get('names', ['', '']);
$('#name-ele').value = sn1; $('#name-ela').value = sn2;
pintarInicio();
$('#btn-start').onclick = () => startGame(false);
$('#btn-roll').onclick = roll;
$('#btn-rules').onclick = () => show('#rules');
$('#btn-show-rules').onclick = () => { hide('#menu'); show('#rules'); };
$('#btn-menu').onclick = () => show('#menu');
$('#btn-restart').onclick = toSetup;
$('#btn-again').onclick = toSetup;
$('#btn-map').onclick = () => {
  const on = board.mode !== 'overview';
  board.setMode(on ? 'overview' : 'follow');
  $('#btn-map').classList.toggle('on', on);
};
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => hideEl(b.closest('.screen')));
window.addEventListener('keydown', e => { if (e.code === 'Space' && visible('#hud') && !visible('#card') && !TESTE.on) roll(); });
// o áudio só pode começar depois de um toque
window.addEventListener('pointerdown', () => { audio.start().then(applyCfg); voice.unlock(); }, { once: true });

// ------------------------------------------------------------ inicialização
document.querySelectorAll('.ci').forEach(el => { el.style.backgroundImage = `url(${iconURL(el.dataset.t, 64)})`; });
Promise.all(['italic 700 40px "Playfair Display"', '700 40px "Playfair Display"', '40px "Great Vibes"', '20px "Inter"'].map(f => document.fonts.load(f))).catch(() => {}).finally(() => {
  G.tiles = generateBoard(G.N);
  board.build(G.tiles);
  board.setMode('orbit');
  window.progresso?.(0.9, 'Lapidando o dado…');
  // espera o tabuleiro desenhar os primeiros quadros
  requestAnimationFrame(() => requestAnimationFrame(etapaPronta));
});
// a abertura só sai quando o tabuleiro desenhou E a tela (login ou início) já está montada;
// e sai de qualquer jeito se o 3D demorar ou falhar
let etapas = 2;
function etapaPronta() { if (--etapas <= 0) ready(); }
function ready() {
  if (document.body.classList.contains('ready')) return;
  window.progresso?.(1, 'Pronto');
  setTimeout(() => {
    document.body.classList.add('ready');
    setTimeout(() => $('#splash')?.remove(), 1100);
  }, 250);
}
setTimeout(ready, 8000);
auth.init().then(async () => {
  if (auth.isLogged()) {
    if (auth.cloud) await afterLogin();
    else { auth.setPlano(auth.planoSalvo()); aplicarPlano(); show('#setup'); }
  }
  else openLock('entrar');
}).finally(etapaPronta);
window.__G = G; window.__B = board; window.__D = dice; // depuração
