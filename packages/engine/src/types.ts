export type Tile = readonly [number, number]; // sempre a <= b

export type Mode = '1x1' | '2x2' | '4-individual';
export type Scoring = 'batidas' | 'pontos';
export type BotLevel = 'facil' | 'medio' | 'dificil';

export interface GameConfig {
  mode: Mode;
  /** Comprar do monte quando não tiver jogada (só existe monte com menos de 4 jogadores). */
  draw: boolean;
  /** batidas: simples 1, carroça 2, lá-e-lô 3, cruzada 4. pontos: soma das peças dos adversários. */
  scoring: Scoring;
  /** Quantidade de rodadas da partida. */
  rounds: number;
  /** Segundos por jogada (0 = sem limite). */
  turnSeconds: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  mode: '2x2',
  draw: false,
  scoring: 'batidas',
  rounds: 10,
  turnSeconds: 20,
};

export interface PlayerSeat {
  id: string;
  name: string;
  isBot: boolean;
  botLevel?: BotLevel;
  team: number;
  hand: Tile[];
}

export interface PlacedTile {
  tile: Tile;
  /** valor que fica virado para a esquerda e para a direita na mesa */
  left: number;
  right: number;
}

export type Side = 'left' | 'right';

export type BatidaKind = 'simples' | 'carroca' | 'la-e-lo' | 'cruzada';

export interface RoundResult {
  /** time vencedor, ou null em empate no trancado */
  winnerTeam: number | null;
  winnerSeat: number | null;
  kind: BatidaKind | 'trancado';
  points: number;
  /** soma das peças restantes por assento, para mostrar no resumo */
  remaining: number[];
}

export type GameEvent =
  | { type: 'play'; seat: number; tile: Tile; side: Side }
  | { type: 'pass'; seat: number }
  | { type: 'draw'; seat: number }
  | { type: 'roundOver'; result: RoundResult }
  | { type: 'matchOver'; winnerTeam: number | null };

export interface GameState {
  config: GameConfig;
  seats: PlayerSeat[];
  board: PlacedTile[];
  /** índice, em board, da primeira peça jogada na rodada (o centro da mesa) */
  origin: number;
  boneyard: Tile[];
  current: number;
  passesInRow: number;
  round: number;
  /** pontos por time */
  scores: number[];
  status: 'playing' | 'roundOver' | 'matchOver';
  /** na 1ª rodada, a peça que o primeiro jogador é obrigado a jogar */
  mustPlay: Tile | null;
  lastResult: RoundResult | null;
  /** quem começa a próxima rodada */
  nextStarter: number;
  /** números em que cada assento já passou (informação pública, usada pelos bots) */
  passedOn: number[][];
  log: GameEvent[];
}

export type Move =
  | { type: 'play'; tile: Tile; side: Side }
  | { type: 'draw' }
  | { type: 'pass' };
