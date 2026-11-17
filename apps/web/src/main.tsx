import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Client, type Room } from '@colyseus/sdk';
import { Lobby, type LobbyResult, type OnlineRequest } from './components/Lobby';
import { Table } from './components/Table';
import { WaitingRoom } from './components/WaitingRoom';
import { onlineCtrl, useLocalCtrl, useRoom } from './controller';
import './styles.css';

const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string | undefined) || 'ws://localhost:2567';

function LocalGame({ m, onExit }: { m: LobbyResult; onExit: () => void }) {
  const ctrl = useLocalCtrl(m.config, m.level, m.name);
  return <Table ctrl={ctrl} onExit={onExit} />;
}

function OnlineGame({ room, onExit }: { room: Room; onExit: () => void }) {
  const { snap, recvAt, msgs, dropped } = useRoom(room);
  if (dropped) {
    return (
      <div className="center-msg">
        <h2>Conexão perdida</h2>
        <p>Você saiu da sala ou o servidor caiu.</p>
        <button className="btn-play" onClick={onExit}>Voltar ao menu</button>
      </div>
    );
  }
  if (!snap) return <div className="center-msg"><div className="spinner" /><p>Entrando na sala…</p></div>;
  if (snap.phase === 'waiting' || !snap.game) return <WaitingRoom room={room} snap={snap} recvAt={recvAt} onExit={onExit} />;
  return <Table ctrl={onlineCtrl(room, snap, recvAt, msgs)} onExit={onExit} roomCode={snap.kind === 'private' ? snap.code : undefined} />;
}

type Screen =
  | { kind: 'lobby'; error?: string }
  | { kind: 'local'; m: LobbyResult; key: number }
  | { kind: 'connecting' }
  | { kind: 'online'; room: Room };

function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'lobby' });
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (screen.kind !== 'connecting') { setSlow(false); return; }
    const t = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(t);
  }, [screen.kind]);

  const connect = async (req: OnlineRequest) => {
    setScreen({ kind: 'connecting' });
    try {
      const client = new Client(SERVER_URL);
      const room = req.type === 'public'
        ? await client.joinOrCreate('publica', { mode: req.mode, name: req.name })
        : req.type === 'create'
          ? await client.create('privada', { config: req.config, level: req.level, name: req.name })
          : await client.joinById(req.code.toUpperCase().trim(), { name: req.name });
      if (req.type === 'join') history.replaceState(null, '', location.pathname);
      setScreen({ kind: 'online', room });
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      setScreen({
        kind: 'lobby',
        error: req.type === 'join' && /not found|locked|full|cheia/i.test(msg)
          ? 'Sala não encontrada, cheia ou já começou. Confira o código.'
          : 'Não deu para conectar ao servidor. Tente de novo em instantes.',
      });
    }
  };

  const exit = () => {
    if (screen.kind === 'online') void screen.room.leave();
    setScreen({ kind: 'lobby' });
  };

  if (screen.kind === 'local') return <LocalGame key={screen.key} m={screen.m} onExit={exit} />;
  if (screen.kind === 'online') return <OnlineGame room={screen.room} onExit={exit} />;
  if (screen.kind === 'connecting') {
    return (
      <div className="center-msg">
        <div className="spinner" />
        <p>Conectando ao servidor…</p>
        {slow && <small>O servidor gratuito dorme quando ninguém está jogando. Pode levar até 1 minuto para acordar.</small>}
      </div>
    );
  }
  return (
    <Lobby error={screen.error}
      onPlay={(m) => setScreen({ kind: 'local', m, key: Date.now() })}
      onOnline={connect} />
  );
}

createRoot(document.getElementById('root')!).render(<App />);
