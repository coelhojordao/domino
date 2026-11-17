import { describe, expect, it } from 'vitest';
import {
  applyMove, batidaKind, botMove, createGame, DEFAULT_CONFIG, fullSet, legalMoves, nextRound,
  type GameConfig, type GameState, type Tile,
} from '../src';

function seeded(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}
const bots = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `b${i}`, name: `Bot ${i}`, isBot: true }));

function playMatch(config: GameConfig, seed: number, level: 'facil' | 'medio' | 'dificil' = 'medio') {
  const rng = seeded(seed);
  const n = config.mode === '1x1' ? 2 : 4;
  const g = createGame(config, bots(n), rng);
  let guard = 0;
  while (g.status !== 'matchOver') {
    if (g.status === 'roundOver') { nextRound(g, rng); continue; }
    applyMove(g, botMove(g, level, rng));
    checkInvariants(g);
    if (++guard > 20000) throw new Error('loop');
  }
  return g;
}

function checkInvariants(g: GameState) {
  const all = [...g.board.map((p) => p.tile), ...g.boneyard, ...g.seats.flatMap((s) => s.hand)];
  expect(all.length).toBe(28);
  expect(new Set(all.map((t) => t.join('-'))).size).toBe(28);
  for (let i = 1; i < g.board.length; i++) expect(g.board[i - 1].right).toBe(g.board[i].left);
}

describe('motor', () => {
  it('tem 28 peças', () => expect(fullSet()).toHaveLength(28));

  it('no 2x2 começa quem tem a 6-6 e é obrigado a jogá-la', () => {
    const g = createGame(DEFAULT_CONFIG, bots(4), seeded(1));
    expect(g.seats[g.current].hand.some((t) => t[0] === 6 && t[1] === 6)).toBe(true);
    expect(legalMoves(g)).toEqual([{ type: 'play', tile: [6, 6], side: 'right' }]);
  });

  it('rejeita jogada inválida', () => {
    const g = createGame(DEFAULT_CONFIG, bots(4), seeded(2));
    expect(() => applyMove(g, { type: 'pass' })).toThrow();
  });

  it('classifica as batidas', () => {
    const g = createGame(DEFAULT_CONFIG, bots(4), seeded(3));
    const set = (l: number, r: number) => { g.board = [{ tile: [l, r] as Tile, left: l, right: r }]; };
    set(3, 5); expect(batidaKind(g, [3, 5])).toBe('la-e-lo');
    set(3, 5); expect(batidaKind(g, [1, 5])).toBe('simples');
    set(4, 4); expect(batidaKind(g, [4, 4])).toBe('cruzada');
    set(4, 2); expect(batidaKind(g, [2, 2])).toBe('carroca');
  });

  for (const mode of ['1x1', '2x2', '4-individual'] as const) {
    for (const scoring of ['batidas', 'pontos'] as const) {
      for (const draw of [false, true]) {
        it(`partida completa ${mode} ${scoring} compra=${draw}`, () => {
          for (let seed = 1; seed <= 15; seed++) {
            const g = playMatch({ ...DEFAULT_CONFIG, mode, scoring, draw, rounds: 5 }, seed);
            expect(g.round).toBe(5);
            expect(g.scores.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
          }
        });
      }
    }
  }

  it('bot difícil ganha do fácil na maioria das partidas', () => {
    let wins = 0, losses = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const rng = seeded(seed);
      const g = createGame({ ...DEFAULT_CONFIG, rounds: 1 }, bots(4), rng);
      while (g.status === 'playing') applyMove(g, botMove(g, g.current % 2 === 0 ? 'dificil' : 'facil', rng));
      if (g.scores[0] > g.scores[1]) wins++; else if (g.scores[1] > g.scores[0]) losses++;
    }
    expect(wins).toBeGreaterThan(losses);
  });
});
