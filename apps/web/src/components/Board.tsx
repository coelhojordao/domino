import { useLayoutEffect, useRef, useState } from 'react';
import type { PlacedTile, Side, Tile as T } from '@domino/engine';
import { Tile } from './Tile';

/** Peça posicionada em unidades (1 unidade = meia peça). */
interface Placed {
  key: string;
  x: number; y: number;
  vertical: boolean;
  a: number; b: number; // a = esquerda/cima, b = direita/baixo
  extra?: Side; // peça fantasma (alvo de jogada) em uma das pontas
}

/**
 * "Cobrinha" igual na mesa de verdade: a primeira peça fica no centro, cada ponta cresce
 * para um lado e, ao chegar na borda, dobra (peça em pé) e volta no sentido contrário.
 */
function layout(seq: PlacedTile[], origin: number, maxX: number, extras: Map<PlacedTile, Side>): Placed[] {
  if (!seq.length) return [];
  const out: Placed[] = [];
  const key = (p: PlacedTile) => extras.has(p) ? `ghost-${extras.get(p)}` : `${p.tile[0]}-${p.tile[1]}`;
  const c = seq[origin];
  const cDouble = c.left === c.right;
  if (cDouble) out.push({ key: key(c), x: -0.5, y: -1, vertical: true, a: c.left, b: c.right, extra: extras.get(c) });
  else out.push({ key: key(c), x: -1, y: -0.5, vertical: false, a: c.left, b: c.right, extra: extras.get(c) });
  const half = cDouble ? 0.5 : 1;

  const arms = [
    { tiles: seq.slice(origin + 1).map((p) => ({ p, inner: p.left, outer: p.right })), dir: 1, turn: 1 },
    { tiles: seq.slice(0, origin).reverse().map((p) => ({ p, inner: p.right, outer: p.left })), dir: -1, turn: -1 },
  ];

  for (const arm of arms) {
    let dir = arm.dir;
    const s = arm.turn;
    let cx = half * dir;
    let cy = 0;
    let afterCorner = false;
    for (const { p, inner, outer } of arm.tiles) {
      const extra = extras.get(p);
      const dbl = inner === outer;
      const len = dbl && !afterCorner ? 1 : 2;
      const fitsRow = dir > 0 ? cx + len <= maxX + 0.01 : cx - len >= -maxX - 0.01;
      if (!fitsRow && !afterCorner) {
        const x = dir > 0 ? cx : cx - 1;
        const y = s > 0 ? cy - 0.5 : cy - 1.5;
        out.push({ key: key(p), x, y, vertical: true, a: s > 0 ? inner : outer, b: s > 0 ? outer : inner, extra });
        cx += dir; cy += 2 * s; dir = -dir; afterCorner = true;
        continue;
      }
      if (dbl && !afterCorner) {
        out.push({ key: key(p), x: dir > 0 ? cx : cx - 1, y: cy - 1, vertical: true, a: inner, b: outer, extra });
        cx += dir;
      } else {
        out.push({ key: key(p), x: dir > 0 ? cx : cx - 2, y: cy - 0.5, vertical: false,
          a: dir > 0 ? inner : outer, b: dir > 0 ? outer : inner, extra });
        cx += 2 * dir;
      }
      afterCorner = false;
    }
  }
  return out;
}

function withExtras(board: PlacedTile[], origin: number, left?: PlacedTile, right?: PlacedTile) {
  const extras = new Map<PlacedTile, Side>();
  const seq = [...board];
  let o = origin;
  if (left) { seq.unshift(left); extras.set(left, 'left'); o += 1; }
  if (right) { seq.push(right); extras.set(right, 'right'); }
  return { seq, origin: o, extras };
}

/** Como a peça ficaria encaixada em cada ponta (mesma regra do motor). */
function ghostFor(board: PlacedTile[], tile: T, side: Side): PlacedTile {
  if (side === 'left') {
    const v = board[0].left;
    return { tile, left: tile[0] === v ? tile[1] : tile[0], right: v };
  }
  const v = board[board.length - 1].right;
  return { tile, left: v, right: tile[0] === v ? tile[1] : tile[0] };
}

