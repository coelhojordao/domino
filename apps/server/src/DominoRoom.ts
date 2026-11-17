import { Room, type Client } from 'colyseus';
import {
  applyMove, botMove, createGame, DEFAULT_CONFIG, nextRound, seatCount, viewFor,
  type BotLevel, type GameConfig, type GameState, type Move,
} from '@domino/engine';

const BOT_NAMES = ['Zé Carroça', 'Dona Lurdes', 'Tião', 'Marquinhos', 'Cida', 'Seu Bené', 'Toninho', 'Neide'];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I para não confundir
const PUBLIC_WAIT_MS = 15_000; // tempo esperando gente na sala pública antes de completar com bots
const NEXT_ROUND_MS = 7_000;

interface SeatSlot { sessionId: string | null; name: string; connected: boolean; isBot: boolean }

export interface RoomOptions {
  kind: 'public' | 'private';
  mode?: GameConfig['mode'];
  config?: Partial<GameConfig>;
  level?: BotLevel;
  name?: string;
}

const clean = (s: unknown, max: number) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, max);

function sanitizeConfig(c: Partial<GameConfig> = {}): GameConfig {
  const mode = (['1x1', '2x2', '4-individual'] as const).includes(c.mode as never) ? c.mode! : DEFAULT_CONFIG.mode;
  return {
    mode,
    draw: !!c.draw && mode === '1x1',
    scoring: c.scoring === 'pontos' ? 'pontos' : 'batidas',
    rounds: Math.min(50, Math.max(1, Math.floor(Number(c.rounds) || DEFAULT_CONFIG.rounds))),
    turnSeconds: [0, 10, 20, 30].includes(Number(c.turnSeconds)) ? Number(c.turnSeconds) : 20,
  };
}

export class DominoRoom extends Room {
  kind: 'public' | 'private' = 'public';
  config: GameConfig = DEFAULT_CONFIG;
  level: BotLevel = 'medio';
  slots: SeatSlot[] = [];
  hostSeat = 0;
  phase: 'waiting' | 'playing' | 'finished' = 'waiting';
  game: GameState | null = null;
  timers: ReturnType<typeof setTimeout>[] = [];
  startAt: number | null = null;
  turnEndsAt: number | null = null;
  nextRoundAt: number | null = null;
  lastChat = new Map<string, number>();

  async onCreate(options: RoomOptions) {
    this.kind = options.kind === 'private' ? 'private' : 'public';
    this.config = this.kind === 'public'
      ? { ...DEFAULT_CONFIG, mode: sanitizeConfig({ mode: options.mode }).mode, rounds: 6, turnSeconds: 20 }
      : sanitizeConfig(options.config);
    this.level = (['facil', 'medio', 'dificil'] as const).includes(options.level as never) ? options.level! : 'medio';
    const n = seatCount(this.config);
    this.maxClients = n;
    this.slots = Array.from({ length: n }, () => ({ sessionId: null, name: '', connected: false, isBot: false }));

    if (this.kind === 'private') {
      // código curto para mandar no WhatsApp
      this.roomId = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
      await this.setPrivate(true);
    }
    await this.setMetadata({ mode: this.config.mode, kind: this.kind });

    this.onMessage('move', (client, move: Move) => this.handleMove(client, move));
    // o cliente pede o estado assim que registra os handlers
    this.onMessage('hello', () => this.sync());
    this.onMessage('chat', (client, text: string) => this.handleChat(client, text));
    this.onMessage('start', (client, data: { level?: BotLevel }) => {
      if (this.seatOf(client) !== this.hostSeat || this.phase !== 'waiting') return;
      if (data?.level && ['facil', 'medio', 'dificil'].includes(data.level)) this.level = data.level;
      this.startMatch();
    });
    this.onMessage('rematch', (client) => {
      if (this.phase !== 'finished' || this.seatOf(client) < 0) return;
      this.startMatch();
    });
  }

  onJoin(client: Client, options: RoomOptions) {
    const seat = this.slots.findIndex((s) => !s.sessionId && !s.isBot);
    if (seat < 0) throw new Error('Mesa cheia');
    this.slots[seat] = { sessionId: client.sessionId, name: clean(options?.name, 16) || 'Jogador', connected: true, isBot: false };
    if (!this.slots.some((s, i) => i !== seat && s.sessionId)) this.hostSeat = seat;

    if (this.kind === 'public' && this.phase === 'waiting') {
      if (this.slots.every((s) => s.sessionId)) this.startMatch();
      else if (!this.startAt) {
        this.startAt = Date.now() + PUBLIC_WAIT_MS;
        this.later(PUBLIC_WAIT_MS, () => { if (this.phase === 'waiting') this.startMatch(); });
      }
    }
    this.sync();
  }

  onDrop(client: Client) {
    const seat = this.seatOf(client);
    if (seat < 0 || this.phase === 'waiting') return;
    this.slots[seat].connected = false;
    this.sync();
    this.schedule(); // se era a vez dele, o bot assume
    this.allowReconnection(client, 45);
  }

