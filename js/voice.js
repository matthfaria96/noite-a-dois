// Narradora: voz feminina, suave e lenta.
// 1) Se a fala estiver listada em audio/lista.json ("voz"), toca audio/voz/<chave>.mp3 (gravado no VoiceStudio, por exemplo).
// 2) Senão, usa a voz do próprio aparelho (Web Speech), escolhendo a voz feminina em português mais natural.
const PREFERRED = ['Luciana', 'Francisca', 'Thalita', 'Vitória', 'Victoria', 'Fernanda', 'Maria', 'Google português do Brasil', 'Joana', 'Catarina'];

// Falas fixas (sem nomes): podem ser gravadas. Ver audio/voz/ROTEIRO.md
export const FALAS = {
  'boas-vindas': 'Bem-vindos à Noite a Dois. Respirem fundo… a subida até o Pico do Amor começa agora.',
  'fase-1': 'Aquecimento. Olhares, confissões… e toques leves.',
  'fase-2': 'Provocação. Agora os beijos ficam mais demorados.',
  'fase-3': 'Fogo. Pele com pele… sem pressa nenhuma.',
  'fase-4': 'Clímax. O pico está logo ali. Sem freios.',
  'armadilha': 'Cuidado… uma armadilha.',
  'sorte': 'A sorte sorriu pra você.',
  'pico': 'Vocês alcançaram o Pico do Amor.',
  'desejo': 'Agora escolha o seu desejo… com carinho.',
  'recusou': 'Hoje não? Tudo bem… mas você volta duas casas.',
};

export class Narrator {
  constructor(audio) {
    this.audio = audio;
    this.enabled = true;
    this.volume = 1;
    this.voiceName = '';
    this.files = new Set();
    this.queue = Promise.resolve();
    this.synth = window.speechSynthesis;
    this.loadFiles();
    this.synth?.addEventListener?.('voiceschanged', () => this.voices());
  }

  async loadFiles() {
    try {
      const r = await fetch('audio/lista.json');
      if (r.ok) ((await r.json()).voz ?? []).forEach(k => this.files.add(k));
    } catch {}
  }

  voices() {
    const all = this.synth?.getVoices() ?? [];
    return all.filter(v => /^pt/i.test(v.lang)).sort((a, b) => this.#score(b) - this.#score(a));
  }

  #score(v) {
    let s = /pt[-_]BR/i.test(v.lang) ? 10 : 0;
    const i = PREFERRED.findIndex(n => v.name.includes(n));
    if (i >= 0) s += 30 - i;
    if (/female|feminina|mulher/i.test(v.name)) s += 8;
    if (/enhanced|premium|natural|neural/i.test(v.name)) s += 6;
    if (/male|masculin|Daniel|Felipe|Ricardo|Antonio/i.test(v.name)) s -= 25;
    return s;
  }

  #voice() {
    const vs = this.voices();
    return vs.find(v => v.name === this.voiceName) ?? vs[0];
  }

  // iOS só libera a fala depois de um toque: chamar isto no primeiro clique
  unlock() {
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; this.synth?.speak(u); } catch {}
  }

  stop() {
    this.queue = Promise.resolve();
    try { this.synth?.cancel(); } catch {}
    if (this.el) { this.el.pause(); this.el = null; }
    this.audio.duck(false);
  }

  // fala em fila (uma de cada vez); `key` usa o arquivo gravado se existir
  say(text, key) {
    if (!this.enabled || !text) return Promise.resolve();
    this.queue = this.queue.then(() => this.#speak(text, key)).catch(() => {});
    return this.queue;
  }

  #speak(text, key) {
    return new Promise(resolve => {
      const end = () => { this.audio.duck(false); resolve(); };
      this.audio.duck(true);
      if (key && this.files.has(key)) {
        const el = this.el = new Audio(`audio/voz/${key}.mp3`);
        el.volume = this.volume;
        el.onended = el.onerror = end;
        el.play().catch(end);
        return;
      }
      if (!this.synth) return end();
      const u = new SpeechSynthesisUtterance(text.replace(/[“”"]/g, ''));
      u.lang = 'pt-BR';
      const v = this.#voice(); if (v) u.voice = v;
      u.rate = 0.9; u.pitch = 1.12; u.volume = this.volume;
      u.onend = u.onerror = end;
      setTimeout(end, 4000 + text.length * 90); // garantia caso o navegador não avise o fim
      this.synth.speak(u);
    });
  }
}
