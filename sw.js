// Service worker: deixa o jogo abrir offline e instalável como app.
// Ao mudar qualquer arquivo, aumente a VERSAO para os aparelhos baixarem a nova.
const VERSAO = 'nad-v22';
const ARQUIVOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'audio/lista.json',
  'audio/voz/armadilha-1.mp3',
  'audio/voz/armadilha-2.mp3',
  'audio/voz/armadilha-3.mp3',
  'audio/voz/dadoalto-1.mp3',
  'audio/voz/dadoalto-2.mp3',
  'audio/voz/dadoalto-3.mp3',
  'audio/voz/dadobaixo-1.mp3',
  'audio/voz/dadobaixo-2.mp3',
  'audio/voz/desafio-1.mp3',
  'audio/voz/desafio-2.mp3',
  'audio/voz/desafio-3.mp3',
  'audio/voz/desejo-1.mp3',
  'audio/voz/desejo-2.mp3',
  'audio/voz/fase1-1.mp3',
  'audio/voz/fase1-2.mp3',
  'audio/voz/fase2-1.mp3',
  'audio/voz/fase2-2.mp3',
  'audio/voz/fase3-1.mp3',
  'audio/voz/fase3-2.mp3',
  'audio/voz/fase4-1.mp3',
  'audio/voz/fase4-2.mp3',
  'audio/voz/fimtempo-1.mp3',
  'audio/voz/fimtempo-2.mp3',
  'audio/voz/inicio-1.mp3',
  'audio/voz/inicio-2.mp3',
  'audio/voz/inicio-3.mp3',
  'audio/voz/passe-1.mp3',
  'audio/voz/pena-1.mp3',
  'audio/voz/pena-2.mp3',
  'audio/voz/pena-3.mp3',
  'audio/voz/pico-1.mp3',
  'audio/voz/quase-1.mp3',
  'audio/voz/quase-2.mp3',
  'audio/voz/quente-1.mp3',
  'audio/voz/quente-2.mp3',
  'audio/voz/quente-3.mp3',
  'audio/voz/quente-4.mp3',
  'audio/voz/quente-5.mp3',
  'audio/voz/quente-6.mp3',
  'audio/voz/recusou-1.mp3',
  'audio/voz/recusou-2.mp3',
  'audio/voz/recusou-3.mp3',
  'audio/voz/sorte-1.mp3',
  'audio/voz/sorte-2.mp3',
  'audio/voz/sorte-3.mp3',
  'audio/voz/suave-1.mp3',
  'audio/voz/suave-2.mp3',
  'audio/voz/suave-3.mp3',
  'audio/voz/suave-4.mp3',
  'audio/voz/suave-5.mp3',
  'audio/voz/tempo-1.mp3',
  'audio/voz/tempo-2.mp3',
  'audio/voz/vencedor-1.mp3',
  'audio/voz/vencedora-1.mp3',
  'audio/voz/verdade-1.mp3',
  'audio/voz/verdade-2.mp3',
  'audio/voz/verdade-3.mp3',
  'audio/voz/vez-1.mp3',
  'audio/voz/vez-2.mp3',
  'audio/voz/vez-3.mp3',
  'audio/voz/vez-4.mp3',
  'audio/voz/vez-5.mp3',
  'audio/voz/vez-6.mp3',
  'audio/voz/vez-7.mp3',
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
  'js/cartas.js',
  'js/config.js',
  'js/data.js',
  'js/dice.js',
  'js/game.js',
  'js/icons.js',
  'js/lembranca.js',
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

// a versão nova baixa tudo e fica esperando: o jogo mostra "Atualizar" e só troca quando a pessoa toca
// (na primeira visita não há versão antiga, então ela já entra direto)
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(async () => {
    // quem ainda está numa versão anterior ao aviso (até nad-v16) não tem o botão: essa troca entra sozinha
    const antigas = (await caches.keys()).filter(k => /^nad-v(\d+)$/.test(k) && Number(k.slice(5)) < 17);
    if (antigas.length) self.skipWaiting();
  }));
});
self.addEventListener('message', e => { if (e.data === 'atualizar') self.skipWaiting(); });
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
