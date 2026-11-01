// Som do jogo: trilha lounge sensual gerada em tempo real (fixa, não muda com as fases) + efeitos.
// Com "musica": true em audio/lista.json, toca audio/musica.mp3 no lugar da trilha gerada.
export class GameAudio {
  constructor() {
    this.vol = { musica: 0.6, efeitos: 0.7 };
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
    this.out.threshold.value = -18; this.out.ratio.value = 3;
    this.out.connect(c.destination);
    this.musicBus = c.createGain(); this.musicBus.gain.value = 0;
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = this.vol.efeitos;
    this.duckGain = c.createGain(); this.duckGain.gain.value = 1;
    this.musicBus.connect(this.duckGain).connect(this.out);
    this.sfxBus.connect(this.out);
    this.reverb = c.createConvolver();
    this.reverb.buffer = this.#impulse(3.2);
    const revGain = c.createGain(); revGain.gain.value = 0.4;
    this.reverb.connect(revGain).connect(this.out);
    this.noise = this.#noiseBuffer(2);
    this.setVolume('musica', this.vol.musica);
    if (await this.#hasMusic()) {
      const el = this.fileEl = new Audio('audio/musica.mp3');
      el.loop = true; el.crossOrigin = 'anonymous';
      c.createMediaElementSource(el).connect(this.musicBus);
      el.play().catch(() => {});
    } else {
      this.#startTrilha();
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
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return b;
  }
  #noiseBuffer(sec) {
    const c = this.ctx, b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  setVolume(kind, v) {
    this.vol[kind] = v;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (kind === 'musica') this.musicBus.gain.setTargetAtTime(v * 0.55, t, 0.4);
    if (kind === 'efeitos') this.sfxBus.gain.setTargetAtTime(v, t, 0.1);
  }
  // abaixa a música enquanto a narradora fala
  duck(on) {
    if (!this.ctx) return;
    this.duckGain.gain.setTargetAtTime(on ? 0.35 : 1, this.ctx.currentTime, 0.25);
  }
  // fase nova: a trilha continua igual; só um coração marca a passagem
  setPhase(f) { if (f > 0) this.fase(); }

  // ---------------------------------------------------------------- trilha
  // Lounge noturno a 70 BPM em ré menor: piano elétrico, baixo quente, batida trip-hop baixinha,
  // colchão e chiado de vinil. Partes "cheia" e "vazia" se alternam a cada 16 compassos,
  // e as frases de melodia são poucas e espaçadas, com leve variação de tempo e força: não enjoa.
  #startTrilha() {
    const c = this.ctx;
    this.bpm = 70;
    this.step = 60 / this.bpm / 4;                       // semicolcheia
    // Rém9 · Si♭maj7 · Solm9 · Lá7sus(b9)
    this.acordes = [[50, 57, 60, 64, 65], [46, 53, 57, 60, 62], [43, 50, 53, 57, 58], [45, 52, 55, 58, 62]];
    this.graves = [38, 34, 31, 33];
    this.escala = [62, 65, 67, 69, 72, 74, 77];          // ré menor pentatônica
    this.frases = [[0, 2, 3, 2], [4, 3, 2, 0], [2, 3, 4, 5, 4], [5, 4, 2, 3], [1, 2, 4, 2, 1]];
    // piano elétrico e colchão passam por um filtro quente
    this.quente = c.createBiquadFilter(); this.quente.type = 'lowpass'; this.quente.frequency.value = 2400;
    const g = c.createGain(); g.gain.value = 0.9;
    this.quente.connect(g); g.connect(this.musicBus);
    const rv = c.createGain(); rv.gain.value = 0.35; g.connect(rv).connect(this.reverb);
    // tremolo suave no piano
    this.trem = c.createGain(); this.trem.gain.value = 0.85;
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 4.2; lg.gain.value = 0.12; lfo.connect(lg).connect(this.trem.gain); lfo.start();
    this.trem.connect(this.quente);
    // eco para a melodia
    this.eco = c.createDelay(1.5); this.eco.delayTime.value = this.step * 3;
    const fb = c.createGain(); fb.gain.value = 0.32;
    const ef = c.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 1800;
    this.eco.connect(ef).connect(fb).connect(this.eco); ef.connect(this.quente);
    this.#vinil();
    this.passo = 0;
    this.prox = c.currentTime + 0.15;
    this.timer = setInterval(() => this.#agenda(), 100);
  }
  #mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  #agenda() {
    const c = this.ctx, ahead = c.currentTime + 0.5;
    while (this.prox < ahead) { this.#tocaPasso(this.passo, this.prox); this.passo++; this.prox += this.step; }
  }
  #tocaPasso(p, t) {
    const s = p % 16, compasso = Math.floor(p / 16), ac = compasso % 4;
    const cheia = Math.floor(compasso / 16) % 2 === 0 || compasso < 4;  // 16 compassos cheios, 16 vazios
    const balanço = (s % 2) ? this.step * 0.16 : 0;                     // semicolcheias "atrasadas": groove
    const hum = () => (Math.random() - 0.5) * 0.012;
    const T = t + balanço + hum();
    // piano elétrico: acorde no 1 e uma antecipação leve no "e" do 2
    if (s === 0) this.#rhodes(this.acordes[ac], T, 0.5 + Math.random() * 0.1, this.step * 10);
    if (s === 6 && Math.random() < 0.6) this.#rhodes(this.acordes[ac].slice(1), T, 0.28, this.step * 6);
    if (s === 0) this.#colchao(this.acordes[ac], t, this.step * 16);
    // baixo: fundamental no 1, quinta no 3, passagem às vezes
    if (s === 0) this.#baixo(this.graves[ac], T, this.step * 7);
    if (s === 8) this.#baixo(this.graves[ac] + 7, T, this.step * 5, 0.7);
    if (s === 14 && Math.random() < 0.35) this.#baixo(this.graves[(ac + 1) % 4] + 1, T, this.step * 2, 0.5);
    // batida trip-hop, bem baixa
    if (cheia) {
      if (s === 0 || s === 10) this.#bumbo(T, s === 0 ? 1 : 0.7);
      if (s === 4 || s === 12) this.#caixa(T, 1);
      if (Math.random() < 0.12 && (s === 7 || s === 15)) this.#caixa(T, 0.35);
    } else if (s === 12) this.#caixa(T, 0.5);
    if (s % 2 === 0) this.#chimbal(T, s % 4 === 2 ? 0.8 : 0.45);
    // melodia: uma frase curta a cada 4 compassos, às vezes (nunca a mesma em seguida)
    if (s === 0 && ac === 1 && Math.random() < (cheia ? 0.55 : 0.35)) {
      let i; do { i = Math.floor(Math.random() * this.frases.length); } while (i === this.ultimaFrase && this.frases.length > 1);
      this.ultimaFrase = i;
      this.frases[i].forEach((g, k) => this.#nota(this.escala[g], t + this.step * (4 + k * 3) + hum(), 0.32 - k * 0.03));
    }
  }
  // tine de piano elétrico: FM com índice que cai (ataque de sino, corpo redondo)
  #rhodes(notas, t, vel, dur) {
    const c = this.ctx;
    for (const m of notas) {
      const f = this.#mtof(m), car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
      car.frequency.value = f; mod.frequency.value = f;
      mg.gain.setValueAtTime(f * 1.6, t); mg.gain.exponentialRampToValueAtTime(f * 0.08, t + 0.6);
      mod.connect(mg).connect(car.frequency);
      const v = vel * 0.032;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.006);
      g.gain.exponentialRampToValueAtTime(v * 0.35, t + 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      car.connect(g).connect(this.trem);
      car.start(t); mod.start(t); car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
    }
  }
  #nota(m, t, vel) {
    const c = this.ctx, f = this.#mtof(m), car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
    car.frequency.value = f; mod.frequency.value = f * 2;
    mg.gain.setValueAtTime(f * 0.9, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.4);
    mod.connect(mg).connect(car.frequency);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.05, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    car.connect(g); g.connect(this.trem); g.connect(this.eco);
    car.start(t); mod.start(t); car.stop(t + 1.7); mod.stop(t + 1.7);
  }
  #colchao(notas, t, dur) {
    const c = this.ctx, f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.018, t + 1.2); g.gain.linearRampToValueAtTime(0, t + dur + 0.6);
    f.connect(g).connect(this.quente);
    for (const m of notas.slice(1, 4)) for (const det of [-7, 7]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = this.#mtof(m); o.detune.value = det;
      o.connect(f); o.start(t); o.stop(t + dur + 0.7);
    }
  }
  #baixo(m, t, dur, vel = 1) {
    const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = this.#mtof(m);
    o2.type = 'triangle'; o2.frequency.value = this.#mtof(m);
    f.type = 'lowpass'; f.frequency.value = 420;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16 * vel, t + 0.02);
    g.gain.setTargetAtTime(0.1 * vel, t + 0.05, 0.3); g.gain.setTargetAtTime(0, t + dur, 0.08);
    o.connect(g); o2.connect(f).connect(g); g.connect(this.musicBus);
    o.start(t); o2.start(t); o.stop(t + dur + 0.5); o2.stop(t + dur + 0.5);
  }
  #bumbo(t, vel) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22 * vel, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g).connect(this.musicBus); o.start(t); o.stop(t + 0.42);
  }
  // caixa de vassourinha: ruído filtrado com corpo curto
  #caixa(t, vel) {
    const c = this.ctx, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    n.buffer = this.noise; f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 0.7;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07 * vel, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    n.connect(f).connect(g); g.connect(this.musicBus);
    const s = c.createGain(); s.gain.value = 0.5; g.connect(s).connect(this.reverb);
    n.start(t, Math.random()); n.stop(t + 0.3);
  }
  #chimbal(t, vel) {
    const c = this.ctx, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    n.buffer = this.noise; f.type = 'highpass'; f.frequency.value = 7500;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.018 * vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    n.connect(f).connect(g).connect(this.musicBus); n.start(t, Math.random()); n.stop(t + 0.08);
  }
  // chiado de vinil: ruído bem baixo e estalos raros
  #vinil() {
    const c = this.ctx, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    n.buffer = this.noise; n.loop = true; f.type = 'bandpass'; f.frequency.value = 3000; f.Q.value = 0.4; g.gain.value = 0.006;
    n.connect(f).connect(g).connect(this.musicBus); n.start();
    const len = c.sampleRate * 4, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (let k = 0; k < 14; k++) { const i = Math.floor(Math.random() * (len - 40)); for (let j = 0; j < 40; j++) d[i + j] = (Math.random() * 2 - 1) * (1 - j / 40) * 0.6; }
    const cl = c.createBufferSource(), cg = c.createGain(); cl.buffer = b; cl.loop = true; cg.gain.value = 0.05;
    cl.connect(cg).connect(this.musicBus); cl.start();
  }

  // ---------------------------------------------------------------- efeitos
  #tone(freq, dur, type = 'sine', vol = 0.08, when = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxBus);
    const s = c.createGain(); s.gain.value = 0.3; g.connect(s).connect(this.reverb);
    o.start(t); o.stop(t + dur + 0.05);
  }
  // sino de cristal: parciais fora da série harmônica, como vidro
  #sino(f, vol, when = 0, dur = 2) {
    [[1, 1], [2.76, 0.45], [5.4, 0.22], [8.93, 0.1]].forEach(([r, a]) => this.#tone(f * r, dur / (1 + r * 0.3), 'sine', vol * a, when));
  }
  #sopro(dur, de, ate, vol, when = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + when, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    n.buffer = this.noise; f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(de, t); f.frequency.exponentialRampToValueAtTime(ate, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f).connect(g); g.connect(this.sfxBus);
    const s = c.createGain(); s.gain.value = 0.4; g.connect(s).connect(this.reverb);
    n.start(t, Math.random()); n.stop(t + dur + 0.05);
  }
  #coracao(when, vol) {
    if (!this.ctx) return;
    const c = this.ctx;
    for (const [d, v] of [[0, 1], [0.24, 0.65]]) {
      const t = c.currentTime + when + d, o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(75, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.16);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g).connect(this.sfxBus); o.start(t); o.stop(t + 0.32);
    }
  }
  roll() { this.#sopro(1.6, 600, 3200, 0.05); for (let i = 0; i < 6; i++) this.#tone(1700 + Math.random() * 900, 0.4, 'sine', 0.012, 0.2 + i * 0.22); }
  land() { this.#sino(880, 0.06); this.#sino(1318, 0.035, 0.05, 1.6); this.#tone(110, 0.5, 'sine', 0.08); }
  hop() { this.#tone(220, 0.12, 'sine', 0.035); this.#tone(160, 0.1, 'triangle', 0.02); }
  card() { this.#sopro(0.7, 300, 1400, 0.07); this.#sino(587, 0.025, 0.25, 1.4); }
  trap() { this.#tone(70, 0.9, 'sine', 0.12); this.#tone(103.8, 0.7, 'triangle', 0.05, 0.02); this.#sopro(0.6, 900, 200, 0.05); }
  alarm() { this.#sino(1046, 0.05); this.#sino(1046, 0.04, 0.45); }
  fase() { this.#coracao(0, 0.2); this.#coracao(0.9, 0.16); this.#sopro(2.2, 200, 900, 0.03); }
  win() { [293.7, 349.2, 440, 523.3, 587.3, 698.5].forEach((f, i) => this.#sino(f, 0.045, i * 0.16, 2.4)); }
}
