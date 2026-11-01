// Service worker: deixa o jogo abrir offline e instalável como app.
// Ao mudar qualquer arquivo, aumente a VERSAO para os aparelhos baixarem a nova.
const VERSAO = 'nad-v9';
const ARQUIVOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'audio/lista.json',
  'audio/voz/armadilha.mp3',
  'audio/voz/boas-vindas.mp3',
  'audio/voz/comeca.mp3',
  'audio/voz/desafio.mp3',
  'audio/voz/desejo.mp3',
  'audio/voz/fase-1.mp3',
  'audio/voz/fase-2.mp3',
  'audio/voz/fase-3.mp3',
  'audio/voz/fase-4.mp3',
  'audio/voz/inicio.mp3',
  'audio/voz/pena.mp3',
  'audio/voz/pico.mp3',
  'audio/voz/reacao-assim-gosto.mp3',
  'audio/voz/reacao-continua.mp3',
  'audio/voz/reacao-delicia.mp3',
  'audio/voz/reacao-eu-amo.mp3',
  'audio/voz/reacao-gostosinho.mp3',
  'audio/voz/reacao-olha-so.mp3',
  'audio/voz/reacao-uau.mp3',
  'audio/voz/recusou.mp3',
  'audio/voz/sorte.mp3',
  'audio/voz/vencedor.mp3',
  'audio/voz/vencedora.mp3',
  'audio/voz/verdade.mp3',
  'audio/voz/vez-1.mp3',
  'audio/voz/vez-2.mp3',
  'audio/voz/vez-3.mp3',
  'audio/voz/vez-4.mp3',
  'css/style.css',
  'fonts/great-vibes-normal.woff2',
  'fonts/inter.woff2',
  'fonts/playfair-display-italic.woff2',
  'fonts/playfair-display-normal.woff2',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'js/audio.js',
  'js/auth.js',
  'js/config.js',
  'js/data.js',
  'js/dice.js',
  'js/game.js',
  'js/icons.js',
  'js/scene.js',
  'js/util.js',
  'js/voice.js',
  'vendor/supabase/supabase.js',
  'vendor/three/addons/environments/RoomEnvironment.js',
  'vendor/three/addons/geometries/ConvexGeometry.js',
  'vendor/three/addons/geometries/RoundedBoxGeometry.js',
  'vendor/three/addons/math/ConvexHull.js',
  'vendor/three/addons/postprocessing/EffectComposer.js',
  'vendor/three/addons/postprocessing/MaskPass.js',
  'vendor/three/addons/postprocessing/OutputPass.js',
  'vendor/three/addons/postprocessing/Pass.js',
  'vendor/three/addons/postprocessing/RenderPass.js',
  'vendor/three/addons/postprocessing/ShaderPass.js',
  'vendor/three/addons/postprocessing/UnrealBloomPass.js',
  'vendor/three/addons/shaders/CopyShader.js',
  'vendor/three/addons/shaders/LuminosityHighPassShader.js',
  'vendor/three/addons/shaders/OutputShader.js',
  'vendor/three/three.module.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Usa o cache na hora e atualiza em segundo plano (a próxima abertura já vem nova).
self.addEventListener('fetch', e => {
  // só arquivos do próprio jogo; login e banco (Supabase) nunca passam pelo cache
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // a narração (audio/) vem da rede primeiro, para a voz nova tocar já na primeira abertura; offline usa o cache
  const rede = new URL(e.request.url).pathname.includes('/audio/');
  e.respondWith(caches.open(VERSAO).then(async cache => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok) cache.put(e.request, r.clone()); return r; }).catch(() => hit);
    return rede ? net.then(r => r || hit) : hit || net;
  }));
});
