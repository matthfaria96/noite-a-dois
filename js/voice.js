// Narradora: voz sussurrada gravada no VoiceStudio. Só toca falas gravadas em audio/voz/<chave>.mp3
// e listadas em audio/lista.json ("voz"); o que não estiver gravado fica em silêncio (o texto segue na tela).
// As falas são curtas e genéricas (servem para qualquer carta). Cada momento do jogo tem várias variações,
// sorteadas sem repetir até todas terem saído, e isso vale entre partidas.
import { store, rnd } from './util.js';

// Todas as falas da narradora, agrupadas pelo momento (a chave é "<momento>-<n>"). Ver audio/voz/ROTEIRO.md
export const FALAS = {
  'inicio-1': 'Vamos começar… meus amores?',
  'inicio-2': 'Prontos?… Então vem.',
  'inicio-3': 'Hoje a noite é de vocês…',
  'vez-1': 'Sua vez…',
  'vez-2': 'Agora é com você.',
  'vez-3': 'Joga pra mim…',
  'vez-4': 'Vem… sua vez.',
  'vez-5': 'Sua vez, amor…',
  'vez-6': 'E agora… você.',
  'vez-7': 'Sua vez… capricha.',
  'fase1-1': 'Aquecimento…',
  'fase1-2': 'Devagar… aquecimento.',
  'fase2-1': 'Provocação…',
  'fase2-2': 'Agora… provocação.',
  'fase3-1': 'Fogo…',
  'fase3-2': 'Tá esquentando… fogo.',
  'fase4-1': 'Clímax…',
  'fase4-2': 'Chegou a hora… clímax.',
  'verdade-1': 'Verdade…',
  'verdade-2': 'Hora da verdade…',
  'verdade-3': 'Sem mentir pra mim…',
  'desafio-1': 'Desafio…',
  'desafio-2': 'Um desafio…',
  'desafio-3': 'Quero ver você fazer…',
  'pena-1': 'Pena…',
  'pena-2': 'Com a pena…',
  'pena-3': 'Suavinho…',
  'armadilha-1': 'Ops… armadilha.',
  'armadilha-2': 'Opa… caiu.',
  'armadilha-3': 'Cuidado…',
  'sorte-1': 'Que sorte…',
  'sorte-2': 'Hoje é seu dia…',
  'sorte-3': 'A sorte gosta de você…',
  'recusou-1': 'Hoje não?… Duas casas pra trás.',
  'recusou-2': 'Fugiu?… Volta duas.',
  'recusou-3': 'Tudo bem… mas tem um preço.',
  'passe-1': 'Passe livre… dessa vez passa.',
  'tempo-1': 'Valendo…',
  'tempo-2': 'Começou…',
  'fimtempo-1': 'Tempo!',
  'fimtempo-2': 'Acabou o tempo…',
  'dadoalto-1': 'Uau!',
  'dadoalto-2': 'Olha só…',
  'dadoalto-3': 'Isso!',
  'dadobaixo-1': 'Devagarinho…',
  'dadobaixo-2': 'Sem pressa…',
  'quase-1': 'Tá quase lá…',
  'quase-2': 'Falta pouco…',
  // reações a uma carta cumprida: suaves no começo, quentes no Fogo e no Clímax
  'suave-1': 'Que fofos…',
  'suave-2': 'Hmm…',
  'suave-3': 'Que lindo…',
  'suave-4': 'Eu amo!',
  'suave-5': 'Gostei…',
  'quente-1': 'Ai… que delícia…',
  'quente-2': 'Hmm… que gostosinho…',
  'quente-3': 'Hmm… assim eu gosto.',
  'quente-4': 'Isso… continua assim.',
  'quente-5': 'Não para…',
  'quente-6': 'Que calor…',
  'pico-1': 'O Pico do Amor…',
  'desejo-1': 'Escolha seu desejo…',
  'desejo-2': 'Agora… escolhe com vontade.',
  'vencedor-1': 'Ebaa! Temos um vencedor!',
  'vencedora-1': 'Ebaa! Temos uma vencedora!',
};

// falas que também servem em outro momento
const EXTRA = { quente: ['dadoalto-1'], suave: ['dadoalto-2'] };
const GRUPOS = {};
for (const k of Object.keys(FALAS)) (GRUPOS[k.replace(/-\d+$/, '')] ??= []).push(k);
for (const [g, ks] of Object.entries(EXTRA)) GRUPOS[g].push(...ks);

