// Regras, fluxo de turnos, interface, configurações, conta, modo de teste, narração e música.
import { Board3D } from './scene.js';
import { DiceStage } from './dice.js';
import { FASES, CATEGORIAS } from './data.js';
import { LIMITES, limitesAtivos, baralho, armadilhas, sortes, desejos, faseDaCasa, pesoNoRitmo } from './cartas.js';
import * as lembranca from './lembranca.js';
import { iconURL } from './icons.js';
import { $, wait, rnd, shuffle, store } from './util.js';
import { GameAudio } from './audio.js';
import { Narrator } from './voice.js';
import { auth } from './auth.js';

// ------------------------------------------------------------ configurações (salvas no aparelho e na nuvem)
const CFG_DEFAULT = { musica: 0.6, efeitos: 0.7, voz: 1, narracao: true, vibrar: true, graficos: 'auto', dur: 40, start: 'ela', ritmo: 'provocante', testeVel: 2, limites: {}, cartas: [] };
const cfg = { ...CFG_DEFAULT, ...store.get('cfg', {}) };
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
function draw(key, list, gender) {
  const ok = list.filter(c => !c.p || c.p === 'ambos' || c.p === gender);
  let seen = used.get(key) ?? new Set();
  let free = ok.filter(c => !seen.has(c));
  if (!free.length) { seen = new Set(); free = ok; }
  const card = free[rnd(free.length)];
  seen.add(card); used.set(key, seen);
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
const refreshThrottle = () => board.setThrottle(OVERLAYS.some(visible));
new MutationObserver(refreshThrottle).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });

// Mostra uma carta e devolve 'feito' | 'recusou'
function showCard({ cat, text, secs = 0, who, fase, refusable = true, falar = true }) {
  return new Promise(resolve => {
    const card = $('#card .card');
    card.style.setProperty('--c', cat.cor);
    const tipo = Object.keys(CATEGORIAS).find(k => CATEGORIAS[k] === cat);
    $('#card .ico').style.backgroundImage = `url(${iconURL(tipo, 160)}), linear-gradient(145deg, rgba(255,255,255,.28), rgba(255,255,255,.06))`;
    $('#card .cat').textContent = cat.nome;
    $('#card .fase-tag').textContent = FASES[fase].nome;
    $('#card .card-who').innerHTML = `Para <b style="color:var(--${who})">${G.players[who].name}</b>`;
    $('#card .card-text').textContent = text;
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
      clearInterval(iv); clearTimeout(autoT); hide('#card'); voice.stop();
      if (r === 'feito') { G.diario.feitas++; if (falar) talvez(fase < 2 ? 'suave' : 'quente', 0.5); }
      else G.diario.recusadas++;
      resolve(r);
    };
    $('#btn-done').onclick = () => done('feito');
    refuse.onclick = () => done('recusou');
    card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
    show('#card');
    audio.card();
    if (falar) fala(tipo);
    if (TESTE.on) autoT = setTimeout(() => done(refusable && Math.random() < 0.12 ? 'recusou' : 'feito'), 1800 / TESTE.vel);
  });
}

// ------------------------------------------------------------ 3D, dado e qualidade
const board = new Board3D($('#stage'));
const dice = new DiceStage($('#dice-layer'));
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
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});