const GAP = 1.05;
const DUMMY: PlacedTile = { tile: [7, 8] as unknown as T, left: 7, right: 8 };
const DUMMY2: PlacedTile = { tile: [8, 7] as unknown as T, left: 8, right: 7 };

export type SeatPos = 'bottom' | 'top' | 'left' | 'right';

export function Board({ board, origin, lastKey, lastFrom, picked, targets, onTarget, maxUnit = 60 }: {
  board: PlacedTile[];
  origin: number;
  lastKey?: string;
  lastFrom?: SeatPos;
  picked?: T | null;
  targets?: Side[];
  onTarget?: (side: Side) => void;
  maxUnit?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 800, h: 400 });

  useLayoutEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Escolhe largura de fileira e orientação reservando 1 espaço em cada ponta,
  // assim a mesa não "pula" quando aparecem os alvos de jogada.
  const reserve = board.length ? withExtras(board, origin, DUMMY, DUMMY2) : null;
  let best = { u: 0, maxX: 8, transposed: false, minX: 0, minY: 0, w: 0, h: 0 };
  if (reserve) {
    for (const transposed of box.h > box.w ? [false, true] : [false]) for (let maxX = 3; maxX <= 18; maxX += 0.5) {
      let tiles = layout(reserve.seq, reserve.origin, maxX, reserve.extras);
      if (transposed) tiles = tiles.map((t) => ({ ...t, x: t.y, y: t.x, vertical: !t.vertical }));
      let minX = Infinity, minY = Infinity, maxRX = -Infinity, maxRY = -Infinity;
      for (const t of tiles) {
        minX = Math.min(minX, t.x); minY = Math.min(minY, t.y);
        maxRX = Math.max(maxRX, t.x + (t.vertical ? 1 : 2)); maxRY = Math.max(maxRY, t.y + (t.vertical ? 2 : 1));
      }
      const w = (maxRX - minX) * GAP, h = (maxRY - minY) * GAP;
      const u = Math.min(maxUnit, (box.w - 16) / w, (box.h - 16) / h);
      if (u > best.u * 1.08 || (!transposed && u > best.u + 0.01)) best = { u, maxX, transposed, minX, minY, w, h };
    }
  }

  const sides = picked && board.length ? (targets ?? []) : [];
  const real = withExtras(board, origin,
    sides.includes('left') ? ghostFor(board, picked!, 'left') : undefined,
    sides.includes('right') ? ghostFor(board, picked!, 'right') : undefined);
  let tiles = layout(real.seq, real.origin, best.maxX, real.extras);
  if (best.transposed) tiles = tiles.map((t) => ({ ...t, x: t.y, y: t.x, vertical: !t.vertical }));

  const u = Math.max(10, Math.floor(best.u));
  const offX = (box.w - best.w * u) / 2;
  const offY = (box.h - best.h * u) / 2;
  const pos = (t: Placed) => ({ left: offX + (t.x - best.minX) * GAP * u, top: offY + (t.y - best.minY) * GAP * u });
  const FROM: Record<SeatPos, [number, number]> = { bottom: [0, 1], top: [0, -1], left: [-1, 0], right: [1, 0] };
  const from = FROM[lastFrom ?? 'bottom'];

  return (
    <div className="board" ref={ref}>
      {board.length === 0 && <div className="board-empty">Aguardando a primeira peça…</div>}
      {tiles.map((t) => t.extra ? (
        <button key={t.key} className="ghost-target" style={pos(t)} onClick={() => onTarget?.(t.extra!)}
          aria-label={`Jogar na ponta ${t.extra === 'left' ? 'esquerda' : 'direita'}`}>
          <Tile a={t.a} b={t.b} size={u} vertical={t.vertical} />
        </button>
      ) : (
        <div key={t.key} className={`board-tile ${t.key === lastKey ? 'fly' : ''}`}
          style={{ ...pos(t), ['--fx' as string]: `${from[0] * 420}px`, ['--fy' as string]: `${from[1] * 320}px` }}>
          <Tile a={t.a} b={t.b} size={u} vertical={t.vertical} className={t.key === lastKey ? 'just-played' : ''} />
        </div>
      ))}
    </div>
  );
}