export class Narrator {
  constructor(audio) {
    this.audio = audio;
    this.enabled = true;
    this._volume = 0.8;
    this.files = new Set();
    this.queue = Promise.resolve();
    this.el = new Audio(); // um player só: depois de liberado no primeiro toque, o iOS deixa ele tocar sozinho
    this.el.preload = 'auto';
    this.release = null; // solta o duck da fala que está tocando (stop() usa para a música não ficar abafada)
    this.fading = false;
    this.loadFiles();
  }

  // volume ao vivo: o controle das configurações vale também para a fala que está tocando
  get volume() { return this._volume; }
  set volume(v) { this._volume = Math.max(0, Math.min(1, Number(v) || 0)); if (!this.fading) this.el.volume = this._volume; }

  // iOS só libera áudio depois de um toque: chamar isto no primeiro clique
  unlock() {
    const el = this.el;
    if (this.playing || !el.paused) return; // já tem fala tocando: não troca o src no meio
    el.muted = true; el.src = 'audio/voz/vez-1.mp3';
    el.play().then(() => { el.pause(); el.muted = false; }).catch(() => { el.muted = false; });
  }

  async loadFiles() {
    try {
      const r = await fetch('audio/lista.json', { cache: 'no-store' });
      if (r.ok) ((await r.json()).voz ?? []).forEach(k => this.files.add(k));
    } catch {}
  }

  // corta a fala atual sem estalo: o volume cai em ~140 ms e só então pausa.
  // Se falta menos de meio segundo para acabar, deixa terminar — cortar a última
  // palavra era o que soava como "acelerou no final".
  stop(fade = 0.14) {
    const el = this.el;
    this.queue = Promise.resolve(); // falas ainda na fila são descartadas
    if (this.fading || el.paused) { this.audio.duck(false); return; }
    const left = Number.isFinite(el.duration) ? el.duration - el.currentTime : Infinity;
    if (left > 0.45) {
      const v0 = this._volume, ms = Math.max(70, fade * 1000), t0 = performance.now();
      const release = this.release; this.release = null; this.fading = true;
      this.queue = new Promise(res => {
        const step = () => {
          const k = Math.min(1, (performance.now() - t0) / ms);
          el.volume = v0 * (1 - k);
          if (k < 1) return requestAnimationFrame(step);
          el.pause(); el.volume = v0; this.fading = false;
          release?.(); res();
        };
        step();
      });
    }
    this.audio.duck(false); // a música volta na hora, mesmo que a fala seja abandonada
  }

  // próxima fala do momento: sorteio sem repetir até todas saírem (o "saco" fica salvo entre partidas),
  // e nunca a mesma que acabou de tocar quando o saco recomeça
  next(momento) {
    const todas = (GRUPOS[momento] ?? []).filter(k => this.files.has(k));
    if (!todas.length) return null;
    const sacos = store.get('falas', {});
    let saco = (sacos[momento] ?? []).filter(k => todas.includes(k));
    if (!saco.length) saco = todas.filter(k => k !== this.ultima || todas.length === 1);
    const k = saco.splice(rnd(saco.length), 1)[0];
    sacos[momento] = saco; store.set('falas', sacos);
    return k;
  }

  // fala de um momento do jogo
  fala(momento) { const k = this.next(momento); return k ? this.say(k) : Promise.resolve(); }

  // fala em fila (uma de cada vez)
  say(key) {
    if (!this.enabled || !this.files.has(key)) return Promise.resolve();
    this.ultima = key;
    this.queue = this.queue.then(() => this.#play(key)).catch(() => {});
    return this.queue;
  }

  #play(key) {
    return new Promise(resolve => {
      const el = this.el;
      let done = false;
      const end = () => {
        if (done) return; done = true;
        this.playing = false;
        this.release = null;
        this.audio.duck(false);
        resolve();
      };
      this.release = end; // stop() chama isto se abandonar a fala, senão a música ficava abaixada
      this.playing = true;
      this.audio.duck(true);
      el.muted = false; el.src = `audio/voz/${key}.mp3`; el.volume = this._volume;
      el.onended = el.onerror = end;
      el.play().catch(end);
    });
  }
}
