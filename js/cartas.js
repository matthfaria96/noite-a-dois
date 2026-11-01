// O baralho da noite: limites do casal ("o que vale hoje"), cartas criadas por eles e o ritmo do tabuleiro.
import { VERDADE, DESAFIO, PENA, ARMADILHA, SORTE, DESEJOS } from './data.js';

// Limites: o casal desliga o que não quer hoje e as cartas com aquilo saem do baralho.
// Cada limite reconhece as cartas pelo texto. As verdades ficam de fora: falar sobre algo não é fazer.
export const LIMITES = [
  { id: 'roupa', nome: 'Tirar a roupa', desc: 'peças de roupa, strip-tease, lingerie',
    re: /roupa|peça|strip|vestid|lingerie/i },
  { id: 'vendas', nome: 'Olhos vendados', desc: 'vendas e olhos fechados',
    re: /vend[ae]|olhos fechados/i },
  { id: 'controle', nome: 'Quem manda', desc: 'dar ordens, obedecer, ficar imóvel, mãos presas',
    re: /manda|obedec|imóvel|mãos atadas|acima da cabeça|controle|uma ordem|não pode te tocar|não pode usar as mãos/i },
  { id: 'mordida', nome: 'Mordidas', desc: 'morder e usar os dentes',
    re: /morda de leve|mordid|dentes/i },
  { id: 'comodos', nome: 'Outros cômodos', desc: 'ir para outro lugar da casa, banho, parede',
    re: /lugar da casa|parede|banho|leve \{par\} para|me leva|até onde você quer|para onde eu apontar/i },
];
const liberado = (texto, limites = {}) => !LIMITES.some(l => limites[l.id] === false && l.re.test(texto));
export const limitesAtivos = (limites = {}) => LIMITES.filter(l => limites[l.id] === false);

// Ritmo: muda o peso das categorias e a rapidez com que as fases esquentam
// (curva > 1 demora mais nas fases leves; < 1 chega antes no Fogo e no Clímax).
export const RITMOS = {
  romantico:  { nome: 'Romântico',  curva: 1.3,  peso: { verdade: 1.5, desafio: 0.75, pena: 1.25 } },
  provocante: { nome: 'Provocante', curva: 1,    peso: {} },
  intenso:    { nome: 'Intenso',    curva: 0.75, peso: { verdade: 0.7, desafio: 1.35 } },
};
export const faseDaCasa = (i, N, ritmo) => Math.min(3, Math.floor(Math.pow(i / (N - 1), RITMOS[ritmo]?.curva ?? 1) * 4));
export const pesoNoRitmo = (tipo, ritmo) => RITMOS[ritmo]?.peso[tipo] ?? 1;

// Cada carta tem um id estável tirado do próprio texto: é por ele que o casal desliga uma carta no catálogo.
export function idCarta(texto) {
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
const ligada = (texto, desligadas = []) => !desligadas.includes(idCarta(texto));
const vale = (texto, cfg) => liberado(texto, cfg.limites) && ligada(texto, cfg.desligadas);

// Cartas da fase `f` para um tipo, com as cartas do casal e sem o que está desligado (limites ou catálogo).
// Nunca devolve vazio: se tudo foi desligado, usa as verdades da fase, depois as de qualquer fase
// e, em último caso, as verdades originais (falar sobre algo não é fazer).
const BASE = { verdade: VERDADE, desafio: DESAFIO, pena: PENA };
function cartasDe(tipo, f, cfg) {
  const proprias = (cfg.cartas ?? []).filter(c => c.tipo === tipo && c.f === f && ligada(c.t, cfg.desligadas))
    .map(c => ({ t: c.t, p: 'ambos', s: c.s || 0, nossa: true }));
  const base = BASE[tipo][f].filter(c => (tipo === 'verdade' ? ligada(c.t, cfg.desligadas) : vale(c.t, cfg)));
  return [...base, ...proprias];
}
export function baralho(tipo, f, cfg = {}) {
  const lista = cartasDe(tipo, f, cfg);
  if (lista.length) return lista;
  const verdades = cartasDe('verdade', f, cfg);
  if (verdades.length) return verdades;
  const qualquer = [0, 1, 2, 3].flatMap(g => cartasDe('verdade', g, cfg));
  return qualquer.length ? qualquer : VERDADE[f];
}
// armadilhas e sortes: se todas forem desligadas, a casa vira só o efeito mais leve
export const armadilhas = (cfg = {}) => { const l = ARMADILHA.filter(c => vale(c.t, cfg)); return l.length ? l : [ARMADILHA[0]]; };
export const sortes = (cfg = {}) => { const l = SORTE.filter(c => vale(c.t, cfg)); return l.length ? l : [SORTE[0]]; };
// desejos de quem venceu: sempre pelo menos 3 opções, completando com desejos leves se cortarem muito
const DESEJOS_LEVES = [
  'Um beijo demorado, onde e quando eu pedir, pelo resto da noite.',
  'Uma massagem nos pés de 10 minutos, sem pressa.',
  'Um elogio sussurrado no meu ouvido a cada 5 minutos, até a gente dormir.',
];
export function desejos(vencedor, cfg = {}) {
  const ok = [...DESEJOS.ambos, ...DESEJOS[vencedor]].filter(t => vale(t, cfg));
  return ok.length >= 3 ? ok : [...ok, ...DESEJOS_LEVES.filter(t => !ok.includes(t))];
}

// Catálogo: tudo o que existe, por tipo, com fase, para quem é e se está fora pelos limites de hoje.
export function catalogo(cfg = {}) {
  const linha = (tipo, c, f) => ({ id: idCarta(c.t ?? c), tipo, t: c.t ?? c, f, p: c.p ?? 'ambos', s: c.s ?? 0,
    limite: tipo !== 'verdade' && !liberado(c.t ?? c, cfg.limites) });
  return {
    verdade: VERDADE.flatMap((l, f) => l.map(c => linha('verdade', c, f))),
    desafio: DESAFIO.flatMap((l, f) => l.map(c => linha('desafio', c, f))),
    pena: PENA.flatMap((l, f) => l.map(c => linha('pena', c, f))),
    armadilha: ARMADILHA.map(c => linha('armadilha', c, null)),
    sorte: SORTE.map(c => linha('sorte', c, null)),
    desejo: [...DESEJOS.ambos.map(t => ({ ...linha('desejo', t, null), p: 'ambos' })),
             ...DESEJOS.ele.map(t => ({ ...linha('desejo', t, null), p: 'ele' })),
             ...DESEJOS.ela.map(t => ({ ...linha('desejo', t, null), p: 'ela' }))],
    nossas: (cfg.cartas ?? []).map(c => ({ ...linha(c.tipo, c, c.f), nossa: true, limite: false })),
  };
}
