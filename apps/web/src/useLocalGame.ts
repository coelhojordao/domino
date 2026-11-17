import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applyMove, botMove, createGame, nextRound, seatCount,
  type BotLevel, type GameConfig, type GameState, type Move,
} from '@domino/engine';
import { sfx } from './sound';

const BOT_NAMES = ['Zé Carroça', 'Dona Lurdes', 'Tião', 'Marquinhos', 'Cida', 'Seu Bené'];

const clone = (g: GameState): GameState => structuredClone(g);

/** Partida local contra bots, usando o mesmo motor que o servidor vai usar. */
export function useLocalGame(config: GameConfig, level: BotLevel, playerName: string) {
  const [game, setGame] = useState<GameState>(() => {
    const n = seatCount(config);
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    return createGame(config, Array.from({ length: n }, (_, i) => i === 0
      ? { id: 'me', name: playerName || 'Você', isBot: false }
      : { id: `bot${i}`, name: names[i], isBot: true, botLevel: level }));
  });
  const [deadline, setDeadline] = useState<number | null>(null);
  const turnKey = `${game.round}-${game.log.length}-${game.status}`;
  const gameRef = useRef(game);
  gameRef.current = game;

  const doMove = useCallback((move: Move) => {
    const next = clone(gameRef.current);
    try { applyMove(next, move); } catch { return; }
    if (move.type === 'play') sfx.clack(); else if (move.type === 'pass') sfx.pass(); else sfx.draw();
    if (next.status !== 'playing') {
      const r = next.lastResult;
      setTimeout(() => (r && r.winnerTeam === next.seats[0].team ? sfx.win() : sfx.lose()), 250);
    }
    gameRef.current = next;
    setGame(next);
  }, []);

  // vez dos bots + timer
  useEffect(() => {
    if (game.status !== 'playing') { setDeadline(null); return; }
    const seat = game.seats[game.current];
    if (seat.isBot) {
      setDeadline(null);
      const t = setTimeout(() => doMove(botMove(gameRef.current, seat.botLevel)), 650 + Math.random() * 700);
      return () => clearTimeout(t);
    }
    if (!config.turnSeconds) { setDeadline(null); return; }
    const end = Date.now() + config.turnSeconds * 1000;
    setDeadline(end);
    // tempo esgotado: o bot joga por você
    const t = setTimeout(() => doMove(botMove(gameRef.current, 'medio')), config.turnSeconds * 1000);
    return () => clearTimeout(t);
  }, [turnKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const continueRound = useCallback(() => {
    setGame((g) => { const n = clone(g); nextRound(n); return n; });
  }, []);

  return { game, doMove, continueRound, deadline };
}
