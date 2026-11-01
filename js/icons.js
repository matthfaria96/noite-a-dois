// Ícones vetoriais das categorias (desenhados em canvas, usados no 3D e na interface).
import { CATEGORIAS } from './data.js';

const P = {
  // Verdade: lábios (sussurrar a verdade)
  verdade(g) {
    g.beginPath();
    g.moveTo(-1, 0);
    g.bezierCurveTo(-0.65, -0.32, -0.38, -0.56, -0.14, -0.46);
    g.quadraticCurveTo(-0.04, -0.42, 0, -0.32);
    g.quadraticCurveTo(0.04, -0.42, 0.14, -0.46);
    g.bezierCurveTo(0.38, -0.56, 0.65, -0.32, 1, 0);
    g.bezierCurveTo(0.55, 0.02, 0.25, -0.08, 0, 0.0);
    g.bezierCurveTo(-0.25, -0.08, -0.55, 0.02, -1, 0);
    g.fill();
    g.beginPath();
    g.moveTo(-0.96, 0.06);
    g.bezierCurveTo(-0.55, 0.12, -0.25, 0.08, 0, 0.1);
    g.bezierCurveTo(0.25, 0.08, 0.55, 0.12, 0.96, 0.06);
    g.bezierCurveTo(0.6, 0.62, -0.6, 0.62, -0.96, 0.06);
    g.fill();
  },
  // Desafio: chama
  desafio(g, hi) {
    g.beginPath();
    g.moveTo(0, -1);
    g.bezierCurveTo(0.35, -0.5, 0.8, -0.1, 0.65, 0.45);
    g.bezierCurveTo(0.55, 0.85, 0.25, 1, 0, 1);
    g.bezierCurveTo(-0.25, 1, -0.55, 0.85, -0.65, 0.45);
    g.bezierCurveTo(-0.75, 0.05, -0.45, -0.2, -0.25, -0.45);
    g.bezierCurveTo(-0.2, -0.2, -0.05, -0.1, 0.05, -0.15);
    g.bezierCurveTo(0.15, -0.45, 0.05, -0.75, 0, -1);
    g.fill();
    g.fillStyle = hi;
    g.beginPath();
    g.moveTo(0, 0.1);
    g.bezierCurveTo(0.25, 0.32, 0.36, 0.55, 0.26, 0.74);
    g.bezierCurveTo(0.16, 0.92, -0.16, 0.92, -0.26, 0.74);
    g.bezierCurveTo(-0.36, 0.55, -0.2, 0.36, 0, 0.1);
    g.fill();
  },
  // Pena
  pena(g, hi, dark) {
    g.save();
    g.rotate(-0.6);
    g.beginPath();
    g.moveTo(0, -1.05);
    g.bezierCurveTo(0.48, -0.6, 0.42, 0.3, 0.06, 0.72);
    g.lineTo(-0.06, 0.72);
    g.bezierCurveTo(-0.42, 0.3, -0.48, -0.6, 0, -1.05);
    g.fill();
    g.strokeStyle = dark; g.lineWidth = 0.07; g.lineCap = 'round';
    for (const [y, s] of [[-0.45, 1], [-0.1, -1], [0.25, 1]]) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(0.38 * s, y - 0.18); g.stroke();
    }
    g.strokeStyle = hi; g.lineWidth = 0.06;
    g.beginPath(); g.moveTo(0, -0.95); g.lineTo(0, 1.1); g.stroke();
    g.restore();
  },
  // Armadilha: algemas
  armadilha(g) {
    g.lineWidth = 0.15;
    g.strokeStyle = g.fillStyle;
    for (const x of [-0.5, 0.5]) { g.beginPath(); g.arc(x, 0.3, 0.38, 0, Math.PI * 2); g.stroke(); }
    g.lineWidth = 0.09;
    for (const [x, y, r] of [[-0.34, -0.3, 0.2], [0, -0.48, 0], [0.34, -0.3, -0.2]]) {
      g.beginPath(); g.ellipse(x, y, 0.17, 0.09, r, 0, Math.PI * 2); g.stroke();
    }
    g.fillRect(-0.58, -0.12, 0.16, 0.12); g.fillRect(0.42, -0.12, 0.16, 0.12);
  },
  // Sorte: brilho
  sorte(g) {
    const star = (cx, cy, s) => {
      g.beginPath();
      g.moveTo(cx, cy - s);
      g.quadraticCurveTo(cx + 0.12 * s, cy - 0.12 * s, cx + s, cy);
      g.quadraticCurveTo(cx + 0.12 * s, cy + 0.12 * s, cx, cy + s);
      g.quadraticCurveTo(cx - 0.12 * s, cy + 0.12 * s, cx - s, cy);
      g.quadraticCurveTo(cx - 0.12 * s, cy - 0.12 * s, cx, cy - s);
      g.fill();
    };
    star(-0.1, 0.1, 0.9); star(0.62, -0.62, 0.34); star(0.6, 0.62, 0.2);
  },
};

// Desenha o ícone `tipo` centrado em (x, y) com raio `r`.
export function drawIcon(g, tipo, x, y, r, color = CATEGORIAS[tipo]?.cor ?? '#e8c27a', glow = true) {
  const fn = P[tipo];
  if (!fn) return;
  g.save();
  g.translate(x, y); g.scale(r, r);
  const gr = g.createLinearGradient(0, -1, 0, 1);
  gr.addColorStop(0, '#fff3dc'); gr.addColorStop(0.35, color); gr.addColorStop(1, color);
  g.fillStyle = gr;
  if (glow) { g.shadowColor = color; g.shadowBlur = r * 0.35; }
  fn(g, '#fff1d6', 'rgba(10,2,5,.85)');
  g.restore();
}

const cache = {};
export function iconURL(tipo, size = 128) {
  const k = tipo + size;
  if (cache[k]) return cache[k];
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  drawIcon(cv.getContext('2d'), tipo, size / 2, size / 2, size * 0.36);
  return (cache[k] = cv.toDataURL());
}
