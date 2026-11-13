import { useState } from 'react';
import { put, remove, uid, useTable, Row } from '../lib/store';
import { Day, cz, dayOf, saveDay, today } from '../lib/model';
import { Check, Icon, Sheet } from '../ui';

export default function Health() {
  const supplements = [...useTable<Row>('supplements')].sort((a, b) => a.order - b.order);
  const tasks = [...useTable<Row>('health_tasks')].sort((a, b) => +!!a.done - +!!b.done || (a.order ?? 99) - (b.order ?? 99));
  const days = useTable<Day>('days');
  const day = dayOf(days, today());
  const [edit, setEdit] = useState<Row | null>(null);
  const [sup, setSup] = useState<Row | null>(null);

  return (
    <>
      <header className="top">
        <h1 className="plain">Zdraví</h1>
      </header>

      <section className="sec" style={{ marginTop: 0 }}>
        <h2>Suplementy <small>dnes</small></h2>
        <div className="list">
          {supplements.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', borderTop: s === supplements[0] ? 0 : '1px solid var(--line)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {s.status === 'paused' ? (
                  <Check off done={false} title={s.name} desc={s.note || 'Pozastaveno'} />
                ) : (
                  <Check
                    title={s.name}
                    desc={[s.dose, s.time].filter(Boolean).join(', ')}
                    done={!!day.supplements[s.id]}
                    onToggle={() => saveDay(day, { supplements: { ...day.supplements, [s.id]: !day.supplements[s.id] } })}
                  />
                )}
              </div>
              <button className="round" style={{ marginRight: 10, background: 'none' }} aria-label={'Upravit ' + s.name} onClick={() => setSup(s)}>
                <Icon n="vice" size={20} />
              </button>
            </div>
          ))}
        </div>
        <button
          className="btn ghost wide"
          style={{ marginTop: 10 }}
          onClick={() => setSup({ id: uid(), name: '', dose: '', time: '', status: 'active', order: supplements.length + 1, isNew: true })}
        >
          <Icon n="plus" size={20} /> Přidat suplement
        </button>
      </section>

      <section className="sec">
        <h2>Zdravotní úkoly</h2>
        {tasks.length === 0 && <div className="card empty">Žádné úkoly. Přidej objednání, vyšetření nebo výsledky.</div>}
        <div className="list">
          {tasks.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', borderTop: t === tasks[0] ? 0 : '1px solid var(--line)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Check
                  title={t.title}
                  desc={[t.due && 'do ' + cz(t.due), t.note].filter(Boolean).join(', ')}
                  done={!!t.done}
                  onToggle={() => put('health_tasks', { ...t, done: !t.done })}
                />
              </div>
              <button className="round" style={{ marginRight: 10, background: 'none' }} aria-label={'Upravit ' + t.title} onClick={() => setEdit(t)}>
                <Icon n="vice" size={20} />
              </button>
            </div>
          ))}
        </div>
        <button
          className="btn ghost wide"
          style={{ marginTop: 10 }}
          onClick={() => setEdit({ id: uid(), title: '', note: '', due: '', order: tasks.length + 1, isNew: true })}
        >
          <Icon n="plus" size={20} /> Přidat úkol
        </button>
      </section>

      {edit && (
        <Sheet title={edit.isNew ? 'Nový úkol' : 'Upravit úkol'} onClose={() => setEdit(null)}>
          <label className="field"><span>Co udělat</span>
            <input className="inp" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></label>
          <label className="field"><span>Termín</span>
            <input className="inp" type="date" value={edit.due ?? ''} onChange={(e) => setEdit({ ...edit, due: e.target.value })} /></label>
          <label className="field"><span>Poznámka</span>
            <textarea className="inp" value={edit.note ?? ''} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></label>
          <div className="btns">
            {!edit.isNew && (
              <button className="btn danger" onClick={() => { remove('health_tasks', edit.id); setEdit(null); }}>Smazat</button>
            )}
            <button className="btn pri" disabled={!edit.title.trim()} onClick={() => { const { isNew, ...row } = edit; put('health_tasks', row as Row); setEdit(null); }}>
              Uložit úkol
            </button>
          </div>
        </Sheet>
      )}

      {sup && (
        <Sheet title={sup.isNew ? 'Nový suplement' : 'Upravit suplement'} onClose={() => setSup(null)}>
          <label className="field"><span>Název</span>
            <input className="inp" value={sup.name} onChange={(e) => setSup({ ...sup, name: e.target.value })} /></label>
          <label className="field"><span>Dávka</span>
            <input className="inp" value={sup.dose ?? ''} onChange={(e) => setSup({ ...sup, dose: e.target.value })} /></label>
          <label className="field"><span>Kdy</span>
            <input className="inp" value={sup.time ?? ''} onChange={(e) => setSup({ ...sup, time: e.target.value })} /></label>
          <div className="field">
            <span>Stav</span>
            <div className="chips">
              <button className="chip" aria-pressed={sup.status !== 'paused'} onClick={() => setSup({ ...sup, status: 'active' })}>Užívám</button>
              <button className="chip" aria-pressed={sup.status === 'paused'} onClick={() => setSup({ ...sup, status: 'paused' })}>Pozastaveno</button>
            </div>
          </div>
          <label className="field"><span>Poznámka</span>
            <input className="inp" value={sup.note ?? ''} onChange={(e) => setSup({ ...sup, note: e.target.value })} /></label>
          <div className="btns">
            {!sup.isNew && (
              <button className="btn danger" onClick={() => { if (confirm(`Smazat ${sup.name}? Pozastavení ho jen skryje z odškrtávání.`)) { remove('supplements', sup.id); setSup(null); } }}>Smazat</button>
            )}
            <button className="btn pri" disabled={!sup.name.trim()} onClick={() => { const { isNew, ...row } = sup; put('supplements', row as Row); setSup(null); }}>
              Uložit suplement
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}
