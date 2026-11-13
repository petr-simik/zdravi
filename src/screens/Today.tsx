import { put, uid, useTable, get, ids, Row } from '../lib/store';
import {
  Day, Habit, Metric, Phase, Session, Workout,
  DNY, DNY_KR, addDays, cz, currentPhase, dayOf, diffDays, num, saveDay, startSession, stepTarget, today, weekday,
} from '../lib/model';
import { Bar, Check, Icon, Num, go } from '../ui';

export function setMetric(metrics: Metric[], type: string, date: string, value: number | null) {
  const old = metrics.find((m) => m.type === type && m.date === date);
  if (value == null) {
    if (old) put('metrics', { ...old, deleted: true });
  } else put('metrics', { ...(old ?? { id: uid(), type, date }), value });
}

export default function Today() {
  const date = today();
  const days = useTable<Day>('days');
  const habits = [...useTable<Habit>('habits')].sort((a, b) => a.order - b.order);
  const workouts = useTable<Workout>('workouts');
  const sessions = useTable<Session>('sessions');
  const metrics = useTable<Metric>('metrics');
  const phases = useTable<Phase>('phases');
  const supplements = [...useTable<Row>('supplements')].sort((a, b) => a.order - b.order);
  const profile = get('profiles', ids().user_id);

  const day = dayOf(days, date);
  const wd = weekday(date);
  const monday = addDays(date, 1 - wd);
  const phase = currentPhase(phases, date);
  const workout = workouts.find((w) => w.weekday === wd);
  const doneToday = sessions.find((s) => s.date === date && s.finished_at);
  const openToday = sessions.find((s) => s.date === date && !s.finished_at);

  const steps = metrics.find((m) => m.type === 'steps' && m.date === date)?.value ?? null;
  const target = stepTarget(phase, date);

  const setHabit = (id: string, v: number | boolean) => saveDay(day, { habits: { ...day.habits, [id]: v } });
  const ev = day.evening ?? {};
  const setEv = (patch: object) => saveDay(day, { evening: { ...ev, ...patch } });

  let phaseLine = '';
  if (phase) {
    if (date < phase.start) phaseLine = `${phase.name} začíná za ${diffDays(date, phase.start)} dní`;
    else phaseLine = `${phase.name}, den ${diffDays(phase.start, date) + 1} z ${diffDays(phase.start, phase.end) + 1}`;
  }

  const scales: [keyof typeof ev, string, number][] = [
    ['mucus', 'Zahlenění', 0],
    ['back', 'Bolest beder', 0],
    ['neck', 'Bolest krku', 0],
    ['fresh', 'Ranní svěžest', 1],
  ];

  return (
    <>
      <header className="top">
        <div>
          <h1>{DNY[wd - 1]}</h1>
          <p className="sub">
            {cz(date)}
            {phaseLine && ', ' + phaseLine}
          </p>
        </div>
      </header>

      <div className="week" aria-label="Tento týden">
        {DNY_KR.map((d, i) => {
          const dd = addDays(monday, i);
          const w = workouts.find((x) => x.weekday === i + 1);
          const ok = sessions.some((s) => s.date === dd && s.finished_at);
          return (
            <div key={d} className={(dd === date ? 'now ' : '') + (ok ? 'ok ' : '') + (w ? '' : 'rest')}>
              <b>{ok ? <Icon n="check" size={22} /> : w ? w.code : '·'}</b>
              {d}
            </div>
          );
        })}
      </div>

      <section className="sec" style={{ marginTop: 14 }}>
        {doneToday ? (
          <div className="hero rest">
            <span className="tag go">Hotovo</span>
            <h3 style={{ marginTop: 8 }}>Trénink {doneToday.code} máš za sebou</h3>
            <p className="muted small">Zápis najdeš v historii tréninků.</p>
          </div>
        ) : workout || openToday ? (
          <div className="hero">
            <span className="letter">{(openToday ?? workout)!.code}</span>
            <h3>{workout?.name ?? 'Rozdělaný trénink'}</h3>
            <p>
              {workout ? `${workout.items.length} cviků` : ''}
              {workout?.optional ? ', volitelný' : ''}
            </p>
            <button
              className="btn pri wide"
              onClick={() => go('#/trenink/s/' + (openToday ?? startSession(workout!)).id)}
            >
              {openToday ? 'Pokračovat v tréninku' : 'Začít trénink'}
            </button>
          </div>
        ) : (
          <div className="hero rest">
            <h3>Dnes volno</h3>
            <p className="muted small">Stačí kroky, voda a mikro-pauzy.</p>
          </div>
        )}
      </section>

      <section className="sec">
        <h2>Kroky {target && <small>cíl {num(target)}</small>}</h2>
        <div className="card">
          <div className="split">
            <div className="big">
              {steps != null ? num(steps, 0) : '0'}
              <small>kroků</small>
            </div>
            <div style={{ width: 130 }}>
              <Num value={steps} label="Dnešní kroky" placeholder="zapsat" onChange={(v) => setMetric(metrics, 'steps', date, v)} />
            </div>
          </div>
          {target && <Bar value={steps ?? 0} max={target} />}
        </div>
      </section>

      <section className="sec">
        <h2>Návyky</h2>
        <div className="list">
          {habits.map((h) => {
            if (h.kind === 'count') {
              const v = (day.habits[h.id] as number) || 0;
              return (
                <div className={'row' + (v >= (h.target ?? 1) ? ' is-done' : '')} key={h.id}>
                  <span className="box"><Icon n="check" size={18} /></span>
                  <span className="grow">
                    <span className="t" style={{ textDecoration: 'none' }}>{h.name}</span>
                    <span className="d" style={{ display: 'block' }}>{h.unit}</span>
                  </span>
                  <span className="counter">
                    <button className="round" aria-label={h.name + ': ubrat'} onClick={() => setHabit(h.id, Math.max(0, v - 1))}>
                      <Icon n="minus" size={20} />
                    </button>
                    <output aria-live="polite">
                      {v}
                      <small>/{h.target}</small>
                    </output>
                    <button className="round" aria-label={h.name + ': přidat'} onClick={() => setHabit(h.id, v + 1)}>
                      <Icon n="plus" size={20} />
                    </button>
                  </span>
                </div>
              );
            }
            return <Check key={h.id} title={h.name} done={!!day.habits[h.id]} onToggle={() => setHabit(h.id, !day.habits[h.id])} />;
          })}
        </div>
      </section>

      {supplements.length > 0 && (
        <section className="sec">
          <h2>Suplementy</h2>
          <div className="list">
            {supplements.map((s) =>
              s.status === 'paused' ? (
                <Check key={s.id} off done={false} title={s.name} desc={s.note || 'Pozastaveno'} />
              ) : (
                <Check
                  key={s.id}
                  title={s.name}
                  desc={[s.dose, s.time].filter(Boolean).join(', ')}
                  done={!!day.supplements[s.id]}
                  onToggle={() => saveDay(day, { supplements: { ...day.supplements, [s.id]: !day.supplements[s.id] } })}
                />
              ),
            )}
          </div>
        </section>
      )}

      <section className="sec">
        <h2>Večerní zápis</h2>
        <div className="card">
          {scales.map(([k, label, min], i) => (
            <label className="field" key={k} style={i ? undefined : { marginTop: 0 }}>
              <span>
                {label} <b>{ev[k] != null ? String(ev[k]) : '-'}</b>
              </span>
              <input
                type="range"
                min={min}
                max={10}
                step={1}
                value={(ev[k] as number) ?? min}
                onChange={(e) => setEv({ [k]: +e.target.value })}
              />
            </label>
          ))}
          <div className="field">
            <span>Co předcházelo</span>
            <div className="chips">
              {(profile?.evening_tags ?? ['káva', 'těžké jídlo', 'pozdní večeře', 'jiné']).map((t: string) => {
                const on = ev.tags?.includes(t) ?? false;
                return (
                  <button
                    key={t}
                    className="chip"
                    aria-pressed={on}
                    onClick={() => setEv({ tags: on ? ev.tags!.filter((x) => x !== t) : [...(ev.tags ?? []), t] })}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="field">
            <span>Poznámka</span>
            <textarea className="inp" value={ev.note ?? ''} onChange={(e) => setEv({ note: e.target.value })} />
          </label>
        </div>
      </section>
    </>
  );
}
