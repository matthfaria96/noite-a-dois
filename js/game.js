// Regras, fluxo de turnos, interface, configurações, conta, modo de teste, narração e música.
import { Board3D } from './scene.js';
import { DiceStage } from './dice.js';
import { FASES, CATEGORIAS, VERDADE, DESAFIO, PENA, ARMADILHA, SORTE, DESEJOS } from './data.js';
import { iconURL } from './icons.js';
import { $, wait, rnd, pick, shuffle, store } from './util.js';
import { GameAudio } from './audio.js';
import { Narrator, FALAS } from './voice.js';
import { auth } from './auth.js';

// ------------------------------------------------------------ configurações (salvas no aparelho e na nuvem)
const CFG_DEFAULT = { musica: 0.6, efeitos: 0.7, voz: 1, narracao: true, vozNome: '', graficos: 'auto', dur: 40, start: 'ela', testeVel: 2 };
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
  voice.voiceName = cfg.vozNome;
}
applyCfg();

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
const say = (text, key) => (TESTE.on && TESTE.vel > 1 ? Promise.resolve() : voice.say(text, key));

function fill(text, who) {
  const me = G.players[who], par = G.players[other(who)];
  return text
    .replace(/\{par:([^|{}]*)\|([^{}]*)\}/g, (_, m, f) => (par.g === 'ele' ? m : f))
    .replace(/\{([^|{}:]*)\|([^{}]*)\}/g, (_, m, f) => (me.g === 'ele' ? m : f))
    .replaceAll('{eu}', me.name)
    .replaceAll('{par}', par.name);
}

// ------------------------------------------------------------ UI helpers
const show = id => $(id).classList.remove('hidden');
const hide = id => $(id).classList.add('hidden');
const visible = id => !$(id).classList.contains('hidden');
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
        iv = setInterval(() => {
          const left = Math.max(0, secs - (Date.now() - t0) / 1000);
          fg.style.strokeDashoffset = C * (1 - left / secs);
          lbl.textContent = Math.ceil(left) + 's';
          if (left <= 0) { clearInterval(iv); iv = null; lbl.textContent = '⏰'; audio.alarm(); }
        }, 200);
      };
    }
    let autoT;
    const done = r => { clearInterval(iv); clearTimeout(autoT); hide('#card'); voice.stop(); resolve(r); };
    $('#btn-done').onclick = () => done('feito');
    refuse.onclick = () => done('recusou');
    card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
    show('#card');
    audio.card();
    if (falar) say(`${cat.nome}. ${text}`);
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
  G.fase = 0; G.rodadas = 0; G.t0 = Date.now();
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
  say(FALAS['boas-vindas'], 'boas-vindas');
  say(`${G.players[G.turn].name}, você começa.`);
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
  if (f > G.fase) { G.fase = f; audio.setPhase(f); say(FALAS[`fase-${f + 1}`], `fase-${f + 1}`); }
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
  await dice.roll(v, () => audio.land());
  board.paused = false;
  board.placeDie(v, who);
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
  if (p.passe) { p.passe--; toast('Passe livre usado'); updateHUD(); return; }
  toast(`${p.name} recusou: volta 2 casas`);
  say(FALAS.recusou, 'recusou');
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

  if (tile.tipo === 'verdade' || tile.tipo === 'desafio' || tile.tipo === 'pena') {
    const src = { verdade: VERDADE, desafio: DESAFIO, pena: PENA }[tile.tipo][f];
    const card = draw(tile.tipo + f, src, who);
    const r = await showCard({ cat, text: fill(card.t, who), secs: card.s, who, fase: f });
    if (r === 'recusou') await refusePenalty(who);
    return false;
  }

  if (tile.tipo === 'armadilha') {
    audio.trap();
    const card = draw('armadilha', ARMADILHA, who);
    say(FALAS.armadilha, 'armadilha');
    const text = fill(card.t, who);
    const r = await showCard({ cat, text, who, fase: f, falar: false });
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
    say(FALAS.sorte, 'sorte');
    await showCard({ cat, text: fill(card.t, who), who, fase: f, refusable: false, falar: false });
    if (card.e === 'avancar') await move(who, p.pos + card.n);
    if (card.e === 'passe') { p.passe++; updateHUD(); }
    if (card.e === 'denovo') { toast(`${p.name} joga de novo`); return true; }
  }
  return false;
}

