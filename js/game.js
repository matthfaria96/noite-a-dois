// Regras, fluxo de turnos e interface.
import { Board3D } from './scene.js';
import { FASES, CATEGORIAS, VERDADE, DESAFIO, PENA, ARMADILHA, SORTE, DESEJOS } from './data.js';
import { iconURL } from './icons.js';

const $ = s => document.querySelector(s);
const wait = ms => new Promise(r => setTimeout(r, ms));
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('nad:' + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('nad:' + k, JSON.stringify(v)); } catch {} },
};

// ------------------------------------------------------------ som (WebAudio, sem arquivos)
let ac;
function beep(freq = 440, dur = 0.08, type = 'sine', vol = 0.08) {
  try {
    ac ??= new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
  } catch {}
}
const sfx = {
  roll() { for (let i = 0; i < 7; i++) setTimeout(() => beep(900 + rnd(500), 0.05, 'sine', 0.025), i * 120); },
  hop() { beep(196, 0.18, 'sine', 0.05); },
  card() { beep(392, 0.5, 'sine', 0.05); setTimeout(() => beep(587, 0.7, 'sine', 0.04), 140); },
  trap() { beep(98, 0.6, 'triangle', 0.07); },
  win() { [294, 370, 440, 587].forEach((f, i) => setTimeout(() => beep(f, 0.9, 'sine', 0.06), i * 220)); },
};

// ------------------------------------------------------------ tabuleiro
function generateBoard(N) {
  const tiles = [{ tipo: 'inicio', fase: 0 }];
  let prev = null;
  for (let i = 1; i < N - 1; i++) {
    const fase = Math.min(3, Math.floor((i / (N - 1)) * 4));
    const pool = Object.entries(CATEGORIAS).filter(([k]) =>
      k !== prev && !(k === 'armadilha' && i < 3) && !(k === 'sorte' && prev === 'armadilha'));
    const total = pool.reduce((s, [, c]) => s + c.peso[fase], 0);
    let r = Math.random() * total, tipo = pool[0][0];
    for (const [k, cat] of pool) { r -= cat.peso[fase]; if (r <= 0) { tipo = k; break; } }
    tiles.push({ tipo, fase });
    prev = tipo;
  }
  tiles.push({ tipo: 'fim', fase: 3 });
  return tiles;
}

// ------------------------------------------------------------ baralhos sem repetição
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
const G = {
  N: store.get('dur', 40),
  starter: store.get('start', 'ela'),
  players: {},
  turn: 'ela',
  busy: false,
  tiles: [],
};
const other = g => (g === 'ele' ? 'ela' : 'ele');

function fill(text, who) {
  const me = G.players[who], par = G.players[other(who)];
  return text
    .replace(/\{par:([^|{}]*)\|([^{}]*)\}/g, (_, m, f) => (par.g === 'ele' ? m : f))
    .replace(/\{([^|{}:]*)\|([^{}]*)\}/g, (_, m, f) => (me.g === 'ele' ? m : f))
    .replaceAll('{eu}', me.name)
    .replaceAll('{par}', par.name);
}

// ------------------------------------------------------------ UI helpers
function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }
let toastT;
function toast(msg, ms = 2200) {
  const t = $('#toast'); t.textContent = msg; show('#toast');
  clearTimeout(toastT); toastT = setTimeout(() => hide('#toast'), ms);
}
function bigNumber(n) {
  const el = $('#big-number'); el.textContent = n;
  el.classList.remove('hidden'); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  setTimeout(() => el.classList.add('hidden'), 900);
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
  $('#btn-roll').disabled = G.busy;
}

