import { useEffect, useMemo, useState } from 'react';
import {
  ends, handPips, legalMoves, type GameState, type Move, type Side, type Tile as T,
} from '@domino/engine';
import type { GameCtrl } from '../controller';
import { Board, type SeatPos } from './Board';
import { Tile } from './Tile';
import { AdSlot } from './AdSlot';
import { Icon } from './Icon';
import { SidePanel } from './SidePanel';
import { sfx } from '../sound';

const KIND_LABEL: Record<string, string> = {
  simples: 'Batida simples', carroca: 'Batida de carroça', 'la-e-lo': 'Lá-e-lô!', cruzada: 'Cruzada!!', trancado: 'Jogo trancado',
};

function teamName(g: GameState, team: number, me: number) {
  if (g.config.mode === '2x2') return team === g.seats[me].team ? 'Nós' : 'Eles';
  return g.seats[team].name;
}
const positions = (n: number): SeatPos[] => (n === 2 ? ['bottom', 'top'] : ['bottom', 'right', 'top', 'left']);

function useWide() {
  const [wide, setWide] = useState(() => window.innerWidth >= 960);
  useEffect(() => {
    const f = () => setWide(window.innerWidth >= 960);
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return wide;
}

/** Anel em volta do avatar: contagem regressiva (você) ou girando (bots pensando). */
function Ring({ deadline, total, active }: { deadline: number | null; total: number; active: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!deadline) return;
    const i = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(i);
  }, [deadline]);
  if (!active) return null;
  const C = 2 * Math.PI * 30;
  if (!deadline || !total) {
    return <svg className="ring spin" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" strokeDasharray={`${C * 0.25} ${C}`} /></svg>;
  }
  const frac = Math.max(0, deadline - now) / (total * 1000);
  return (
    <svg className={`ring ${frac < 0.25 ? 'hurry' : ''}`} viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="30" className="ring-bg" />
      <circle cx="32" cy="32" r="30" strokeDasharray={`${C * frac} ${C}`} transform="rotate(-90 32 32)" />
    </svg>
  );
}

function SeatCard({ game, seat, pos, active, deadline, bubble, me, mySeat, offline }: {
  game: GameState; seat: number; pos: SeatPos; active: boolean; deadline: number | null; bubble?: string; me?: boolean;
  mySeat: number; offline?: boolean;
}) {
  const s = game.seats[seat];
  const count = s.hand.length;
  return (
    <div className={`seat seat-${pos} ${active ? 'active' : ''} ${me ? 'me' : ''} ${offline ? 'offline' : ''}`}>
      <div className="avatar-wrap">
        <div className={`avatar t${s.team}`}>
          {s.isBot ? <Icon name="bot" size={22} /> : s.name.slice(0, 1).toUpperCase()}
        </div>
        <Ring deadline={me ? deadline : null} total={game.config.turnSeconds} active={active} />
        {bubble && <div className={`bubble from-${pos}`} key={bubble}>{bubble}</div>}
      </div>
      <div className="seat-info">
        <div className="seat-name" title={s.name}>{s.name}</div>
        <div className="seat-sub">
          <span className={`team-chip t${s.team}`}>{game.config.mode === '2x2' ? (s.team === game.seats[mySeat].team ? 'Nós' : 'Eles') : `J${seat + 1}`}</span>
          {offline && <span className="offline-tag">reconectando…</span>}
          {!me && <span className="count">{count} {count === 1 ? 'peça' : 'peças'}</span>}
        </div>
        {!me && (
          <div className="backs">
            {Array.from({ length: count }, (_, k) => <Tile key={k} a={0} b={0} size={8} vertical faceDown />)}
          </div>
        )}
      </div>
    </div>
  );
}

