// Utilidades compartilhadas.
export const $ = s => document.querySelector(s);
export const wait = ms => new Promise(r => setTimeout(r, ms));
export const rnd = n => Math.floor(Math.random() * n);
export const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// localStorage com proteção (aba anônima, armazenamento bloqueado etc.)
export const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('nad:' + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('nad:' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('nad:' + k); } catch {} },
  clearAll() { try { Object.keys(localStorage).filter(k => k.startsWith('nad:')).forEach(k => localStorage.removeItem(k)); } catch {} },
};