// Mostra uma carta e devolve 'feito' | 'recusou'
function showCard({ cat, text, secs = 0, who, fase, refusable = true }) {
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

    // cronômetro
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
        iv = setInterval(() => {
          const left = Math.max(0, secs - (Date.now() - t0) / 1000);
          fg.style.strokeDashoffset = C * (1 - left / secs);
          lbl.textContent = Math.ceil(left) + 's';
          if (left <= 0) { clearInterval(iv); iv = null; lbl.textContent = '⏰'; beep(880, 0.4, 'triangle', 0.1); }
        }, 200);
      };
    }
    const done = r => { clearInterval(iv); hide('#card'); resolve(r); };
    $('#btn-done').onclick = () => done('feito');
    refuse.onclick = () => done('recusou');
    // a carta "vira" de novo a cada exibição
    card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
    show('#card');
    sfx.card();
  });
}

// ------------------------------------------------------------ fluxo
const board = new Board3D($('#stage'));

function startGame() {
  const nEle = $('#name-ele').value.trim() || 'Ele';
  const nEla = $('#name-ela').value.trim() || 'Ela';
  store.set('names', [nEle, nEla]);
  G.players = {
    ele: { g: 'ele', name: nEle, pos: 0, skip: false, passe: 0 },
    ela: { g: 'ela', name: nEla, pos: 0, skip: false, passe: 0 },
  };
  G.turn = G.starter === 'sorte' ? (Math.random() < 0.5 ? 'ele' : 'ela') : G.starter;
  G.tiles = generateBoard(G.N);
  used.clear();
  G.busy = false;
  board.build(G.tiles);
  board.focus(G.turn);
  board.setMode('follow');
  $('#btn-map').classList.remove('on');
  hide('#setup'); hide('#final'); hide('#menu');
  show('#hud');
  updateHUD();
  toast(`${G.players[G.turn].name} começa a noite…`);
}

async function move(who, to) {
  const p = G.players[who];
  to = Math.max(0, Math.min(G.N - 1, to));
  if (to === p.pos) return;
  await board.movePiece(who, p.pos, to, () => sfx.hop());
  p.pos = to;
  updateHUD();
}

async function roll() {
  if (G.busy) return;
  G.busy = true; updateHUD();
  board.setMode('follow'); $('#btn-map').classList.remove('on');
  const who = G.turn, p = G.players[who];
  const v = 1 + rnd(6);
  sfx.roll();
  await board.rollDie(v, who);
  bigNumber(v);
  await wait(350);
  board.hideDie();
  await move(who, p.pos + v);
  if (p.pos >= G.N - 1) return finish(who);
  await wait(250);
  const again = await resolveTile(who);
  if (p.pos >= G.N - 1) return finish(who);
  endTurn(again);
}

async function refusePenalty(who) {
  const p = G.players[who];
  if (p.passe) { p.passe--; toast('Passe livre usado'); updateHUD(); return; }
  toast(`${p.name} recusou: volta 2 casas`);
  sfx.trap();
  await move(who, p.pos - 2);
}

