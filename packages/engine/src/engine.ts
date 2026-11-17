import type {
  BatidaKind, GameConfig, GameState, Move, PlayerSeat, RoundResult, Side, Tile,
} from './types';

export type Rng = () => number;

export const tileId = (t: Tile) => `${t[0]}-${t[1]}`;
export const sameTile = (a: Tile, b: Tile) => a[0] === b[0] && a[1] === b[1];
export const isDouble = (t: Tile) => t[0] === t[1];
export const pips = (t: Tile) => t[0] + t[1];
export const handPips = (h: Tile[]) => h.reduce((s, t) => s + pips(t), 0);

export function fullSet(): Tile[] {
  const s: Tile[] = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) s.push([a, b]);
  return s;
}

export function shuffle<T>(arr: T[], rng: Rng = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function seatCount(config: GameConfig) {
  return config.mode === '1x1' ? 2 : 4;
}

export function teamOf(config: GameConfig, seat: number) {
  return config.mode === '2x2' ? seat % 2 : seat;
}

export function teamCount(config: GameConfig) {
  return config.mode === '2x2' ? 2 : seatCount(config);
}

export interface SeatInput { id: string; name: string; isBot: boolean; botLevel?: PlayerSeat['botLevel'] }

export function createGame(config: GameConfig, players: SeatInput[], rng: Rng = Math.random): GameState {
  const n = seatCount(config);
  if (players.length !== n) throw new Error(`Modo ${config.mode} precisa de ${n} jogadores`);
  const state: GameState = {
    config: { ...config, draw: config.draw && n < 4 },
    seats: players.map((p, i) => ({ ...p, team: teamOf(config, i), hand: [] })),
    board: [],
    origin: 0,
    boneyard: [],
    current: 0,
    passesInRow: 0,
    round: 0,
    scores: Array(teamCount(config)).fill(0),
    status: 'playing',
    mustPlay: null,
    lastResult: null,
    nextStarter: -1,
    passedOn: players.map(() => []),
    log: [],
  };
  startRound(state, rng);
  return state;
}

export function startRound(state: GameState, rng: Rng = Math.random) {
  const deck = shuffle(fullSet(), rng);
  state.seats.forEach((s, i) => { s.hand = deck.slice(i * 7, i * 7 + 7); });
  state.boneyard = deck.slice(state.seats.length * 7);
  state.board = [];
  state.origin = 0;
  state.passesInRow = 0;
  state.passedOn = state.seats.map(() => []);
  state.round += 1;
  state.status = 'playing';
  state.lastResult = null;

  if (state.round === 1 || state.nextStarter < 0) {
    // 1ª rodada: começa quem tem a maior carroça (no 4 jogadores é sempre a 6-6),
    // se ninguém tiver carroça, a peça mais alta. É obrigado a jogá-la.
    let best: { seat: number; tile: Tile; score: number } | null = null;
    state.seats.forEach((s, seat) => s.hand.forEach((t) => {
      const score = (isDouble(t) ? 100 : 0) + pips(t) * 2 + Math.max(...t) / 10;
      if (!best || score > best.score) best = { seat, tile: t, score };
    }));
    state.current = best!.seat;
    state.mustPlay = best!.tile;
  } else {
    state.current = state.nextStarter;
    state.mustPlay = null;
  }
}

export function ends(state: GameState): [number, number] | null {
  if (!state.board.length) return null;
  return [state.board[0].left, state.board[state.board.length - 1].right];
}

export function fits(state: GameState, tile: Tile, side: Side): boolean {
  const e = ends(state);
  if (!e) return true;
  const v = side === 'left' ? e[0] : e[1];
  return tile[0] === v || tile[1] === v;
}

export function legalMoves(state: GameState, seat = state.current): Move[] {
  if (state.status !== 'playing' || seat !== state.current) return [];
  const hand = state.seats[seat].hand;
  const moves: Move[] = [];
  if (state.mustPlay) {
    return [{ type: 'play', tile: state.mustPlay, side: 'right' }];
  }
  const e = ends(state);
  for (const t of hand) {
    if (!e) { moves.push({ type: 'play', tile: t, side: 'right' }); continue; }
    if (fits(state, t, 'left')) moves.push({ type: 'play', tile: t, side: 'left' });
    // não duplica a jogada quando os dois lados resultam na mesma mesa
    if (fits(state, t, 'right') && !(e[0] === e[1] && fits(state, t, 'left'))) {
      moves.push({ type: 'play', tile: t, side: 'right' });
    }
  }
  if (moves.length) return moves;
  if (state.config.draw && state.boneyard.length) return [{ type: 'draw' }];
  return [{ type: 'pass' }];
}

function isLegal(state: GameState, move: Move) {
  return legalMoves(state).some((m) =>
    m.type === move.type &&
    (m.type !== 'play' || (move.type === 'play' && sameTile(m.tile, move.tile) &&
      (m.side === move.side || !state.board.length || (ends(state)![0] === ends(state)![1])))));
}

/** Aplica uma jogada do jogador da vez. Lança erro se for ilegal. */
export function applyMove(state: GameState, move: Move) {
  if (!isLegal(state, move)) throw new Error('Jogada inválida');
  const seat = state.current;
  const player = state.seats[seat];

  if (move.type === 'draw') {
    const t = state.boneyard.pop()!;
    player.hand.push(t);
    state.log.push({ type: 'draw', seat });
    return; // continua a vez do mesmo jogador
  }

  if (move.type === 'pass') {
    const e = ends(state);
    if (e) for (const v of e) if (!state.passedOn[seat].includes(v)) state.passedOn[seat].push(v);
    state.passesInRow += 1;
    state.log.push({ type: 'pass', seat });
    if (state.passesInRow >= state.seats.length) return finishRound(state, null);
    state.current = (seat + 1) % state.seats.length;
    return;
  }

  const tile = move.tile;
  const e = ends(state);
  const kind = batidaKind(state, tile, e);
  place(state, tile, move.side);
  player.hand = player.hand.filter((t) => !sameTile(t, tile));
  state.mustPlay = null;
  state.passesInRow = 0;
  state.log.push({ type: 'play', seat, tile, side: move.side });

  if (!player.hand.length) return finishRound(state, { seat, kind });
  state.current = (seat + 1) % state.seats.length;
}

function place(state: GameState, tile: Tile, side: Side) {
  const e = ends(state);
  if (!e) { state.board.push({ tile, left: tile[0], right: tile[1] }); return; }
  if (side === 'left') {
    const v = e[0];
    const other = tile[0] === v ? tile[1] : tile[0];
    state.board.unshift({ tile, left: other, right: v });
    state.origin += 1;
  } else {
    const v = e[1];
    const other = tile[0] === v ? tile[1] : tile[0];
    state.board.push({ tile, left: v, right: other });
  }
}

/** Tipo de batida caso essa seja a última peça do jogador. */
export function batidaKind(state: GameState, tile: Tile, e = ends(state)): BatidaKind {
  if (!e) return isDouble(tile) ? 'carroca' : 'simples';
  const fitsLeft = tile[0] === e[0] || tile[1] === e[0];
  const fitsRight = tile[0] === e[1] || tile[1] === e[1];
  const both = fitsLeft && fitsRight;
  if (isDouble(tile)) return both ? 'cruzada' : 'carroca';
  return both ? 'la-e-lo' : 'simples';
}

export const BATIDA_POINTS: Record<BatidaKind, number> = {
  simples: 1, carroca: 2, 'la-e-lo': 3, cruzada: 4,
};

function finishRound(state: GameState, batida: { seat: number; kind: BatidaKind } | null) {
  const remaining = state.seats.map((s) => handPips(s.hand));
  const nTeams = state.scores.length;
  const teamPips = Array(nTeams).fill(0);
  state.seats.forEach((s, i) => { teamPips[s.team] += remaining[i]; });

  let result: RoundResult;
  if (batida) {
    const winnerTeam = state.seats[batida.seat].team;
    const points = state.config.scoring === 'batidas'
      ? BATIDA_POINTS[batida.kind]
      : teamPips.reduce((s, p, t) => (t === winnerTeam ? s : s + p), 0);
    result = { winnerTeam, winnerSeat: batida.seat, kind: batida.kind, points, remaining };
  } else {
    // Trancado: vence o time com menos pontos na mão. Empate = ninguém pontua.
    const min = Math.min(...teamPips);
    const winners = teamPips.map((p, t) => (p === min ? t : -1)).filter((t) => t >= 0);
    if (winners.length > 1) {
      result = { winnerTeam: null, winnerSeat: null, kind: 'trancado', points: 0, remaining };
    } else {
      const winnerTeam = winners[0];
      // assento do time vencedor com menos pontos começa a próxima
      let winnerSeat = -1;
      state.seats.forEach((s, i) => {
        if (s.team === winnerTeam && (winnerSeat < 0 || remaining[i] < remaining[winnerSeat])) winnerSeat = i;
      });
      const points = state.config.scoring === 'batidas'
        ? 1
        : teamPips.reduce((s, p, t) => (t === winnerTeam ? s : s + p), 0);
      result = { winnerTeam, winnerSeat, kind: 'trancado', points, remaining };
    }
  }

  if (result.winnerTeam !== null) state.scores[result.winnerTeam] += result.points;
  state.lastResult = result;
  state.nextStarter = result.winnerSeat ?? state.current;
  state.log.push({ type: 'roundOver', result });

  if (state.round >= state.config.rounds) {
    state.status = 'matchOver';
    const max = Math.max(...state.scores);
    const leaders = state.scores.map((s, t) => (s === max ? t : -1)).filter((t) => t >= 0);
    state.log.push({ type: 'matchOver', winnerTeam: leaders.length === 1 ? leaders[0] : null });
  } else {
    state.status = 'roundOver';
  }
}

export function nextRound(state: GameState, rng: Rng = Math.random) {
  if (state.status !== 'roundOver') throw new Error('Rodada ainda não terminou');
  startRound(state, rng);
}

/**
 * Visão do estado para um jogador: as mãos dos outros e o monte viram peças "viradas"
 * ([-1,-1]) com a mesma quantidade, para o cliente nunca receber o que não pode ver.
 */
export function viewFor(state: GameState, seat: number | null): GameState {
  const hidden = (n: number) => Array.from({ length: n }, () => [-1, -1] as const);
  const reveal = state.status !== 'playing';
  return {
    ...state,
    boneyard: hidden(state.boneyard.length),
    seats: state.seats.map((s, i) => ({ ...s, hand: i === seat || reveal ? s.hand : hidden(s.hand.length) })),
  };
}
