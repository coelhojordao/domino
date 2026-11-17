import { useState } from 'react';
import { DEFAULT_CONFIG, type BotLevel, type GameConfig, type Mode, type Scoring } from '@domino/engine';
import { Tile } from './Tile';
import { AdSlot } from './AdSlot';

export interface LobbyResult { config: GameConfig; level: BotLevel; name: string }
export type OnlineRequest =
  | { type: 'public'; mode: Mode; name: string }
  | { type: 'create'; config: GameConfig; level: BotLevel; name: string }
  | { type: 'join'; code: string; name: string };

function Seg<T extends string | number>({ value, options, onChange }: {
  value: T; options: { v: T; label: string; hint?: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={String(o.v)} className={o.v === value ? 'on' : ''} onClick={() => onChange(o.v)} title={o.hint}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Lobby({ onPlay, onOnline, error }: {
  onPlay: (r: LobbyResult) => void; onOnline: (r: OnlineRequest) => void; error?: string;
}) {
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('sala') ?? '');
  const saved = JSON.parse(localStorage.getItem('lobby') || 'null') as LobbyResult | null;
  const [config, setConfig] = useState<GameConfig>(saved?.config ?? DEFAULT_CONFIG);
  const [level, setLevel] = useState<BotLevel>(saved?.level ?? 'medio');
  const [name, setName] = useState(saved?.name ?? '');
  const set = (p: Partial<GameConfig>) => setConfig((c) => ({ ...c, ...p }));

  const save = () => {
    const r = { config, level, name: name.trim() || 'Você' };
    localStorage.setItem('lobby', JSON.stringify(r));
    return r;
  };
  const start = () => onPlay(save());
  const nick = () => save().name;

  return (
    <div className="lobby">
      <header className="hero">
        <div className="logo-tiles">
          <Tile a={6} b={6} size={30} vertical />
          <Tile a={6} b={3} size={30} />
          <Tile a={3} b={1} size={30} vertical />
        </div>
        <h1>Dominó<span>.online</span></h1>
        <p>Jogue grátis com amigos, contra gente de todo o Brasil ou contra bots.</p>
      </header>

      {error && <div className="error-box">{error}</div>}
      {code && <div className="invite-box">Você foi convidado para a sala <b>{code}</b>. Escolha seu apelido e clique em <b>Entrar</b>.</div>}
      <AdSlot kind="banner" />

      <section className="card">
        <label className="field">
          <span>Seu apelido</span>
          <input value={name} maxLength={16} placeholder="Ex.: Rei da Carroça" onChange={(e) => setName(e.target.value)} />
        </label>

        <div className="field">
          <span>Modalidade</span>
          <Seg<Mode> value={config.mode} onChange={(mode) => set({ mode })} options={[
            { v: '2x2', label: 'Duplas 2x2' },
            { v: '1x1', label: '1x1' },
            { v: '4-individual', label: '4 individual' },
          ]} />
        </div>

        <div className="field">
          <span>Pontuação</span>
          <Seg<Scoring> value={config.scoring} onChange={(scoring) => set({ scoring })} options={[
            { v: 'batidas', label: 'Por batida', hint: 'Simples 1 · Carroça 2 · Lá-e-lô 3 · Cruzada 4' },
            { v: 'pontos', label: 'Soma das peças', hint: 'Quem bate leva a soma das peças dos adversários' },
          ]} />
          <small>{config.scoring === 'batidas'
            ? 'Simples 1 · Carroça 2 · Lá-e-lô 3 · Cruzada 4 · Trancado 1'
            : 'Quem bate soma os pontos das peças que sobraram com os adversários'}</small>
        </div>

        {config.mode === '1x1' && (
          <div className="field">
            <span>Monte</span>
            <Seg<string> value={config.draw ? 'sim' : 'nao'} onChange={(v) => set({ draw: v === 'sim' })} options={[
              { v: 'nao', label: 'Sem compra (passa)' },
              { v: 'sim', label: 'Compra do monte' },
            ]} />
          </div>
        )}

        <div className="row2">
          <div className="field">
            <span>Rodadas</span>
            <div className="stepper">
              <button onClick={() => set({ rounds: Math.max(1, config.rounds - 1) })}>−</button>
              <b>{config.rounds}</b>
              <button onClick={() => set({ rounds: Math.min(50, config.rounds + 1) })}>+</button>
            </div>
          </div>
          <div className="field">
            <span>Tempo por jogada</span>
            <Seg<number> value={config.turnSeconds} onChange={(turnSeconds) => set({ turnSeconds })} options={[
              { v: 10, label: '10s' }, { v: 20, label: '20s' }, { v: 30, label: '30s' }, { v: 0, label: '∞' },
            ]} />
          </div>
        </div>
      </section>

      <section className="modes">
        <div className="mode-card primary">
          <h3>🤖 Contra bots</h3>
          <Seg<BotLevel> value={level} onChange={setLevel} options={[
            { v: 'facil', label: 'Fácil' }, { v: 'medio', label: 'Médio' }, { v: 'dificil', label: 'Difícil' },
          ]} />
          <button className="btn-play" onClick={start}>Jogar agora</button>
        </div>
        <div className="mode-card">
          <h3>🌎 Sala pública</h3>
          <p>Joga com gente de todo lugar na modalidade escolhida. Se faltar gente em 15s, bots completam a mesa.</p>
          <button className="btn-play alt" onClick={() => onOnline({ type: 'public', mode: config.mode, name: nick() })}>Procurar mesa</button>
        </div>
        <div className="mode-card">
          <h3>🔒 Sala privada</h3>
          <p>Cria uma sala com as regras acima e manda o link para os amigos.</p>
          <button className="btn-play alt" onClick={() => onOnline({ type: 'create', config, level, name: nick() })}>Criar sala</button>
          <form className="join-code" onSubmit={(e) => { e.preventDefault(); if (code.trim()) onOnline({ type: 'join', code, name: nick() }); }}>
            <input value={code} maxLength={8} placeholder="Código" onChange={(e) => setCode(e.target.value.toUpperCase())} />
            <button type="submit">Entrar</button>
          </form>
        </div>
      </section>

      <footer className="foot">
        <a href="#">Regras</a> · <a href="#">Privacidade</a> · <a href="#">Termos</a>
      </footer>
    </div>
  );
}
