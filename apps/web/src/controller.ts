import { useCallback, useEffect, useRef, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import type { BotLevel, GameConfig, GameState, Move } from '@domino/engine';
import { useLocalGame } from './useLocalGame';
import { QUICK_PHRASES, type ChatMsg } from './components/SidePanel';
import { sfx } from './sound';

/** O que a tela de jogo precisa, venha a partida do navegador (bots) ou do servidor. */
export interface GameCtrl {
  game: GameState;
  me: number;
  online: boolean;
  deadline: number | null;
  doMove: (m: Move) => void;
  /** só no modo local: o próprio jogador avança a rodada */
  continueRound?: () => void;
  /** online: quando a próxima rodada começa sozinha */
  nextRoundAt: number | null;
  msgs: ChatMsg[];
  send: (text: string) => void;
  offline: boolean[];
  onRematch?: () => void;
}

const BOT_REPLIES = ['Hahaha', 'Boa!', 'Calma que eu viro 😎', 'Tô de olho 👀', 'Essa foi sorte', '🔥', '😂', 'Vamos!'];

export function useLocalCtrl(config: GameConfig, level: BotLevel, name: string): GameCtrl {
  const { game, doMove, continueRound, deadline } = useLocalGame(config, level, name);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const id = useRef(0);
  const say = useCallback((seat: number, text: string) => {
    setMsgs((m) => [...m.slice(-60), { id: ++id.current, seat, text, at: Date.now() }]);
  }, []);
  const send = (text: string) => {
    say(0, text);
    if (Math.random() < 0.45) {
      const b = 1 + Math.floor(Math.random() * (game.seats.length - 1));
      setTimeout(() => say(b, BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)]), 1000 + Math.random() * 1500);
    }
  };
  useEffect(() => {
    const r = game.lastResult;
    if (!r || r.winnerSeat === null || r.winnerSeat === 0 || Math.random() < 0.4) return;
    setTimeout(() => say(r.winnerSeat!, r.kind === 'cruzada' || r.kind === 'la-e-lo' ? '🔥🔥🔥' : QUICK_PHRASES[4]), 600);
  }, [game.lastResult]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    game, me: 0, online: false, deadline, doMove, continueRound, nextRoundAt: null,
    msgs, send, offline: game.seats.map(() => false),
  };
}

// ------------------------------------------------------------------ online

export interface SlotInfo { name: string; isBot: boolean; connected: boolean; empty: boolean }
export interface RoomSnapshot {
  kind: 'public' | 'private';
  code: string;
  phase: 'waiting' | 'playing' | 'finished';
  config: GameConfig;
  level: BotLevel;
  mySeat: number;
  hostSeat: number;
  slots: SlotInfo[];
  game: GameState | null;
  turnMs: number | null;
  startInMs: number | null;
  nextRoundInMs: number | null;
}

/** Escuta a sala do servidor e devolve o último estado + chat, tocando os sons das jogadas. */
export function useRoom(room: Room) {
  const [snap, setSnap] = useState<RoomSnapshot | null>(null);
  const [recvAt, setRecvAt] = useState(Date.now());
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [dropped, setDropped] = useState(false);
  const logLen = useRef(0);
  const id = useRef(0);

  useEffect(() => {
    room.onMessage('state', (s: RoomSnapshot) => {
      const g = s.game;
      if (g) {
        // toca o som da última ação nova
        const fresh = g.log.slice(logLen.current);
        if (logLen.current && fresh.length) {
          const e = fresh[fresh.length - 1];
          if (e.type === 'play') sfx.clack(); else if (e.type === 'pass') sfx.pass(); else if (e.type === 'draw') sfx.draw();
          else if (e.type === 'roundOver' || e.type === 'matchOver') {
            const r = g.lastResult;
            setTimeout(() => (r && r.winnerTeam === g.seats[s.mySeat]?.team ? sfx.win() : sfx.lose()), 250);
          }
        }
        logLen.current = g.log.length;
      }
      setSnap(s);
      setRecvAt(Date.now());
    });
    room.onMessage('chat', (m: { seat: number; text: string; at: number }) => {
      setMsgs((x) => [...x.slice(-60), { id: ++id.current, seat: m.seat, text: m.text, at: Date.now() }]);
    });
    room.onLeave(() => setDropped(true));
    room.send('hello');
  }, [room]);

  return { snap, recvAt, msgs, dropped };
}

export function onlineCtrl(room: Room, snap: RoomSnapshot, recvAt: number, msgs: ChatMsg[]): GameCtrl {
  return {
    game: snap.game!,
    me: snap.mySeat,
    online: true,
    deadline: snap.turnMs != null ? recvAt + snap.turnMs : null,
    doMove: (m) => room.send('move', m),
    nextRoundAt: snap.nextRoundInMs != null ? recvAt + snap.nextRoundInMs : null,
    msgs,
    send: (text) => room.send('chat', text),
    offline: snap.slots.map((s) => !s.isBot && !s.connected),
    onRematch: () => room.send('rematch'),
  };
}