export function Table({ ctrl, onExit, roomCode }: { ctrl: GameCtrl; onExit: () => void; roomCode?: string }) {
  const { game, doMove, continueRound, deadline, msgs, send, me } = ctrl;
  const wide = useWide();
  const [picked, setPicked] = useState<T | null>(null);
  const [muted, setMuted] = useState(sfx.isMuted());
  const [panelOpen, setPanelOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const myTurn = game.status === 'playing' && game.current === me;
  const moves = useMemo(() => (myTurn ? legalMoves(game, me) : []), [game, myTurn]);
  const n = game.seats.length;
  const pos = positions(n).map((_, i, arr) => arr[(i - me + n) % n]);
  const lastEvent = game.log[game.log.length - 1];
  const lastPlay = [...game.log].reverse().find((e) => e.type === 'play');
  const lastKey = lastPlay?.type === 'play' ? `${lastPlay.tile[0]}-${lastPlay.tile[1]}` : undefined;
  const lastFrom = lastPlay?.type === 'play' ? pos[lastPlay.seat] : undefined;

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(i); }, []);

  const bubbleFor = (seat: number) => {
    const m = [...msgs].reverse().find((x) => x.seat === seat && now - x.at < 3500);
    if (m) return m.text;
    if (lastEvent?.type === 'pass' && lastEvent.seat === seat) return 'Passou';
    if (lastEvent?.type === 'draw' && lastEvent.seat === seat) return 'Comprou';
    return undefined;
  };

  // ---- jogadas ----
  const playsFor = (t: T) => moves.filter((m): m is Extract<Move, { type: 'play' }> =>
    m.type === 'play' && m.tile[0] === t[0] && m.tile[1] === t[1]);
  const pickedSides: Side[] = picked ? playsFor(picked).map((m) => m.side) : [];

  const onTile = (t: T) => {
    const ps = playsFor(t);
    if (!ps.length) return;
    if (picked && picked[0] === t[0] && picked[1] === t[1]) { setPicked(null); return; }
    if (ps.length === 1) { setPicked(null); doMove(ps[0]); return; }
    setPicked(t);
  };
  const onTarget = (side: Side) => { if (picked) { doMove({ type: 'play', tile: picked, side }); setPicked(null); } };

  useEffect(() => { if (!myTurn) setPicked(null); }, [myTurn]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setPicked(null); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const onlyPass = moves.length === 1 && moves[0].type === 'pass';
  useEffect(() => {
    if (!onlyPass) return;
    const t = setTimeout(() => doMove({ type: 'pass' }), 1300);
    return () => clearTimeout(t);
  }, [onlyPass, game.log.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const fullscreen = () => {
    try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch { /* sem suporte */ }
  };

  const hand = game.seats[me].hand.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const res = game.lastResult;
  const finished = game.status === 'matchOver';
  const myTeam = game.seats[me].team;
  const maxScore = Math.max(...game.scores);
  const e = ends(game);
  const handSize = wide ? 46 : 32;

  const status = game.status !== 'playing' ? '' :
    myTurn
      ? onlyPass ? 'Sem peça para jogar… passando'
        : game.mustPlay ? 'Você começa: jogue a carroça destacada'
          : picked ? 'Clique em uma das pontas brilhando na mesa'
            : moves[0]?.type === 'draw' ? 'Sem jogada: compre do monte' : 'Sua vez! Escolha uma peça'
      : `${game.seats[game.current].name} está pensando…`;

  return (
    <div className={`game ${wide ? 'wide' : 'narrow'}`}>
      <header className="topbar">
        <button className="icon-btn" onClick={onExit} title="Sair da mesa"><Icon name="back" /></button>
        <div className="scoreboard">
          {game.scores.map((s, t) => (
            <div key={t} className={`score-team t${t} ${t === myTeam ? 'mine' : ''}`}>
              <span className="score-name">{teamName(game, t, me)}</span>
              <span className="score-num" key={s}>{s}</span>
            </div>
          ))}
          <div className="round-info">
            <span>Rodada {game.round} de {game.config.rounds}</span>
            <div className="round-dots">
              {Array.from({ length: Math.min(game.config.rounds, 20) }, (_, i) => (
                <i key={i} className={i < game.round - 1 ? 'done' : i === game.round - 1 ? 'now' : ''} />
              ))}
            </div>
          </div>
        </div>
        <div className="top-actions">
          {roomCode && <span className="room-code" title="Código da sala">Sala <b>{roomCode}</b></span>}
          <button className="icon-btn" onClick={() => setMuted(sfx.toggle())} title="Som"><Icon name={muted ? 'mute' : 'sound'} /></button>
          {wide && <button className="icon-btn" onClick={fullscreen} title="Tela cheia"><Icon name="full" /></button>}
          {!wide && <button className="icon-btn" onClick={() => setPanelOpen(true)} title="Jogadas e chat"><Icon name="chat" /></button>}
        </div>
      </header>

      <div className="game-main">
        <div className="table-col">
          <div className={`felt seats-${game.seats.length}`}>
            {game.seats.map((_, i) => i === me ? null : (
              <SeatCard key={i} game={game} seat={i} pos={pos[i]} deadline={null} bubble={bubbleFor(i)} mySeat={me} offline={ctrl.offline[i]}
                active={game.current === i && game.status === 'playing'} />
            ))}
            <div className="board-area">
              <Board board={game.board} origin={game.origin} lastKey={lastKey} lastFrom={lastFrom}
                picked={picked} targets={pickedSides} onTarget={onTarget} maxUnit={wide ? 64 : 40} />
            </div>
            {e && (
              <div className="ends-info">
                Pontas <b>{e[0]}</b><span>·</span><b>{e[1]}</b>
                {game.config.draw && <em>Monte {game.boneyard.length}</em>}
              </div>
            )}
          </div>

          <div className={`my-area ${myTurn ? 'my-turn' : ''}`}>
            <SeatCard game={game} seat={me} pos="bottom" me mySeat={me} deadline={deadline} bubble={bubbleFor(me)}
              active={myTurn} />
            <div className="hand-col">
              <div className="status-line">{status}</div>
              <div className="hand" key={game.round}>
                {hand.map((t, idx) => {
                  const ps = playsFor(t);
                  const can = ps.length > 0;
                  const sel = picked && picked[0] === t[0] && picked[1] === t[1];
                  return (
                    <div key={`${t[0]}-${t[1]}`} className={`hand-slot ${myTurn ? (can ? 'playable' : 'dim') : ''} ${sel ? 'selected' : ''}`}
                      style={{ animationDelay: `${idx * 70}ms` }}
                      onClick={() => onTile(t)} title={can && ps.length > 1 ? 'Encaixa nas duas pontas' : undefined}>
                      <Tile a={t[0]} b={t[1]} size={handSize} vertical />
                      {myTurn && can && ps.length > 1 && <span className="two-sides">2</span>}
                    </div>
                  );
                })}
              </div>
              {myTurn && moves[0]?.type === 'draw' && (
                <button className="btn-play small" onClick={() => doMove({ type: 'draw' })}>Comprar do monte ({game.boneyard.length})</button>
              )}
            </div>
            <div className="my-pips">{hand.length ? <>Na mão<b>{handPips(hand)}</b>pontos</> : null}</div>
          </div>
        </div>

        {(wide || panelOpen) && (
          <div className={wide ? 'panel-col' : 'drawer'} onClick={(ev) => { if (ev.target === ev.currentTarget) setPanelOpen(false); }}>
            <SidePanel game={game} me={me} msgs={msgs} onSend={send} onClose={wide ? undefined : () => setPanelOpen(false)} />
            {wide && <AdSlot kind="side" />}
          </div>
        )}
      </div>

      {game.status !== 'playing' && res && (
        <div className="modal-bg">
          <div className="modal">
            <div className="modal-icon"><Icon name={finished ? 'trophy' : res.kind === 'trancado' ? 'pass' : 'trophy'} size={30} /></div>
            <h2>{finished
              ? (maxScore === game.scores[myTeam] && game.scores.filter((s) => s === maxScore).length === 1 ? 'Vitória!' : game.scores.filter((s) => s === maxScore).length > 1 ? 'Empate!' : 'Fim de jogo')
              : KIND_LABEL[res.kind]}</h2>
            <p className="result-line">
              {res.winnerTeam === null ? 'Ninguém pontuou nesta rodada.'
                : <>{res.winnerSeat !== null ? game.seats[res.winnerSeat].name : teamName(game, res.winnerTeam, me)}
                  {' '}{res.kind === 'trancado' ? 'tinha menos pontos na mão' : 'bateu'} · <b>+{res.points}</b> para {teamName(game, res.winnerTeam, me)}</>}
            </p>
            <div className="hands-left">
              {game.seats.map((s) => (
                <div key={s.id} className="hl-row">
                  <span className={`dot t${s.team}`} /> <span className="hl-name">{s.name}</span>
                  <span className="hl-tiles">{s.hand.map((t) => <Tile key={`${t[0]}-${t[1]}`} a={t[0]} b={t[1]} size={13} />)}</span>
                  <b>{handPips(s.hand)}</b>
                </div>
              ))}
            </div>
            <div className="final-scores">
              {game.scores.map((s, t) => <span key={t} className={`team-pill t${t}`}>{teamName(game, t, me)} <b>{s}</b></span>)}
            </div>
            <AdSlot kind="box" />
            {finished ? (
              <div className="row-btns">
                {ctrl.onRematch && <button className="btn-play" onClick={ctrl.onRematch}>Jogar de novo</button>}
                <button className={ctrl.onRematch ? 'btn-ghost' : 'btn-play'} onClick={onExit}>Voltar ao menu</button>
              </div>
            ) : continueRound
              ? <button className="btn-play" onClick={continueRound} autoFocus>Próxima rodada</button>
              : <div className="next-in">Próxima rodada em {Math.max(0, Math.ceil(((ctrl.nextRoundAt ?? now) - now) / 1000))}s…</div>}
          </div>
        </div>
      )}
    </div>
  );
}