function endTurn(again) {
  G.rodadas++;
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
  const n = G.players[next].name;
  say(pick([`Sua vez, ${n}.`, `${n}… é com você.`, `Role o dado, ${n}.`, `Agora é você, ${n}.`]));
  autoNext();
}

function finish(winner) {
  audio.win();
  const w = G.players[winner], l = G.players[other(winner)];
  updateHUD();
  say(FALAS.pico, 'pico');
  say(`${w.name}… ${FALAS.desejo}`);
  if (!TESTE.on) {
    const st = store.get('stats', { partidas: 0, ele: 0, ela: 0 });
    st.partidas++; st[winner]++;
    store.set('stats', st);
    auth.saveProfile({ estatisticas: st }).catch(() => {});
  }
  $('#final-title').innerHTML = `<span style="color:var(--${winner})">${w.name}</span> chegou ao Pico do Amor!`;
  $('#final-sub').textContent = `Escolha a dedo 1 desejo para ${l.name} realizar:`;
  const opts = shuffle([...DESEJOS.ambos, ...DESEJOS[winner]]).slice(0, 3);
  const box = $('#wishes'); box.innerHTML = '';
  hide('#wish-chosen'); box.classList.remove('hidden');
  const choose = t => {
    box.classList.add('hidden');
    $('#final-sub').textContent = `${w.name} escolheu. ${l.name}, agora é com você:`;
    $('#wish-chosen .chosen-text').textContent = TESTE.on
      ? `Teste concluído: ${G.rodadas} rodadas em ${Math.round((Date.now() - G.t0) / 1000)}s (${TESTE.vel}×).`
      : `“${t}”`;
    show('#wish-chosen');
    audio.card();
    if (!TESTE.on) say(t);
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
$('#cfg-narracao').checked = cfg.narracao;
$('#cfg-narracao').onchange = e => { cfg.narracao = e.target.checked; applyCfg(); saveCfg(); };
function fillVoices() {
  const sel = $('#cfg-voz-nome'), vs = voice.voices();
  sel.innerHTML = '<option value="">Automática (a mais suave)</option>' + vs.map(v => `<option>${v.name}</option>`).join('');
  sel.value = cfg.vozNome;
  $('#cfg-voz-info').textContent = vs.length ? '' : 'Este navegador não oferece vozes em português.';
}
$('#cfg-voz-nome').onchange = e => { cfg.vozNome = e.target.value; applyCfg(); saveCfg(); };
window.speechSynthesis?.addEventListener?.('voiceschanged', fillVoices);
$('#btn-voz-teste').onclick = () => { voice.stop(); voice.unlock(); const was = voice.enabled; voice.enabled = true; voice.say(FALAS['boas-vindas'], 'boas-vindas').then(() => { voice.enabled = was; }); };

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
function openSettings() { fillVoices(); renderConta(); hide('#menu'); show('#settings'); }
$('#btn-settings').onclick = openSettings;
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
    G.N = cfg.dur; G.starter = cfg.start; segSet('#seg-dur', G.N); segSet('#seg-start', G.starter);
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
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('.screen').classList.add('hidden'));
window.addEventListener('keydown', e => { if (e.code === 'Space' && visible('#hud') && !visible('#card') && !TESTE.on) roll(); });
// o áudio só pode começar depois de um toque
window.addEventListener('pointerdown', () => { audio.start().then(applyCfg); voice.unlock(); }, { once: true });

// ------------------------------------------------------------ inicialização
document.querySelectorAll('.ci').forEach(el => { el.style.backgroundImage = `url(${iconURL(el.dataset.t, 64)})`; });
Promise.all(['italic 700 40px "Playfair Display"', '700 40px "Playfair Display"', '40px "Great Vibes"', '20px "Inter"'].map(f => document.fonts.load(f))).catch(() => {}).finally(() => {
  G.tiles = generateBoard(G.N);
  board.build(G.tiles);
  board.setMode('orbit');
});
auth.init().then(() => {
  if (auth.isLogged()) { if (auth.cloud) afterLogin(); else show('#setup'); }
  else openLock(auth.cloud && !auth.session ? 'entrar' : 'entrar');
});
window.__G = G; window.__B = board; window.__D = dice; // depuração
