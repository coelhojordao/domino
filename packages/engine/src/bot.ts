import { BATIDA_POINTS, batidaKind, ends, isDouble, legalMoves, pips, type Rng } from './engine';
import type { BotLevel, GameState, Move, Tile } from './types';

/** Escolhe a jogada do bot para o jogador da vez. */
export function botMove(state: GameState, level: BotLevel = 'medio', rng: Rng = Math.random): Move {
  const moves = legalMoves(state);
  if (moves.length <= 1 || moves[0].type !== 'play') return moves[0];
  if (level === 'facil') return moves[Math.floor(rng() * moves.length)];

  let best: Move = moves[0];
  let bestScore = -Infinity;
  for (const m of moves) {
    const s = score(state, m as Extract<Move, { type: 'play' }>, level) + rng() * 0.01;
    if (s > bestScore) { bestScore = s; best = m; }
  }
  return best;
}

function score(state: GameState, m: Extract<Move, { type: 'play' }>, level: BotLevel): number {
  const seat = state.current;
  const hand = state.seats[seat].hand;
  const t = m.tile;
  let s = 0;

  // Se é a última peça, a melhor batida vale mais
  if (hand.length === 1) return 1000 + BATIDA_POINTS[batidaKind(state, t)] * 10;

  // Descarta carroças cedo (são difíceis de encaixar) e peças pesadas
  if (isDouble(t)) s += 8;
  s += pips(t) * 0.8;

  if (level !== 'dificil') return s;

  // ---- Difícil: conta peças e tenta trancar os adversários ----
  const newEnds = endsAfter(state, t, m.side);
  const n = state.seats.length;
  const next = (seat + 1) % n;
  const myTeam = state.seats[seat].team;

  for (const v of newEnds) {
    // adversário da vez já passou nesse número → força ele a passar de novo
    if (state.passedOn[next].includes(v) && state.seats[next].team !== myTeam) s += 12;
    // parceiro passou nesse número → evita deixar ele travado
    state.seats.forEach((p, i) => {
      if (i !== seat && p.team === myTeam && state.passedOn[i].includes(v)) s -= 8;
    });
    // número que eu ainda tenho bastante → mantenho controle da mesa
    const mine = hand.filter((h) => !same(h, t) && (h[0] === v || h[1] === v)).length;
    s += mine * 3;
    // número quase esgotado (contando o que já saiu) → difícil pros outros responderem
    const out = countOut(state, v);
    if (out >= 5 && mine > 0) s += 6;
  }

  // Mantém variedade de números na mão para não ficar travado
  const remaining = hand.filter((h) => !same(h, t));
  const variety = new Set(remaining.flatMap((h) => [h[0], h[1]])).size;
  s += variety * 1.5;
  return s;
}

const same = (a: Tile, b: Tile) => a[0] === b[0] && a[1] === b[1];

function endsAfter(state: GameState, t: Tile, side: 'left' | 'right'): number[] {
  const e = ends(state);
  if (!e) return [t[0], t[1]];
  if (side === 'left') return [t[0] === e[0] ? t[1] : t[0], e[1]];
  return [e[0], t[0] === e[1] ? t[1] : t[0]];
}

/** Quantas peças com o número v já estão na mesa (cada número aparece em 7 peças). */
function countOut(state: GameState, v: number) {
  return state.board.filter((p) => p.tile[0] === v || p.tile[1] === v).length;
}
