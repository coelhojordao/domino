import { useEffect, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import type { BotLevel } from '@domino/engine';
import type { RoomSnapshot } from '../controller';
import { Icon } from './Icon';
import { AdSlot } from './AdSlot';

const MODE: Record<string, string> = { '2x2': 'Duplas 2x2', '1x1': '1x1', '4-individual': '4 individual' };

export function WaitingRoom({ room, snap, recvAt, onExit }: {
  room: Room; snap: RoomSnapshot; recvAt: number; onExit: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [level, setLevel] = useState<BotLevel>(snap.level);
  const [copied, setCopied] = useState(false);
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(i); }, []);

  const isHost = snap.mySeat === snap.hostSeat;
  const link = `${location.origin}${location.pathname}?sala=${snap.code}`;
  const startsIn = snap.startInMs != null ? Math.max(0, Math.ceil((recvAt + snap.startInMs - now) / 1000)) : null;
  const filled = snap.slots.filter((s) => !s.empty).length;
  const team = (i: number) => (snap.config.mode === '2x2' ? i % 2 : i);

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* sem permissão */ }
  };

  return (
    <div className="waiting">
      <div className="waiting-card">
        <div className="waiting-head">
          <button className="icon-btn" onClick={onExit} title="Sair"><Icon name="back" /></button>
          <h2>{snap.kind === 'public' ? 'Sala pública' : 'Sala privada'}</h2>
          <span className="mode-tag">{MODE[snap.config.mode]}</span>
        </div>

        {snap.kind === 'private' && (
          <div className="invite">
            <span>Código da sala</span>
            <div className="code">{snap.code}</div>
            <div className="invite-actions">
              <button className="btn-ghost" onClick={copy}>{copied ? 'Link copiado!' : 'Copiar link de convite'}</button>
              <a className="btn-ghost" href={`https://wa.me/?text=${encodeURIComponent(`Bora jogar dominó? Entra na minha sala: ${link}`)}`} target="_blank" rel="noreferrer">Mandar no WhatsApp</a>
            </div>
          </div>
        )}

        <div className="slots">
          {snap.slots.map((s, i) => (
            <div key={i} className={`slot ${s.empty ? 'empty' : ''}`}>
              <div className={`avatar t${team(i)}`}>{s.empty ? '?' : s.name.slice(0, 1).toUpperCase()}</div>
              <div className="slot-name">
                {s.empty ? 'Aguardando jogador…' : s.name}
                {i === snap.mySeat && <em> (você)</em>}
              </div>
              {i === snap.hostSeat && !s.empty && <span className="host-tag">dono</span>}
              {snap.config.mode === '2x2' && <span className={`team-chip t${i % 2}`}>Dupla {i % 2 === 0 ? 'A' : 'B'}</span>}
            </div>
          ))}
        </div>

        <p className="rules-line">
          {snap.config.scoring === 'batidas' ? 'Pontuação por batida' : 'Soma das peças'} · {snap.config.rounds} rodadas
          · {snap.config.turnSeconds ? `${snap.config.turnSeconds}s por jogada` : 'sem limite de tempo'}
          {snap.config.draw ? ' · com compra' : ''}
        </p>

        {snap.kind === 'public' ? (
          <div className="waiting-foot">
            <div className="countdown">{startsIn !== null ? <>Começa em <b>{startsIn}s</b></> : 'Começando…'}</div>
            <small>Se faltar gente, bots completam a mesa. {filled}/{snap.slots.length} na sala.</small>
          </div>
        ) : isHost ? (
          <div className="waiting-foot">
            <div className="seg">
              {(['facil', 'medio', 'dificil'] as const).map((l) => (
                <button key={l} className={level === l ? 'on' : ''} onClick={() => setLevel(l)}>
                  Bots {l === 'facil' ? 'fáceis' : l === 'medio' ? 'médios' : 'difíceis'}
                </button>
              ))}
            </div>
            <button className="btn-play" onClick={() => room.send('start', { level })}>
              Começar {filled < snap.slots.length ? `(${snap.slots.length - filled} bot${snap.slots.length - filled > 1 ? 's' : ''})` : ''}
            </button>
          </div>
        ) : (
          <div className="waiting-foot"><div className="countdown">Esperando o dono da sala começar…</div></div>
        )}
      </div>
      <AdSlot kind="banner" />
    </div>
  );
}
