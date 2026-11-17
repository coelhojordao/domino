const PIPS: Record<number, [number, number][]> = {
  0: [],
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
};

function Half({ v, x, y, s }: { v: number; x: number; y: number; s: number }) {
  const step = s * 0.28;
  const cx = x + s / 2, cy = y + s / 2;
  return (
    <>
      {PIPS[v].map(([c, r], i) => (
        <circle key={i} cx={cx + (c - 1) * step} cy={cy + (r - 1) * step} r={s * 0.085} className="pip" />
      ))}
    </>
  );
}

interface Props {
  a: number;
  b: number;
  size: number; // lado do quadrado (meia peça)
  vertical?: boolean;
  faceDown?: boolean;
  className?: string;
  onClick?: () => void;
}

/** Peça de dominó em SVG. Horizontal: a à esquerda, b à direita. Vertical: a em cima. */
export function Tile({ a, b, size, vertical, faceDown, className = '', onClick }: Props) {
  const w = vertical ? size : size * 2;
  const h = vertical ? size * 2 : size;
  const r = size * 0.14;
  return (
    <svg
      width={w} height={h} viewBox={`0 0 ${w} ${h}`}
      className={`tile ${faceDown ? 'face-down' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={faceDown ? 'peça virada' : `peça ${a} e ${b}`}
    >
      <rect x={0.75} y={0.75} width={w - 1.5} height={h - 1.5} rx={r} className="tile-body" />
      {!faceDown && (
        <>
          {vertical
            ? <line x1={size * 0.18} x2={size * 0.82} y1={size} y2={size} className="tile-line" />
            : <line y1={size * 0.18} y2={size * 0.82} x1={size} x2={size} className="tile-line" />}
          <circle cx={w / 2} cy={h / 2} r={size * 0.05} className="tile-pin" />
          <Half v={a} x={0} y={0} s={size} />
          <Half v={b} x={vertical ? 0 : size} y={vertical ? size : 0} s={size} />
        </>
      )}
    </svg>
  );
}
