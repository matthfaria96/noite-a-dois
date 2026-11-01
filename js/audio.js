// Som do jogo: música ambiente hipnótica gerada em tempo real + efeitos.
// Com "musica": true em audio/lista.json, toca audio/musica.mp3 no lugar da música gerada.
export class GameAudio {
  constructor() {
    this.vol = { musica: 0.6, efeitos: 0.7 };
    this.phase = 0;
    this.started = false;
  }

  // precisa ser chamado num toque/clique (regra dos navegadores)
  async start() {
    if (this.started) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.started = true;
    const c = this.ctx = new AC();
    this.out = c.createDynamicsCompressor();
    this.out.connect(c.destination);
    this.musicBus = c.createGain(); this.musicBus.gain.value = 0;
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = this.vol.efeitos;
    this.duckGain = c.createGain(); this.duckGain.gain.value = 1;
    this.musicBus.connect(this.duckGain).connect(this.out);
    this.sfxBus.connect(this.out);
    this.reverb = c.createConvolver();
    this.reverb.buffer = this.#impulse(4.5);
    const revGain = c.createGain(); revGain.gain.value = 0.55;
    this.reverb.connect(revGain).connect(this.musicBus);
    this.setVolume('musica', this.vol.musica);

    if (await this.#hasMusic()) {
      const el = this.fileEl = new Audio('audio/musica.mp3');
      el.loop = true; el.crossOrigin = 'anonymous';
      c.createMediaElementSource(el).connect(this.musicBus);
      el.play().catch(() => {});
    } else {
      this.#startGenerative();
    }
  }

