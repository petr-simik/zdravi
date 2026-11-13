import { ReactNode, useEffect, useState } from 'react';
import { num, toNum } from './lib/model';

const PATHS: Record<string, string> = {
  dnes: 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  trenink: 'M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11',
  metriky: 'M4 19V5M4 19h16M8 15l3.5-4 3 2.5L19 8',
  zdravi: 'M12 20s-7-4.4-7-9.6A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.4C19 15.6 12 20 12 20z',
  vice: 'M5 12h.01M12 12h.01M19 12h.01',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  back: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  x: 'M6 6l12 12M18 6L6 18',
  pause: 'M9 5v14M15 5v14',
};

export function Icon({ n, size = 24 }: { n: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={n === 'vice' ? 3 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[n]} />
    </svg>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

// Číselné pole s českou desetinnou čárkou.
export function Num({
  value,
  onChange,
  label,
  placeholder,
  className = 'inp numeric',
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  label: string;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState(num(value, 2));
  useEffect(() => {
    if (toNum(text) !== (value ?? null)) setText(num(value, 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      className={className}
      inputMode="decimal"
      aria-label={label}
      placeholder={placeholder}
      value={text}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        setText(e.target.value);
        onChange(toNum(e.target.value));
      }}
    />
  );
}

export function Check({
  done,
  title,
  desc,
  onToggle,
  off,
}: {
  done: boolean;
  title: string;
  desc?: string;
  onToggle?: () => void;
  off?: boolean;
}) {
  return (
    <button
      className={'row' + (done ? ' is-done' : '') + (off ? ' off' : '')}
      role="checkbox"
      aria-checked={done}
      disabled={!onToggle}
      onClick={onToggle}
    >
      <span className="box">{off ? <Icon n="pause" size={16} /> : <Icon n="check" size={18} />}</span>
      <span className="grow">
        <span className="t">{title}</span>
        {desc && <span className="d" style={{ display: 'block' }}>{desc}</span>}
      </span>
    </button>
  );
}

export function Bar({ value, max }: { value: number; max: number }) {
  const p = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className={'bar' + (p >= 1 ? ' full' : '')} role="progressbar" aria-valuenow={Math.round(p * 100)} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: p * 100 + '%' }} />
    </div>
  );
}

export function Chart({
  points,
  target,
  unit = '',
}: {
  points: { x: string; y: number }[];
  target?: number;
  unit?: string;
}) {
  if (points.length < 2) return <p className="muted small" style={{ marginTop: 10 }}>Graf se ukáže po druhém zápisu.</p>;
  const W = 320, H = 120, L = 4, R = 44, T = 10, B = 18;
  const ys = points.map((p) => p.y).concat(target != null ? [target] : []);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.12;
  lo -= pad; hi += pad;
  const X = (i: number) => L + (i / (points.length - 1)) * (W - L - R);
  const Y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const day = (s: string) => `${+s.slice(8)}. ${+s.slice(5, 7)}.`;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Vývoj, poslední hodnota ${num(last.y)} ${unit}`}>
      {target != null && (
        <>
          <line x1={L} x2={W - R} y1={Y(target)} y2={Y(target)} stroke="var(--done)" strokeWidth="1.5" strokeDasharray="4 4" />
          <text x={W - R + 6} y={Y(target) + 4} style={{ fill: 'var(--done)' }}>cíl {num(target)}</text>
        </>
      )}
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={X(i)} cy={Y(p.y)} r={i === points.length - 1 ? 4.5 : 2.5} fill="var(--accent)">
          <title>{`${day(p.x)}: ${num(p.y)} ${unit}`}</title>
        </circle>
      ))}
      <text x={Math.min(X(points.length - 1) + 8, W - R + 6)} y={Y(last.y) - 8} style={{ fill: 'var(--ink)', fontWeight: 600 }}>{num(last.y)}</text>
      <text x={L} y={H - 2}>{day(points[0].x)}</text>
      <text x={W - R} y={H - 2} textAnchor="end">{day(last.x)}</text>
    </svg>
  );
}

export const go = (path: string) => (location.hash = path);