// ------------------------------------------------------------ fluxo da partida
function startGame(teste = false) {
  TESTE.on = teste; TESTE.vel = teste ? cfg.testeVel : 1;
  board.speed = dice.speed = TESTE.on ? TESTE.vel : 1;
  const nEle = teste ? 'Ele (teste)' : $('#name-ele').value.trim() || 'Ele';
  const nEla = teste ? 'Ela (teste)' : $('#name-ela').value.trim() || 'Ela';
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
  $('#test-badge').classList.toggle('hidden', !TESTE.on);
  $('#test-badge b').textContent = `Modo de teste · ${TESTE.vel}×`;
  updateHUD();
  toast(`${G.players[G.turn].name} começa a noite…`);
  fala('inicio');
  fala('comeca');
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
  board.placeDie(v, who);
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
    const card = draw(tile.tipo + f, baralho(tile.tipo, f, cfg), who);
    G.diario[tile.tipo]++;
    const r = await showCard({ cat, text: fill(card.t, who), secs: card.s, who, fase: f });
    if (r === 'recusou') await refusePenalty(who);
    return false;
  }

  if (tile.tipo === 'armadilha') {
    audio.trap();
    const card = draw('armadilha', armadilhas(cfg.limites), who);
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
    const card = draw('sorte', sortes(cfg.limites), who);
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
  const opts = shuffle(desejos(winner, cfg.limites)).slice(0, 3);
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
segment('#seg-dur', () => G.N, v => { G.N = cfg.dur = Number(v); });
segment('#seg-start', () => G.starter, v => { G.starter = cfg.start = v; });
segment('#seg-graf', () => cfg.graficos, v => setGraficos(v));
segment('#seg-vel', () => cfg.testeVel, v => { cfg.testeVel = Number(v); });
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

function renderConta() {
  const box = $('#conta');
  const logged = auth.hasAccount() && auth.isLogged();
  box.querySelector('.conta-user').textContent = auth.cloud
    ? (auth.session ? `Conectado como ${auth.user()} (salvo na nuvem)` : 'Sem login')
    : auth.hasAccount() ? `Conta local: ${auth.user()} (só neste aparelho)` : 'Sem senha: qualquer pessoa com este aparelho abre o jogo.';
  box.querySelector('#btn-proteger').classList.toggle('hidden', auth.cloud || auth.hasAccount());
  box.querySelector('#btn-senha').classList.toggle('hidden', !logged);
  box.querySelector('#btn-sair').classList.toggle('hidden', !logged);
  box.querySelector('#btn-apagar').classList.toggle('hidden', auth.cloud || !auth.hasAccount());
}
function openSettings() { renderConta(); hide('#menu'); show('#settings'); }
$('#btn-settings').onclick = openSettings;
$('#btn-lembranca').onclick = () => G.noite && lembranca.guardar(G.noite).catch(() => toast('Não deu para salvar a imagem'));

// ------------------------------------------------------------ ritmo, limites e cartas do casal
segment('#seg-ritmo', () => cfg.ritmo, v => { cfg.ritmo = v; });
function resumoNoite() {
  const n = limitesAtivos(cfg.limites).length, c = cfg.cartas.length;
  $('#limites-resumo').textContent = n ? `${n} ${n === 1 ? 'limite' : 'limites'} hoje` : 'Tudo liberado';
  $('#cartas-resumo').textContent = c ? `${c} ${c === 1 ? 'carta' : 'cartas'} de vocês` : 'Criem as suas';
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

const nova = { tipo: 'verdade', f: 0, s: 0 };
const segLocal = (id, k, num) => {
  segSet(id, nova[k]);
  document.querySelectorAll(`${id} button`).forEach(b => b.onclick = () => { nova[k] = num ? Number(b.dataset.v) : b.dataset.v; segSet(id, nova[k]); });
};
segLocal('#seg-nc-tipo', 'tipo'); segLocal('#seg-nc-fase', 'f', true); segLocal('#seg-nc-tempo', 's', true);
function listarCartas() {
  const ul = $('#lista-cartas');
  $('#cartas-total').textContent = cfg.cartas.length ? `· ${cfg.cartas.length}` : '';
  ul.innerHTML = cfg.cartas.length ? '' : '<li class="vazio">Nenhuma ainda. As cartas de vocês aparecem aqui.</li>';
  cfg.cartas.forEach((c, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="tag t-${c.tipo}">${c.tipo === 'verdade' ? 'Verdade' : 'Desafio'} · ${FASES[c.f].nome}${c.s ? ' · ' + (c.s < 60 ? c.s + 's' : c.s / 60 + ' min') : ''}</span><p></p><button type="button" aria-label="Apagar carta">×</button>`;
    li.querySelector('p').textContent = c.t;
    li.querySelector('button').onclick = () => { cfg.cartas = cfg.cartas.filter((_, j) => j !== i); saveCfg(); listarCartas(); resumoNoite(); };
    ul.append(li);
  });
}
$('#btn-cartas').onclick = () => { listarCartas(); show('#cartas'); };
$('#nova-carta').onsubmit = e => {
  e.preventDefault();
  const t = $('#nc-texto').value.trim().replace(/\s+/g, ' ');
  if (t.length < 6) return toast('Escreva a carta primeiro');
  cfg.cartas = [{ t, tipo: nova.tipo, f: nova.f, s: nova.s }, ...cfg.cartas];
  $('#nc-texto').value = '';
  saveCfg(); listarCartas(); resumoNoite();
  toast('Carta adicionada ao baralho');
};
resumoNoite();
$('#btn-settings-menu').onclick = openSettings;
$('#btn-proteger').onclick = () => { hide('#settings'); openLock('criar'); };
$('#btn-sair').onclick = async () => { await auth.logout(); hide('#settings'); hide('#hud'); hide('#setup'); openLock('entrar'); };
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
$('#btn-teste').onclick = () => { hide('#settings'); startGame(true); };
$('#btn-teste-setup').onclick = () => startGame(true);
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
  $('#lk-msg').textContent = auth.cloud ? '' : 'Conta local: fica salva só neste aparelho.';
  $('#lk-user').value = criar ? '' : auth.user();
  ['#setup', '#hud'].forEach(hide);
  show('#lock');
}
$('#lk-troca').onclick = () => openLock(lockMode === 'criar' ? 'entrar' : 'criar');
$('#lk-esqueci').onclick = async () => {
  if (!auth.cloud) {
    if (confirm('Na conta local não existe recuperação. Apagar a conta e os dados deste aparelho para começar de novo?')) { auth.removeLocal(); store.clearAll(); location.reload(); }
    return;
  }
  const email = $('#lk-user').value;
  if (!email) return ($('#lk-msg').textContent = 'Digite seu e-mail acima.');
  $('#lk-msg').textContent = await auth.reset(email);
};
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
  hide('#lock');
  const prof = await auth.loadProfile().catch(() => null);
  if (prof) {
    Object.assign(cfg, prof.config ?? {});
    store.set('cfg', cfg);
    if (prof.nome_ele) $('#name-ele').value = prof.nome_ele;
    if (prof.nome_ela) $('#name-ela').value = prof.nome_ela;
    applyCfg(); setGraficos(cfg.graficos);
    G.N = cfg.dur; G.starter = cfg.start; segSet('#seg-dur', G.N); segSet('#seg-start', G.starter); segSet('#seg-ritmo', cfg.ritmo);
    $('#cfg-vibrar').checked = cfg.vibrar; resumoNoite();
  }
  show('#setup');
  board.setMode('orbit');
}

// ------------------------------------------------------------ navegação
const toSetup = () => { ['#menu', '#final', '#hud', '#settings'].forEach(hide); show('#setup'); board.setMode('orbit'); voice.stop(); TESTE.on = false; board.speed = dice.speed = 1; };
const [sn1, sn2] = store.get('names', ['', '']);
$('#name-ele').value = sn1; $('#name-ela').value = sn2;
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
  // espera o tabuleiro desenhar os primeiros quadros e dissolve a abertura
  requestAnimationFrame(() => requestAnimationFrame(ready));
});
// a abertura sai de qualquer jeito, mesmo se o 3D demorar ou falhar
function ready() {
  if (document.body.classList.contains('ready')) return;
  document.body.classList.add('ready');
  setTimeout(() => $('#splash')?.remove(), 1200);
}
setTimeout(ready, 8000);
auth.init().then(() => {
  if (auth.isLogged()) { if (auth.cloud) afterLogin(); else show('#setup'); }
  else openLock(auth.cloud && !auth.session ? 'entrar' : 'entrar');
});
window.__G = G; window.__B = board; window.__D = dice; // depuração
