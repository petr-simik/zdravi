import { useState } from 'react';
import { put, useTable } from '../lib/store';
import { Metric, Phase, addDays, currentPhase, cz, num, stepTarget, today } from '../lib/model';
import { Chart, Icon, Num, Sheet } from '../ui';
import { setMetric } from './Today';

const TYPES: { id: string; name: string; unit: string; group: string; digits?: number; hint?: string }[] = [
  { id: 'weight', name: 'Váha', unit: 'kg', group: 'Tělo', hint: 'Ráno, týdenní průměr' },
  { id: 'waist', name: 'Obvod pasu', unit: 'cm', group: 'Tělo' },
  { id: 'steps', name: 'Kroky', unit: 'kroků', group: 'Tělo', digits: 0 },
  { id: 'sleep_h', name: 'Délka spánku', unit: 'h', group: 'Spánek' },
  { id: 'wakeups', name: 'Probuzení', unit: '×', group: 'Spánek', digits: 0 },
  { id: 'rhr', name: 'Klidový tep', unit: 'tepů', group: 'Spánek', digits: 0 },
  { id: 'side_plank', name: 'Boční plank', unit: 's', group: 'Testy jednou za 4 týdny', digits: 0 },
  { id: 'hang', name: 'Vis na hrazdě', unit: 's', group: 'Testy jednou za 4 týdny', digits: 0 },
];

export default function Metrics() {
  const metrics = useTable<Metric>('metrics');
  const phases = useTable<Phase>('phases');
  const [open, setOpen] = useState<string | null>(null);
  const [date, setDate] = useState(today());
  const [val, setVal] = useState<number | null>(null);

  const of = (type: string) => metrics.filter((m) => m.type === type).sort((a, b) => a.date.localeCompare(b.date));
  const weekAvg = (list: Metric[]) => {
    const from = addDays(today(), -6);
    const w = list.filter((m) => m.date >= from);
    return w.length ? w.reduce((s, m) => s + m.value, 0) / w.length : null;
  };
  const groups = [...new Set(TYPES.map((t) => t.group))];
  const cur = TYPES.find((t) => t.id === open);
  const curList = open ? of(open) : [];
  const target = open === 'steps' ? stepTarget(currentPhase(phases)) : undefined;

  return (
    <>
      <header className="top">
        <h1 className="plain">Metriky</h1>
      </header>
      {groups.map((g) => (
        <section className="sec" key={g} style={g === groups[0] ? { marginTop: 0 } : undefined}>
          <h2>{g}</h2>
          <div className="grid2">
            {TYPES.filter((t) => t.group === g).map((t) => {
              const list = of(t.id);
              const last = list[list.length - 1];
              const avg = t.id === 'weight' ? weekAvg(list) : null;
              const shown = avg ?? last?.value;
              return (
                <button
                  className="card tile"
                  key={t.id}
                  onClick={() => { setOpen(t.id); setDate(today()); setVal(null); }}
                >
                  <span className="muted small" style={{ fontWeight: 500 }}>{t.name}</span>
                  <div className="big">
                    {shown != null ? num(shown, t.digits ?? 1) : '-'}
                    <small>{t.unit}</small>
                  </div>
                  <span className="muted small">
                    {last ? (avg != null ? 'průměr 7 dní' : cz(last.date)) : 'Zapsat první hodnotu'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <p className="muted small" style={{ marginTop: 18 }}>
        Fotky postavy a import z hodinek přibudou v další fázi.
      </p>

      {cur && (
        <Sheet title={cur.name} onClose={() => setOpen(null)}>
          {cur.hint && <p className="muted">{cur.hint}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label className="field">
              <span>Datum</span>
              <input className="inp" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="field">
              <span>Hodnota ({cur.unit})</span>
              <Num value={val} label={cur.name} onChange={setVal} />
            </label>
          </div>
          <button
            className="btn pri wide"
            style={{ marginTop: 12 }}
            disabled={val == null || !date}
            onClick={() => { setMetric(metrics, cur.id, date, val); setVal(null); }}
          >
            Zapsat
          </button>
          <div className="card" style={{ marginTop: 14 }}>
            <Chart points={curList.slice(-60).map((m) => ({ x: m.date, y: m.value }))} unit={cur.unit} target={target} />
          </div>
          {curList.length > 0 && (
            <div className="list" style={{ marginTop: 10 }}>
              {[...curList].reverse().slice(0, 14).map((m) => (
                <div className="row" key={m.id}>
                  <span className="grow t">{cz(m.date)}</span>
                  <b>{num(m.value, cur.digits ?? 1)} {cur.unit}</b>
                  <button className="round" aria-label={`Smazat zápis z ${cz(m.date)}`} onClick={() => put('metrics', { ...m, deleted: true })}>
                    <Icon n="x" size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="btns">
            <button className="btn" onClick={() => setOpen(null)}>Zavřít</button>
          </div>
        </Sheet>
      )}
    </>
  );
}
