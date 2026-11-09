// Narradora: voz sussurrada gravada no VoiceStudio. Só toca falas gravadas em audio/<pasta>/<chave>.mp3
// e listadas em audio/lista.json; o que não estiver gravado fica em silêncio (o texto segue na tela).
// Duas vozes: 'original' (audio/voz) e 'nova' (audio/voz2, quando houver falas gravadas nela).
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
    this.volume = 1;
    this.files = new Set();
    this.vozes = { original: new Set(), nova: new Set() };
    this.voz = 'original';
    this.queue = Promise.resolve();
    this.el = new Audio(); // um player só: depois de liberado no primeiro toque, o iOS deixa ele tocar sozinho
    this.loadFiles();
  }

  // iOS só libera áudio depois de um toque: chamar isto no primeiro clique
  unlock() {
    const el = this.el;
    el.muted = true; el.src = 'audio/voz/vez-1.mp3';
    el.play().then(() => { el.pause(); el.muted = false; }).catch(() => { el.muted = false; });
  }

  async loadFiles() {
    try {
      const r = await fetch('audio/lista.json', { cache: 'no-store' });
      if (r.ok) {
        const l = await r.json();
        (l.voz ?? []).forEach(k => this.vozes.original.add(k));
        (l.voz2 ?? []).forEach(k => this.vozes.nova.add(k));
        this.setVoz(this.voz);
        document.querySelector('#seg-voz')?.closest('.campo')?.classList.toggle('hidden', !this.vozes.nova.size);
      }
    } catch {}
  }

  // troca a voz; se a escolhida não tiver falas gravadas, fica a original
  setVoz(v) {
    this.voz = v === 'original' ? 'original' : 'nova';
    this.files = this.vozes[this.voz].size ? this.vozes[this.voz] : this.vozes.original;
  }
  get pasta() { return this.files === this.vozes.nova ? 'voz2' : 'voz'; }

  stop() {
    this.queue = Promise.resolve();
    this.el.pause();
    this.audio.duck(false);
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
      const end = () => { this.audio.duck(false); resolve(); };
      this.audio.duck(true);
      const el = this.el;
      el.muted = false; el.src = `audio/${this.pasta}/${key}.mp3`; el.volume = this.volume;
      el.onended = el.onerror = end;
      el.play().catch(end);
    });
  }
}