// Retorna true se o jogador joga de novo
async function resolveTile(who) {
  const p = G.players[who];
  const tile = G.tiles[p.pos];
  const cat = CATEGORIAS[tile.tipo];
  if (!cat) return false;
  const f = tile.fase;

  if (tile.tipo === 'verdade' || tile.tipo === 'desafio' || tile.tipo === 'pena') {
    const src = { verdade: VERDADE, desafio: DESAFIO, pena: PENA }[tile.tipo][f];
    const card = draw(tile.tipo + f, src, who);
    const r = await showCard({ cat, text: fill(card.t, who), secs: card.s, who, fase: f });
    if (r === 'recusou') await refusePenalty(who);
    return false;
  }

  if (tile.tipo === 'armadilha') {
    sfx.trap();
    const card = draw('armadilha', ARMADILHA, who);
    const r = await showCard({ cat, text: fill(card.t, who), who, fase: f });
    if (r === 'recusou') { await refusePenalty(who); return false; }
    if (card.e === 'voltar') await move(who, p.pos - card.n);
    if (card.e === 'perde') { p.skip = true; toast(`${p.name} perde a próxima vez`); }
    if (card.e === 'trocar') {
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
    const card = draw('sorte', SORTE, who);
    await showCard({ cat, text: fill(card.t, who), who, fase: f, refusable: false });
    if (card.e === 'avancar') await move(who, p.pos + card.n);
    if (card.e === 'passe') { p.passe++; updateHUD(); }
    if (card.e === 'denovo') { toast(`${p.name} joga de novo`); return true; }
  }
  return false;
}

function endTurn(again) {
  let next = again ? G.turn : other(G.turn);
  if (!again && G.players[next].skip) {
    G.players[next].skip = false;
    toast(`${G.players[next].name} está pres${next === 'ele' ? 'o' : 'a'} — perde a vez`);
    next = G.turn;
  }
  G.turn = next;
  board.focus(next);
  G.busy = false;
  updateHUD();
}

function finish(winner) {
  sfx.win();
  const w = G.players[winner], l = G.players[other(winner)];
  updateHUD();
  $('#final-title').innerHTML = `<span style="color:var(--${winner})">${w.name}</span> chegou ao Clímax!`;
  $('#final-sub').textContent = `Escolha a dedo 1 desejo para ${l.name} realizar:`;
  const opts = shuffle([...DESEJOS.ambos, ...DESEJOS[winner]]).slice(0, 3);
  const box = $('#wishes'); box.innerHTML = '';
  hide('#wish-chosen'); box.classList.remove('hidden');
  opts.forEach((t, i) => {
    const b = document.createElement('button');
    b.className = 'wish';
    b.innerHTML = `<i>${['I', 'II', 'III'][i]}</i>`;
    b.append(t);
    b.onclick = () => {
      box.classList.add('hidden');
      $('#final-sub').textContent = `${w.name} escolheu. ${l.name}, agora é com você:`;
      $('#wish-chosen .chosen-text').textContent = `“${t}”`;
      show('#wish-chosen');
      sfx.card();
    };
    box.append(b);
  });
  setTimeout(() => show('#final'), 700);
}

// ------------------------------------------------------------ eventos
function segment(id, key, cast = v => v) {
  const btns = [...document.querySelectorAll(`${id} button`)];
  const set = v => { btns.forEach(b => b.classList.toggle('on', cast(b.dataset.v) === v)); };
  set(G[key]);
  btns.forEach(b => b.onclick = () => { G[key] = cast(b.dataset.v); set(G[key]); store.set(key === 'N' ? 'dur' : 'start', G[key]); });
}
segment('#seg-dur', 'N', Number);
segment('#seg-start', 'starter');
const [sn1, sn2] = store.get('names', ['', '']);
$('#name-ele').value = sn1; $('#name-ela').value = sn2;

$('#btn-start').onclick = startGame;
$('#btn-roll').onclick = roll;
$('#btn-rules').onclick = () => show('#rules');
$('#btn-show-rules').onclick = () => { hide('#menu'); show('#rules'); };
$('#btn-menu').onclick = () => show('#menu');
const toSetup = () => { hide('#menu'); hide('#final'); hide('#hud'); show('#setup'); board.setMode('orbit'); };
$('#btn-restart').onclick = toSetup;
$('#btn-again').onclick = toSetup;
$('#btn-map').onclick = () => {
  const on = board.mode !== 'overview';
  board.setMode(on ? 'overview' : 'follow');
  $('#btn-map').classList.toggle('on', on);
};
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('.screen').classList.add('hidden'));
window.addEventListener('keydown', e => { if (e.code === 'Space' && !$('#hud').classList.contains('hidden') && $('#card').classList.contains('hidden')) roll(); });

// tabuleiro de fundo na tela inicial (espera as fontes para desenhar as placas)
document.querySelectorAll('.ci').forEach(el => { el.style.backgroundImage = `url(${iconURL(el.dataset.t, 64)})`; });
Promise.all(['italic 700 40px "Playfair Display"', '700 40px "Playfair Display"', '40px "Great Vibes"', '20px "Inter"'].map(f => document.fonts.load(f))).catch(() => {}).finally(() => {
  G.tiles = generateBoard(G.N);
  board.build(G.tiles);
  board.setMode('orbit');
});
window.__G = G; window.__B = board; // depuração