  // audio/lista.json diz se existe uma faixa própria em audio/musica.mp3
  async #hasMusic() {
    try { const r = await fetch('audio/lista.json'); return r.ok && !!(await r.json()).musica; } catch { return false; }
  }

  #impulse(sec) {
    const c = this.ctx, len = c.sampleRate * sec, b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return b;
  }

  setVolume(kind, v) {
    this.vol[kind] = v;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (kind === 'musica') this.musicBus.gain.setTargetAtTime(v * 0.5, t, 0.4);
    if (kind === 'efeitos') this.sfxBus.gain.setTargetAtTime(v, t, 0.1);
  }

  // abaixa a música enquanto a narradora fala
  duck(on) {
    if (!this.ctx) return;
    this.duckGain.gain.setTargetAtTime(on ? 0.35 : 1, this.ctx.currentTime, 0.25);
  }

  // a intensidade da música acompanha a fase do tabuleiro (0..3)
  setPhase(f) { this.phase = f; }

  // ---------------------------------------------------------------- música gerada
  #startGenerative() {
    const c = this.ctx;
    // acordes suaves e sem resolução (Lá menor com nonas e sétimas): sensação de suspensão
    this.chords = [[57, 60, 64, 67, 71], [53, 57, 60, 64, 67], [48, 55, 59, 62, 64], [52, 55, 59, 62, 66]];
    this.scale = [69, 72, 74, 76, 79, 81, 84, 86, 88];
    this.padFilter = c.createBiquadFilter();
    this.padFilter.type = 'lowpass'; this.padFilter.frequency.value = 700; this.padFilter.Q.value = 0.7;
    const padGain = c.createGain(); padGain.gain.value = 0.16;
    this.padFilter.connect(padGain);
    padGain.connect(this.musicBus); padGain.connect(this.reverb);
    // LFO lento no filtro: o "respirar" hipnótico
    const lfo = c.createOscillator(), lfoG = c.createGain();
    lfo.frequency.value = 0.045; lfoG.gain.value = 420;
    lfo.connect(lfoG).connect(this.padFilter.frequency); lfo.start();
    // eco para o brilho das notas altas
    this.delay = c.createDelay(2); this.delay.delayTime.value = 0.48;
    const fb = c.createGain(); fb.gain.value = 0.42;
    const dl = c.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2600;
    this.delay.connect(dl).connect(fb).connect(this.delay);
    dl.connect(this.reverb); dl.connect(this.musicBus);

    this.next = { chord: c.currentTime + 0.1, beat: c.currentTime + 1, note: c.currentTime + 2 };
    this.chordIdx = 0;
    this.timer = setInterval(() => this.#schedule(), 200);
  }

  #mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  #schedule() {
    const c = this.ctx, now = c.currentTime, ahead = now + 0.6;
    const f = this.phase;
    this.padFilter.frequency.setTargetAtTime(600 + f * 260, now, 3);
    // acordes longos que se sobrepõem
    while (this.next.chord < ahead) {
      const t = this.next.chord, dur = 11;
      for (const m of this.chords[this.chordIdx % this.chords.length]) {
        for (const det of [-6, 5]) {
          const o = c.createOscillator(), g = c.createGain();
          o.type = det < 0 ? 'sawtooth' : 'triangle';
          o.frequency.value = this.#mtof(m - 12); o.detune.value = det;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.05, t + 3.5);
          g.gain.linearRampToValueAtTime(0.035, t + dur - 3);
          g.gain.linearRampToValueAtTime(0, t + dur);
          o.connect(g).connect(this.padFilter);
          o.start(t); o.stop(t + dur + 0.1);
        }
      }
      // grave profundo
      const sub = c.createOscillator(), sg = c.createGain();
      sub.type = 'sine'; sub.frequency.value = this.#mtof(this.chords[this.chordIdx % 4][0] - 24);
      sg.gain.setValueAtTime(0, t); sg.gain.linearRampToValueAtTime(0.12, t + 3); sg.gain.linearRampToValueAtTime(0, t + dur);
      sub.connect(sg).connect(this.musicBus); sub.start(t); sub.stop(t + dur + 0.1);
      this.chordIdx++;
      this.next.chord += 8;
    }
    // batida de coração bem baixinha, acelera nas fases quentes
    const bpm = 52 + f * 7;
    while (this.next.beat < ahead) {
      const t = this.next.beat;
      this.#heart(t, 0.11 + f * 0.02); this.#heart(t + 0.26, 0.07 + f * 0.015);
      this.next.beat += 60 / bpm;
    }
    // notas cristalinas soltas, com eco
    while (this.next.note < ahead) {
      const t = this.next.note;
      const m = this.scale[Math.floor(Math.random() * this.scale.length)];
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = this.#mtof(m);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      o.connect(g); g.connect(this.delay); g.connect(this.reverb);
      o.start(t); o.stop(t + 2.5);
      this.next.note += (2.6 - f * 0.45) * (0.5 + Math.random());
    }
  }

  #heart(t, v) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.18);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(this.musicBus); o.start(t); o.stop(t + 0.32);
  }

  // ---------------------------------------------------------------- efeitos
  #tone(freq, dur, type = 'sine', vol = 0.08, when = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxBus);
    if (this.reverb) { const s = c.createGain(); s.gain.value = 0.3; g.connect(s).connect(this.reverb); }
    o.start(t); o.stop(t + dur + 0.05);
  }
  roll() { for (let i = 0; i < 10; i++) this.#tone(1400 + Math.random() * 900, 0.25, 'sine', 0.018 * (1 - i / 12), (i * 170 + i * i * 6) / 1000); }
  land() { this.#tone(1318, 1.4, 'sine', 0.05); this.#tone(1976, 1.2, 'sine', 0.03, 0.04); this.#tone(659, 1.6, 'sine', 0.03); }
  hop() { this.#tone(196, 0.18, 'sine', 0.05); }
  card() { this.#tone(392, 0.5, 'sine', 0.05); this.#tone(587, 0.7, 'sine', 0.04, 0.14); }
  trap() { this.#tone(98, 0.6, 'triangle', 0.07); }
  alarm() { this.#tone(880, 0.4, 'triangle', 0.08); }
  win() { [294, 370, 440, 587].forEach((f, i) => this.#tone(f, 0.9, 'sine', 0.06, i * 0.22)); }
}
