import { useEffect, useRef, useState } from 'react';
import type { GameState } from '@domino/engine';
import { Tile } from './Tile';
import { Icon } from './Icon';

export interface ChatMsg { id: number; seat: number; text: string; at: number }

export const QUICK_PHRASES = ['Boa jogada!', 'Vamos, parceiro!', 'Tá difícil hein 😅', 'Essa doeu!', 'Bateu bonito!', 'GG'];
export const EMOJIS = ['👏', '😂', '😮', '😡', '🔥', '🙏', '😎', '🤝'];

const KIND: Record<string, string> = {
  simples: 'batida simples', carroca: 'batida de carroça', 'la-e-lo': 'lá-e-lô', cruzada: 'cruzada', trancado: 'jogo trancado',
};

function History({ game }: { game: GameState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' }); }, [game.log.length]);
  let round = 1;
  let firstOfRound = true;
  const items: JSX.Element[] = [<div key="r1" className="h-round">Rodada 1</div>];
  game.log.forEach((e, i) => {
    if (e.type === 'play') {
      const s = game.seats[e.seat];
      const first = firstOfRound; firstOfRound = false;
      items.push(
        <div key={i} className="h-item">
          <span className={`dot t${s.team}`} />
          <b>{s.name}</b>
          <Tile a={e.tile[0]} b={e.tile[1]} size={12} />
          <span className="h-side">{first ? 'saída' : e.side === 'left' ? '◂ esquerda' : 'direita ▸'}</span>
        </div>,
      );
    } else if (e.type === 'pass') {
      const s = game.seats[e.seat];
      items.push(<div key={i} className="h-item muted"><span className={`dot t${s.team}`} /><b>{s.name}</b> passou</div>);
    } else if (e.type === 'draw') {
      const s = game.seats[e.seat];
      items.push(<div key={i} className="h-item muted"><span className={`dot t${s.team}`} /><b>{s.name}</b> comprou do monte</div>);
    } else if (e.type === 'roundOver') {
      const r = e.result;
      items.push(
        <div key={i} className="h-result">
          {r.winnerSeat !== null ? <>{game.seats[r.winnerSeat].name}: {KIND[r.kind]} · +{r.points}</> : 'Trancado empatado · 0'}
        </div>,
      );
      firstOfRound = true;
      if (i < game.log.length - 1 && game.log[i + 1]?.type !== 'matchOver') {
        round += 1;
        items.push(<div key={`r${round}`} className="h-round">Rodada {round}</div>);
      }
    }
  });
  return <div className="history" ref={ref}>{items}</div>;
}

function Chat({ game, me, msgs, onSend }: { game: GameState; me: number; msgs: ChatMsg[]; onSend: (t: string) => void }) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' }); }, [msgs.length]);
  return (
    <div className="chat">
      <div className="chat-msgs" ref={ref}>
        {!msgs.length && <div className="chat-empty">Mande uma reação para a mesa 👇</div>}
        {msgs.map((m) => {
          const s = game.seats[m.seat];
          return (
            <div key={m.id} className={`chat-msg ${m.seat === me ? 'me' : ''}`}>
              {m.seat !== me && <span className={`chat-name c${s.team}`}>{s.name}</span>}
              <span className="chat-text">{m.text}</span>
            </div>
          );
        })}
      </div>
      <div className="quick">
        <div className="emojis">{EMOJIS.map((e) => <button key={e} onClick={() => onSend(e)}>{e}</button>)}</div>
        <div className="phrases">{QUICK_PHRASES.map((p) => <button key={p} onClick={() => onSend(p)}>{p}</button>)}</div>
        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onSend(text.trim()); setText(''); } }}>
          <input value={text} maxLength={80} placeholder="Escreva uma mensagem…" onChange={(e) => setText(e.target.value)} />
          <button type="submit">Enviar</button>
        </form>
      </div>
    </div>
  );
}

export function SidePanel({ game, me, msgs, onSend, onClose }: {
  game: GameState; me: number; msgs: ChatMsg[]; onSend: (t: string) => void; onClose?: () => void;
}) {
  const [tab, setTab] = useState<'chat' | 'hist'>('hist');
  return (
    <aside className="side-panel">
      <div className="tabs">
        <button className={tab === 'hist' ? 'on' : ''} onClick={() => setTab('hist')}><Icon name="list" size={17} /> Jogadas</button>
        <button className={tab === 'chat' ? 'on' : ''} onClick={() => setTab('chat')}><Icon name="chat" size={17} /> Chat</button>
        {onClose && <button className="tab-close" onClick={onClose}><Icon name="close" size={17} /></button>}
      </div>
      {tab === 'hist' ? <History game={game} /> : <Chat game={game} me={me} msgs={msgs} onSend={onSend} />}
    </aside>
  );
}