  onReconnect(client: Client) {
    const seat = this.seatOf(client);
    if (seat < 0) return;
    this.slots[seat].connected = true;
    this.sync();
    this.schedule();
  }

  onLeave(client: Client) {
    const seat = this.seatOf(client);
    if (seat < 0) return;
    if (this.phase === 'waiting') {
      this.slots[seat] = { sessionId: null, name: '', connected: false, isBot: false };
    } else {
      // saiu no meio da partida: um bot assume o lugar
      const name = `${this.slots[seat].name} (bot)`;
      this.slots[seat] = { sessionId: null, name, connected: false, isBot: true };
      if (this.game) { this.game.seats[seat].isBot = true; this.game.seats[seat].botLevel = 'medio'; this.game.seats[seat].name = name; }
    }
    if (seat === this.hostSeat) {
      const next = this.slots.findIndex((s) => s.sessionId);
      if (next >= 0) this.hostSeat = next;
    }
    this.sync();
    this.schedule();
  }

  onDispose() { this.clearTimers(); }

  // ---------------------------------------------------------------

  private seatOf(client: Client) { return this.slots.findIndex((s) => s.sessionId === client.sessionId); }

  private later(ms: number, fn: () => void) { this.timers.push(setTimeout(fn, ms)); }
  private clearTimers() { this.timers.forEach(clearTimeout); this.timers = []; }

  private startMatch() {
    this.clearTimers();
    const names = BOT_NAMES.filter((b) => !this.slots.some((s) => s.name === b)).sort(() => Math.random() - 0.5);
    this.slots.forEach((s) => {
      if (!s.sessionId && !s.isBot) { s.isBot = true; s.name = names.pop() ?? 'Bot'; }
    });
    this.game = createGame(this.config, this.slots.map((s, i) => ({
      id: s.sessionId ?? `bot${i}`, name: s.name, isBot: s.isBot, botLevel: s.isBot ? this.level : undefined,
    })));
    this.phase = 'playing';
    this.startAt = null;
    void this.lock();
    this.sync();
    this.schedule();
  }

  /** Agenda o próximo passo: jogada de bot, tempo esgotado ou próxima rodada. */
  private schedule() {
    this.clearTimers();
    this.turnEndsAt = null;
    this.nextRoundAt = null;
    const g = this.game;
    if (!g || this.phase !== 'playing') return;

    if (g.status === 'roundOver') {
      this.nextRoundAt = Date.now() + NEXT_ROUND_MS;
      this.later(NEXT_ROUND_MS, () => { nextRound(g); this.sync(); this.schedule(); });
      return;
    }
    if (g.status === 'matchOver') { this.phase = 'finished'; this.sync(); return; }

    const seat = g.current;
    const slot = this.slots[seat];
    if (slot.isBot || !slot.connected) {
      const level = slot.isBot ? this.level : 'medio';
      this.later(700 + Math.random() * 700, () => this.apply(botMove(g, level)));
    } else if (this.config.turnSeconds) {
      this.turnEndsAt = Date.now() + this.config.turnSeconds * 1000;
      this.later(this.config.turnSeconds * 1000, () => this.apply(botMove(g, 'medio')));
    }
  }

  private apply(move: Move) {
    if (!this.game) return false;
    try { applyMove(this.game, move); } catch { return false; }
    this.sync();
    this.schedule();
    return true;
  }

  private handleMove(client: Client, move: Move) {
    const seat = this.seatOf(client);
    if (!this.game || this.phase !== 'playing' || seat !== this.game.current) return;
    if (!move || !['play', 'pass', 'draw'].includes(move.type)) return;
    this.apply(move);
  }

  private handleChat(client: Client, text: string) {
    const seat = this.seatOf(client);
    const now = Date.now();
    if (seat < 0 || now - (this.lastChat.get(client.sessionId) ?? 0) < 800) return;
    const msg = clean(text, 80);
    if (!msg) return;
    this.lastChat.set(client.sessionId, now);
    this.broadcast('chat', { seat, text: msg, at: now });
  }

  /** Manda para cada jogador só o que ele pode ver. */
  private sync() {
    const now = Date.now();
    for (const client of this.clients) {
      const seat = this.seatOf(client);
      client.send('state', {
        kind: this.kind,
        code: this.roomId,
        phase: this.phase,
        config: this.config,
        level: this.level,
        mySeat: seat,
        hostSeat: this.hostSeat,
        slots: this.slots.map((s) => ({ name: s.name, isBot: s.isBot, connected: s.connected, empty: !s.sessionId && !s.isBot })),
        game: this.game ? viewFor(this.game, seat) : null,
        turnMs: this.turnEndsAt ? this.turnEndsAt - now : null,
        startInMs: this.startAt ? this.startAt - now : null,
        nextRoundInMs: this.nextRoundAt ? this.nextRoundAt - now : null,
      });
    }
  }
}
