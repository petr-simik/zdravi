import { useEffect, useState } from 'react';
import { get, ids, put, remove, uid, useTable } from '../lib/store';
import {
  DNY, Entry, Exercise, Phase, PlanItem, Session, SetLog, Workout,
  cz, currentPhase, lastEntry, makeEntry, num, progression, repsLabel, startSession, targetRpe, today,
} from '../lib/model';
import { Chart, Icon, Num, Sheet, go } from '../ui';

const Back = ({ to = '#/trenink', label = 'Trénink' }) => (
  <a className="back" href={to}>
    <Icon n="back" size={20} />
    {label}
  </a>
);

function ExImg({ ex }: { ex?: Exercise }) {
  return ex?.image ? (
    <img className="ex-img" src={ex.image} alt="" loading="lazy" />
  ) : (
    <span className="ex-img" aria-hidden="true">
      <Icon n="trenink" size={26} />
    </span>
  );
}

const setText = (s: SetLog, unit: string) =>
  `${s.weight ? num(s.weight) + ' kg × ' : ''}${s.reps ?? '-'}${unit === 'op' ? '' : ' ' + unit}`;

// ---------- přehled ----------
export function TrainingHome() {
  const workouts = [...useTable<Workout>('workouts')].sort((a, b) => a.weekday - b.weekday);
  const sessions = [...useTable<Session>('sessions')].sort((a, b) => b.date.localeCompare(a.date));
  const profile = get('profiles', ids().user_id);
  const warmup: string[] = profile?.training?.warmup ?? [];

  return (
    <>
      <header className="top">
        <h1 className="plain">Trénink</h1>
      </header>
      {workouts.length === 0 && (
        <div className="card empty">Zatím tu není žádný plán. Nahraj ho v záložce Více nebo si založ první trénink.</div>
      )}
      <div className="list">
        {workouts.map((w) => (
          <a className="row" key={w.id} href={'#/trenink/w/' + w.id}>
            <span className="big" style={{ width: 34, color: 'var(--accent-ink)', fontSize: 40 }}>{w.code}</span>
            <span className="grow">
              <span className="t">{w.name}</span>
              <span className="d" style={{ display: 'block' }}>
                {DNY[w.weekday - 1]}, {w.items.length} cviků{w.optional ? ', volitelný' : ''}
              </span>
            </span>
            <Icon n="next" size={20} />
          </a>
        ))}
      </div>
      <button
        className="btn ghost wide"
        style={{ marginTop: 10 }}
        onClick={() => {
          const id = uid();
          put('workouts', { id, code: String.fromCharCode(65 + workouts.length), name: 'Nový trénink', weekday: 5, items: [] });
          go('#/trenink/upravit/' + id);
        }}
      >
        <Icon n="plus" size={20} /> Přidat trénink
      </button>

      {warmup.length > 0 && (
        <section className="sec">
          <h2>Rozcvička <small>10 min před každým tréninkem</small></h2>
          <div className="card small">{warmup.join(', ')}.</div>
        </section>
      )}

      <section className="sec">
        <h2>Historie</h2>
        {sessions.length === 0 ? (
          <div className="card empty">Po prvním tréninku se tu objeví zápis.</div>
        ) : (
          <div className="list">
            {sessions.slice(0, 30).map((s) => (
              <a className="row" key={s.id} href={'#/trenink/s/' + s.id}>
                <span className="grow">
                  <span className="t">Trénink {s.code}, {cz(s.date)}</span>
                  <span className="d" style={{ display: 'block' }}>
                    {s.entries.reduce((n, e) => n + e.sets.filter((x) => x.done).length, 0)} sérií
                    {s.finished_at ? '' : ', nedokončený'}
                  </span>
                </span>
                <Icon n="next" size={20} />
              </a>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

// ---------- detail tréninku ----------
export function WorkoutDetail({ id }: { id: string }) {
  const w = useTable<Workout>('workouts').find((x) => x.id === id);
  const exercises = useTable<Exercise>('exercises');
  const phases = useTable<Phase>('phases');
  if (!w) return <Back />;
  const rpe = targetRpe(currentPhase(phases));
  return (
    <>
      <Back />
      <header className="top">
        <div>
          <h1 className="plain">Trénink {w.code}</h1>
          <p className="sub">{w.name}, {DNY[w.weekday - 1]}, cílové RPE {rpe}</p>
        </div>
      </header>
      <div className="list">
        {w.items.map((it, i) => {
          const ex = exercises.find((e) => e.id === it.exercise_id);
          return (
            <a className="row" key={i} href={'#/trenink/c/' + it.exercise_id}>
              <ExImg ex={ex} />
              <span className="grow">
                <span className="t">{ex?.name ?? it.exercise_id}</span>
                <span className="d" style={{ display: 'block' }}>
                  {repsLabel(it)}{it.start ? ', ' + it.start : ''}
                </span>
              </span>
              <Icon n="next" size={20} />
            </a>
          );
        })}
      </div>
      <div className="btns" style={{ marginTop: 14 }}>
        <button className="btn pri" style={{ flex: 1 }} disabled={!w.items.length} onClick={() => go('#/trenink/s/' + startSession(w).id)}>
          Začít trénink
        </button>
        <a className="btn" href={'#/trenink/upravit/' + w.id} style={{ textDecoration: 'none', color: 'inherit' }}>Upravit plán</a>
      </div>
    </>
  );
}

// ---------- zápis tréninku ----------
export function SessionScreen({ id }: { id: string }) {
  const s = useTable<Session>('sessions').find((x) => x.id === id);
  const exercises = useTable<Exercise>('exercises');
  const phases = useTable<Phase>('phases');
  const profile = get('profiles', ids().user_id);
  const rest: number = profile?.training?.rest_s ?? 90;
  const painOk: number = profile?.training?.pain_ok ?? 3;
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [pain, setPain] = useState<{ i: number; v: number; saved?: boolean } | null>(null);

  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= until) {
        setUntil(0);
        navigator.vibrate?.([200, 100, 200]);
      }
    }, 250);
    return () => clearInterval(t);
  }, [until]);

  if (!s) return <Back />;
  const rpe = targetRpe(currentPhase(phases), s.date);
  const exOf = (eid: string) => exercises.find((e) => e.id === eid);
  const save = (entries: Entry[], extra: object = {}) => put('sessions', { ...s, entries, ...extra });
  const setSet = (ei: number, si: number, patch: Partial<SetLog>) =>
    save(s.entries.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.map((x, j) => (j === si ? { ...x, ...patch } : x)) })));
  const total = s.entries.reduce((n, e) => n + e.sets.length, 0);
  const done = s.entries.reduce((n, e) => n + e.sets.filter((x) => x.done).length, 0);
  const left = Math.max(0, Math.ceil((until - now) / 1000));

  return (
    <>
      <Back />
      <header className="top">
        <div>
          <h1 className="plain">Trénink {s.code}</h1>
          <p className="sub">
            {cz(s.date)}, {done} z {total} sérií, cílové RPE {rpe}
          </p>
        </div>
      </header>

      {s.entries.map((e, ei) => {
        const ex = exOf(e.exercise_id);
        const prev = lastEntry(e.exercise_id, s.id);
        const unit = e.target.unit;
        return (
          <article className="ex" key={ei}>
            <div className="ex-head">
              <ExImg ex={ex} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3>{ex?.name ?? e.exercise_id}</h3>
                <p className="muted small">
                  {repsLabel(e.target)}
                  {e.original_id ? `, náhrada za ${exOf(e.original_id)?.name ?? ''}` : e.target.start && !prev ? ', ' + e.target.start : ''}
                </p>
              </div>
              <a className="round" href={'#/trenink/c/' + e.exercise_id} aria-label={'Technika a historie: ' + (ex?.name ?? '')}>
                <Icon n="metriky" size={20} />
              </a>
            </div>
            {ex?.note && <p className="note">{ex.note}</p>}
            {progression(prev) && (
              <p className="note up">Minule všechny série na horní hranici s RPE do 7. Zkus přidat 2,5 až 5 kg.</p>
            )}
            <div className="sets">
              <div className="set-h">
                <span />
                <span>kg</span>
                <span>{unit === 'op' ? 'opakování' : unit === 's' ? 'sekundy' : 'metry'}</span>
                <span>RPE</span>
                <span />
              </div>
              {e.sets.map((x, si) => (
                <div className={'set' + (x.done ? ' ok' : '')} key={si}>
                  <span>{si + 1}</span>
                  <Num value={x.weight} label={`Série ${si + 1}, váha`} placeholder="-" onChange={(v) => setSet(ei, si, { weight: v })} />
                  <Num value={x.reps} label={`Série ${si + 1}, počet`} placeholder={String(e.target.reps_max)} onChange={(v) => setSet(ei, si, { reps: v })} />
                  <Num value={x.rpe} label={`Série ${si + 1}, RPE`} placeholder={String(rpe)} onChange={(v) => setSet(ei, si, { rpe: v })} />
                  <button
                    className="tick"
                    aria-pressed={x.done}
                    aria-label={`Série ${si + 1} hotová`}
                    onClick={() => {
                      const on = !x.done;
                      // Hotová série: doplň počet a přenes váhu do dalších prázdných sérií.
                      save(s.entries.map((y, i) => i !== ei ? y : {
                        ...y,
                        sets: y.sets.map((z, j) =>
                          j === si ? { ...z, done: on, reps: z.reps ?? (on ? e.target.reps_max : null) }
                          : on && j > si && !z.done && z.weight == null ? { ...z, weight: x.weight } : z),
                      }));
                      if (on && !s.finished_at) { setNow(Date.now()); setUntil(Date.now() + rest * 1000); }
                    }}
                  >
                    <Icon n="check" size={22} />
                  </button>
                </div>
              ))}
            </div>
            <div className="btns" style={{ marginTop: 10 }}>
              <button className="btn sm ghost" onClick={() => setPain({ i: ei, v: e.pain ?? 4 })}>
                Bolí{e.pain != null ? ` (${e.pain}/10)` : ''}
              </button>
              <button
                className="btn sm ghost"
                onClick={() => save(s.entries.map((y, i) => (i !== ei ? y : { ...y, sets: [...y.sets, { ...y.sets[y.sets.length - 1], rpe: null, done: false }] })))}
              >
                <Icon n="plus" size={18} /> Série
              </button>
              {prev && (
                <span className="muted small" style={{ alignSelf: 'center' }}>
                  Minule {prev.sets.filter((x) => x.done).map((x) => setText(x, unit)).join(', ')}
                </span>
              )}
            </div>
          </article>
        );
      })}

      <div className="btns" style={{ marginTop: 16 }}>
        {s.finished_at ? (
          <>
            <span className="tag go" style={{ alignSelf: 'center' }}>Dokončeno</span>
            <button
              className="btn danger ghost"
              style={{ marginLeft: 'auto' }}
              onClick={() => { if (confirm('Smazat tenhle trénink? Nejde to vrátit.')) { remove('sessions', s.id); go('#/trenink'); } }}
            >
              Smazat zápis
            </button>
          </>
        ) : (
          <button
            className="btn pri wide"
            onClick={() => { save(s.entries, { finished_at: new Date().toISOString() }); setUntil(0); go('#/dnes'); }}
          >
            Dokončit trénink
          </button>
        )}
      </div>

      {until > 0 && (
        <div className="timer" role="timer" aria-label="Pauza">
          <div>
            <b>
              {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
              <small>pauza</small>
            </b>
            <button className="btn" onClick={() => setUntil(until + 30000)}>+30 s</button>
            <button className="btn" onClick={() => setUntil(0)}>Přeskočit</button>
          </div>
        </div>
      )}

      {pain && (() => {
        const e = s.entries[pain.i];
        const subs = (exOf(e.original_id ?? e.exercise_id)?.substitutes ?? []).filter((x) => x !== e.exercise_id);
        return (
          <Sheet title="Jak moc to bolí?" onClose={() => setPain(null)}>
            <p className="muted">{exOf(e.exercise_id)?.name}. Do {painOk}/10 je to v pořádku, nad to cvik nahraď.</p>
            <label className="field">
              <span>Bolest <b>{pain.v}/10</b></span>
              <input type="range" min={0} max={10} value={pain.v} onChange={(ev) => setPain({ ...pain, v: +ev.target.value })} />
            </label>
            {pain.v > painOk && (
              <div className="field">
                <span>Náhrada</span>
                {subs.length ? (
                  <div className="list">
                    {subs.map((sid) => (
                      <button
                        className="row"
                        key={sid}
                        onClick={() => {
                          const orig = e.original_id ?? e.exercise_id;
                          save(s.entries.map((y, i) => (i !== pain.i ? y : { ...makeEntry({ ...e.target, start: undefined }, sid, orig), pain: pain.v })));
                          setPain(null);
                        }}
                      >
                        <span className="grow t">{exOf(sid)?.name ?? sid}</span>
                        <Icon n="next" size={20} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="note">Pro tenhle cvik není předem daná náhrada. Uber váhu nebo cvik dnes vynech.</p>
                )}
              </div>
            )}
            <div className="btns">
              <button className="btn" onClick={() => setPain(null)}>Zavřít</button>
              <button
                className="btn pri"
                onClick={() => { save(s.entries.map((y, i) => (i !== pain.i ? y : { ...y, pain: pain.v }))); setPain(null); }}
              >
                Zapsat bolest
              </button>
            </div>
          </Sheet>
        );
      })()}
    </>
  );
}

// ---------- cvik: technika, historie, graf ----------
export function ExerciseScreen({ id }: { id: string }) {
  const exercises = useTable<Exercise>('exercises');
  const sessions = [...useTable<Session>('sessions')].sort((a, b) => a.date.localeCompare(b.date));
  const ex = exercises.find((e) => e.id === id);
  if (!ex) return <Back />;
  const hist = sessions
    .map((s) => ({ s, e: s.entries.find((x) => x.exercise_id === id && x.sets.some((y) => y.done)) }))
    .filter((x): x is { s: Session; e: Entry } => !!x.e);
  const weighted = hist.some((h) => h.e.sets.some((x) => x.done && x.weight));
  const points = hist.map((h) => ({
    x: h.s.date,
    y: Math.max(...h.e.sets.filter((x) => x.done).map((x) => (weighted ? x.weight ?? 0 : x.reps ?? 0))),
  }));
  return (
    <>
      <a className="back" href="#/trenink" onClick={(e) => { e.preventDefault(); history.back(); }}>
        <Icon n="back" size={20} />
        Zpět
      </a>
      <header className="top">
        <h1 className="plain" style={{ fontSize: 34 }}>{ex.name}</h1>
      </header>
      {ex.image && <img src={ex.image} alt={ex.name} style={{ width: '100%', borderRadius: 16, marginBottom: 10 }} />}
      {ex.technique && <div className="card">{ex.technique}</div>}
      {ex.note && (
        <div className="card">
          <p className="muted small" style={{ fontWeight: 600 }}>Moje poznámka</p>
          {ex.note}
        </div>
      )}
      {!!ex.substitutes?.length && (
        <p className="muted small" style={{ marginTop: 10 }}>
          Náhrada při bolesti: {ex.substitutes.map((s) => exercises.find((e) => e.id === s)?.name ?? s).join(' nebo ')}.
        </p>
      )}
      <section className="sec">
        <h2>Vývoj <small>{weighted ? 'nejtěžší série, kg' : 'nejlepší série'}</small></h2>
        <div className="card">
          {hist.length === 0 ? <p className="muted">Zatím žádný zápis.</p> : <Chart points={points} unit={weighted ? 'kg' : ''} />}
        </div>
      </section>
      {hist.length > 0 && (
        <section className="sec">
          <h2>Historie</h2>
          <div className="list">
            {[...hist].reverse().map(({ s, e }) => (
              <a className="row" key={s.id} href={'#/trenink/s/' + s.id}>
                <span className="grow">
                  <span className="t">{cz(s.date)}{e.pain != null ? `, bolest ${e.pain}/10` : ''}</span>
                  <span className="d" style={{ display: 'block' }}>
                    {e.sets.filter((x) => x.done).map((x) => setText(x, e.target.unit) + (x.rpe ? ` (RPE ${num(x.rpe)})` : '')).join(', ')}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

// ---------- úprava plánu ----------
export function PlanEditor({ id }: { id: string }) {
  const w = useTable<Workout>('workouts').find((x) => x.id === id);
  const exercises = [...useTable<Exercise>('exercises')].sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  const [add, setAdd] = useState(false);
  const [name, setName] = useState('');
  if (!w) return <Back />;
  const save = (patch: Partial<Workout>) => put('workouts', { ...w, ...patch });
  const setItem = (i: number, patch: Partial<PlanItem>) => save({ items: w.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const move = (i: number, d: number) => {
    const items = [...w.items];
    const [x] = items.splice(i, 1);
    items.splice(i + d, 0, x);
    save({ items });
  };
  const addItem = (exercise_id: string) => {
    save({ items: [...w.items, { exercise_id, sets: 3, reps_min: 10, reps_max: 10, unit: 'op' }] });
    setAdd(false);
    setName('');
  };
  return (
    <>
      <Back to={'#/trenink/w/' + w.id} label={'Trénink ' + w.code} />
      <header className="top">
        <h1 className="plain">Upravit plán</h1>
      </header>
      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 8 }}>
          <label className="field" style={{ marginTop: 0 }}>
            <span>Kód</span>
            <input className="inp" value={w.code} maxLength={2} onChange={(e) => save({ code: e.target.value })} />
          </label>
          <label className="field" style={{ marginTop: 0 }}>
            <span>Název</span>
            <input className="inp" value={w.name} onChange={(e) => save({ name: e.target.value })} />
          </label>
        </div>
        <label className="field">
          <span>Den</span>
          <select className="inp" value={w.weekday} onChange={(e) => save({ weekday: +e.target.value })}>
            {DNY.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
          </select>
        </label>
      </div>

      {w.items.map((it, i) => (
        <div className="ex" key={i}>
          <div className="ex-head">
            <h3 style={{ flex: 1 }}>{exercises.find((e) => e.id === it.exercise_id)?.name ?? it.exercise_id}</h3>
            <button className="round" aria-label="Posunout výš" disabled={i === 0} onClick={() => move(i, -1)}><Icon n="up" size={20} /></button>
            <button className="round" aria-label="Posunout níž" disabled={i === w.items.length - 1} onClick={() => move(i, 1)}><Icon n="down" size={20} /></button>
            <button className="round" aria-label="Odebrat cvik" onClick={() => save({ items: w.items.filter((_, j) => j !== i) })}><Icon n="x" size={20} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.3fr', gap: 6 }}>
            <label className="field"><span>Série</span><Num value={it.sets} label="Série" onChange={(v) => v && setItem(i, { sets: Math.max(1, Math.round(v)) })} /></label>
            <label className="field"><span>Od</span><Num value={it.reps_min} label="Opakování od" onChange={(v) => v && setItem(i, { reps_min: v })} /></label>
            <label className="field"><span>Do</span><Num value={it.reps_max} label="Opakování do" onChange={(v) => v && setItem(i, { reps_max: v })} /></label>
            <label className="field">
              <span>Jednotka</span>
              <select className="inp" value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value as PlanItem['unit'] })}>
                <option value="op">opak.</option>
                <option value="s">sekundy</option>
                <option value="m">metry</option>
              </select>
            </label>
          </div>
        </div>
      ))}

      <button className="btn wide" style={{ marginTop: 12 }} onClick={() => setAdd(true)}>
        <Icon n="plus" size={20} /> Přidat cvik
      </button>
      <button
        className="btn danger ghost wide"
        style={{ marginTop: 10 }}
        onClick={() => { if (confirm(`Smazat celý trénink ${w.code}? Zapsaná historie zůstane.`)) { remove('workouts', w.id); go('#/trenink'); } }}
      >
        Smazat trénink
      </button>

      {add && (
        <Sheet title="Přidat cvik" onClose={() => setAdd(false)}>
          <label className="field">
            <span>Nový cvik</span>
            <input className="inp" value={name} placeholder="Název cviku" onChange={(e) => setName(e.target.value)} />
          </label>
          {name.trim() && (
            <button
              className="btn pri wide"
              style={{ marginTop: 8 }}
              onClick={() => { const nid = uid(); put('exercises', { id: nid, name: name.trim() }); addItem(nid); }}
            >
              Založit „{name.trim()}“
            </button>
          )}
          <div className="field">
            <span>Nebo vyber ze seznamu</span>
            <div className="list">
              {exercises
                .filter((e) => e.name.toLowerCase().includes(name.trim().toLowerCase()))
                .map((e) => (
                  <button className="row" key={e.id} onClick={() => addItem(e.id)}>
                    <span className="grow t">{e.name}</span>
                  </button>
                ))}
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
}

