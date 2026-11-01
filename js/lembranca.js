// Lembrança da noite: resumo da partida na tela final e uma imagem para guardar (ou compartilhar só entre os dois).
import { store } from './util.js';

const SERIF = '"Playfair Display", Georgia, serif';
const SCRIPT = '"Great Vibes", "Playfair Display", cursive';
const SANS = 'Inter, -apple-system, system-ui, sans-serif';

const minutos = ms => Math.max(1, Math.round(ms / 60000));

// números da noite, na ordem em que aparecem
export function resumo({ diario: d, rodadas, t0 }) {
  return [
    [minutos(Date.now() - t0) + ' min', 'juntos'],
    [rodadas, 'rodadas'],
    [d.feitas, d.feitas === 1 ? 'carta cumprida' : 'cartas cumpridas'],
    [d.verdade, d.verdade === 1 ? 'verdade' : 'verdades'],
    [d.desafio, d.desafio === 1 ? 'desafio' : 'desafios'],
    [d.recusadas, d.recusadas === 1 ? 'recusa' : 'recusas'],
  ];
}

// guarda as últimas noites no aparelho
export function registrar(noite) {
  const lista = store.get('noites', []);
  lista.unshift(noite);
  store.set('noites', lista.slice(0, 30));
  return lista.length;
}

// mostra o resumo dentro da tela final
export function mostrar(el, noite) {
  el.innerHTML = `<div class="memoria-grid">${noite.numeros.map(([n, r]) => `<div><b>${n}</b><small>${r}</small></div>`).join('')}</div>
    <p class="fine">${noite.vezes > 1 ? `A ${noite.vezes}ª noite de vocês aqui.` : 'A primeira noite de vocês aqui.'}</p>`;
}

// desenha a lembrança como imagem (1080 × 1350, formato retrato)
export async function imagem(noite) {
  await Promise.all([`italic 700 80px ${SERIF}`, `120px ${SCRIPT}`, `40px ${SANS}`].map(f => document.fonts.load(f))).catch(() => {});
  const W = 1080, H = 1350, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const bg = g.createRadialGradient(W / 2, H * 0.38, 40, W / 2, H * 0.45, H * 0.85);
  bg.addColorStop(0, '#5a1838'); bg.addColorStop(0.45, '#2a0a20'); bg.addColorStop(1, '#0a0208');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // brilhos
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * W, y = Math.random() * H, r = Math.random() * 2.2;
    g.fillStyle = `rgba(255,${180 + Math.random() * 60},${200 + Math.random() * 40},${0.15 + Math.random() * 0.5})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.textAlign = 'center';
  g.fillStyle = 'rgba(255,255,255,.55)'; g.font = `500 30px ${SANS}`;
  g.fillText(noite.data.toUpperCase(), W / 2, 130);
  const tg = g.createLinearGradient(0, 170, 0, 300);
  tg.addColorStop(0, '#ffffff'); tg.addColorStop(1, '#ff9ab0');
  g.fillStyle = tg; g.font = `italic 800 120px ${SERIF}`;
  g.fillText('Noite', W / 2, 290);
  g.shadowColor = 'rgba(255,40,90,1)'; g.shadowBlur = 30; g.fillStyle = '#fff'; g.font = `110px ${SCRIPT}`;
  g.fillText('a Dois', W / 2, 390); g.shadowBlur = 0;
  g.fillStyle = '#fff'; g.font = `italic 600 54px ${SERIF}`;
  g.fillText(`${noite.ele} & ${noite.ela}`, W / 2, 520);
  g.fillStyle = 'rgba(255,255,255,.7)'; g.font = `500 32px ${SANS}`;
  g.fillText(`${noite.vencedor} chegou primeiro ao Pico do Amor`, W / 2, 575);
  // números em grade 3 × 2
  noite.numeros.forEach(([n, r], i) => {
    const x = W / 2 + ((i % 3) - 1) * 300, y = 700 + Math.floor(i / 3) * 170;
    g.fillStyle = 'rgba(255,255,255,.07)'; roundRect(g, x - 135, y - 75, 270, 140, 28); g.fill();
    g.fillStyle = '#fff'; g.font = `italic 700 60px ${SERIF}`; g.fillText(String(n), x, y + 5);
    g.fillStyle = 'rgba(255,255,255,.6)'; g.font = `500 26px ${SANS}`; g.fillText(r, x, y + 45);
  });
  // o desejo escolhido
  g.fillStyle = 'rgba(255,255,255,.55)'; g.font = `600 26px ${SANS}`;
  g.fillText('O DESEJO DA NOITE', W / 2, 1060);
  g.fillStyle = '#fff'; g.font = `italic 500 40px ${SERIF}`;
  quebra(g, `“${noite.desejo}”`, W - 200).forEach((l, i) => g.fillText(l, W / 2, 1120 + i * 54));
  return new Promise(r => cv.toBlob(r, 'image/png'));
}

// compartilha a imagem (menu do celular) ou baixa o arquivo
export async function guardar(noite) {
  const blob = await imagem(noite);
  const nome = `noite-a-dois-${noite.data.replace(/\W+/g, '-')}.png`;
  const file = new File([blob], nome, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Noite a Dois' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function quebra(g, texto, max) {
  const linhas = []; let atual = '';
  for (const p of texto.split(' ')) {
    const t = atual ? atual + ' ' + p : p;
    if (g.measureText(t).width > max && atual) { linhas.push(atual); atual = p; } else atual = t;
  }
  return [...linhas, atual].slice(0, 4);
}
