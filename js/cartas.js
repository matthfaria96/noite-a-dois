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

// Cartas da fase `f` para um tipo, já com as cartas do casal e sem o que está desligado.
// Se os limites esvaziarem o baralho, cai para as verdades da mesma fase.
const BASE = { verdade: VERDADE, desafio: DESAFIO, pena: PENA };
export function baralho(tipo, f, { limites, cartas = [] } = {}) {
  const proprias = cartas.filter(c => c.tipo === tipo && c.f === f).map(c => ({ t: c.t, p: 'ambos', s: c.s || 0, nossa: true }));
  const lista = [...BASE[tipo][f].filter(c => tipo === 'verdade' || liberado(c.t, limites)), ...proprias];
  return lista.length ? lista : baralho('verdade', f, { limites, cartas });
}
export const armadilhas = limites => ARMADILHA.filter(c => liberado(c.t, limites));
export const sortes = limites => SORTE.filter(c => liberado(c.t, limites));
// desejos de quem venceu: sempre pelo menos 3 opções, completando com desejos leves se os limites cortarem muito
const DESEJOS_LEVES = [
  'Um beijo demorado, onde e quando eu pedir, pelo resto da noite.',
  'Uma massagem nos pés de 10 minutos, sem pressa.',
  'Um elogio sussurrado no meu ouvido a cada 5 minutos, até a gente dormir.',
];
export function desejos(vencedor, limites) {
  const ok = [...DESEJOS.ambos, ...DESEJOS[vencedor]].filter(t => liberado(t, limites));
  return ok.length >= 3 ? ok : [...ok, ...DESEJOS_LEVES];
}
