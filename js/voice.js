// Narradora: voz sussurrada gravada no VoiceStudio. Só toca as falas gravadas em audio/voz/<chave>.mp3
// e listadas em audio/lista.json ("voz"); o que não estiver gravado fica em silêncio (o texto segue na tela).

// Todas as falas da narradora. Ver audio/voz/ROTEIRO.md
export const FALAS = {
  'inicio': 'Vamos começar… meus amores?',
  'boas-vindas': 'Bem-vindos à Noite a Dois. Respirem fundo… a subida até o Pico do Amor começa agora.',
  'comeca': 'Você começa… sem pressa.',
  'vez-1': 'Sua vez…',
  'vez-2': 'Agora é com você.',
  'vez-3': 'Pode rolar o dado… devagar.',
  'vez-4': 'É a sua vez… vem.',
  'fase-1': 'Aquecimento. Olhares, segredos… e toques leves.',
  'fase-2': 'Provocação. Agora os beijos ficam mais demorados.',
  'fase-3': 'Fogo. Pele com pele… sem pressa nenhuma.',
  'fase-4': 'Clímax. O pico está logo ali. Sem freios.',
  'verdade': 'Hora da verdade…',
  'desafio': 'Um desafio… pra você.',
  'pena': 'Uma pena… faça com carinho.',
  'armadilha': 'Cuidado… uma armadilha.',
  'sorte': 'A sorte sorriu pra você.',
  'pico': 'Vocês alcançaram o Pico do Amor.',
  'desejo': 'Agora escolha o seu desejo… com carinho.',
  'recusou': 'Hoje não? Tudo bem… mas você volta duas casas.',
  'vencedor': 'Ebaa! Temos um vencedor!',
  'vencedora': 'Ebaa! Temos uma vencedora!',
  // reações espontâneas (cartas cumpridas, dado alto)
  'reacao-uau': 'Uau!',
  'reacao-gostosinho': 'Hmm… que gostosinho…',
  'reacao-delicia': 'Ai… que delícia…',
  'reacao-eu-amo': 'Eu amo!',
  'reacao-olha-so': 'Olha só…',
  'reacao-assim-gosto': 'Hmm… assim eu gosto.',
  'reacao-continua': 'Isso… continua assim.',
};

export class Narrator {
  constructor(audio) {
    this.audio = audio;
    this.enabled = true;
    this.volume = 1;
    this.files = new Set();
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
      if (r.ok) ((await r.json()).voz ?? []).forEach(k => this.files.add(k));
    } catch {}
  }

  stop() {
    this.queue = Promise.resolve();
    this.el.pause();
    this.audio.duck(false);
  }

  // fala em fila (uma de cada vez)
  say(key) {
    if (!this.enabled || !this.files.has(key)) return Promise.resolve();
    this.queue = this.queue.then(() => this.#play(key)).catch(() => {});
    return this.queue;
  }

  #play(key) {
    return new Promise(resolve => {
      const end = () => { this.audio.duck(false); resolve(); };
      this.audio.duck(true);
      const el = this.el;
      el.muted = false; el.src = `audio/voz/${key}.mp3`; el.volume = this.volume;
      el.onended = el.onerror = end;
      el.play().catch(end);
    });
  }
}
