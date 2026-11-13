import { useState } from 'react';
import { exportAll, get, ids, importAll, put, useTable, wipe } from '../lib/store';
import { Phase, cz, currentPhase, today } from '../lib/model';
import { Check } from '../ui';

function download(name: string, text: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function More() {
  const phases = [...useTable<Phase>('phases')].sort((a, b) => a.start.localeCompare(b.start));
  useTable('profiles');
  const profile = get('profiles', ids().user_id);
  const [theme, setTheme] = useState(localStorage.getItem('zdravi.theme') ?? 'auto');
  const [msg, setMsg] = useState('');
  const cur = currentPhase(phases);

  const pick = (t: string) => {
    setTheme(t);
    if (t === 'auto') {
      localStorage.removeItem('zdravi.theme');
      delete document.documentElement.dataset.theme;
    } else {
      localStorage.setItem('zdravi.theme', t);
      document.documentElement.dataset.theme = t;
    }
  };

  const csv = () => {
    const d = exportAll().tables;
    const lines = ['typ;datum;hodnota'];
    for (const m of d.metrics ?? []) if (!m.deleted) lines.push(`${m.type};${m.date};${String(m.value).replace('.', ',')}`);
    for (const s of d.sessions ?? [])
      if (!s.deleted)
        for (const e of s.entries)
          e.sets.forEach((x: any, i: number) => x.done && lines.push(`trenink ${s.code} / ${e.exercise_id} / serie ${i + 1};${s.date};${x.weight ?? ''} kg x ${x.reps ?? ''} RPE ${x.rpe ?? ''}`));
    download(`zdravi-${today()}.csv`, '﻿' + lines.join('\r\n'), 'text/csv');
  };

  return (
    <>
      <header className="top">
        <h1 className="plain">Více</h1>
      </header>

      {phases.map((p) => (
        <section className="sec" key={p.id} style={p === phases[0] ? { marginTop: 0 } : undefined}>
          <h2>
            {p.name} {p === cur && <span className="tag go">aktuální</span>}
            <small>{cz(p.start)} až {cz(p.end)} {p.end.slice(0, 4)}</small>
          </h2>
          <div className="list">
            {p.goals.map((g, i) => (
              <Check
                key={i}
                title={g.text}
                done={!!g.done}
                onToggle={() => put('phases', { ...p, goals: p.goals.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })}
              />
            ))}
          </div>
        </section>
      ))}

      {!!profile?.micro_break?.length && (
        <section className="sec">
          <h2>Mikro-pauza <small>2 min, každých 45-60 min</small></h2>
          <div className="card">
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              {profile.micro_break.map((m: string) => <li key={m} style={{ padding: '3px 0' }}>{m}</li>)}
            </ol>
          </div>
        </section>
      )}

      <section className="sec">
        <h2>Vzhled</h2>
        <div className="chips">
          {[['auto', 'Podle telefonu'], ['light', 'Světlý'], ['dark', 'Tmavý']].map(([id, label]) => (
            <button key={id} className="chip" aria-pressed={theme === id} onClick={() => pick(id)}>{label}</button>
          ))}
        </div>
      </section>

      <section className="sec">
        <h2>Moje data</h2>
        <div className="card">
          <p className="small muted">
            Data jsou uložená jen v tomhle zařízení. Jednou za čas si stáhni zálohu, stejným souborem je přeneseš i do
            jiného telefonu nebo počítače.
          </p>
          <div className="btns" style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => download(`zdravi-zaloha-${today()}.json`, JSON.stringify(exportAll()), 'application/json')}>
              Stáhnout zálohu (JSON)
            </button>
            <button className="btn" onClick={csv}>Stáhnout CSV</button>
            <label className="btn">
              Nahrát zálohu
              <input
                type="file"
                accept="application/json,.json"
                hidden
                onChange={async (e) => {
                  try {
                    const dump = JSON.parse(await e.target.files![0].text());
                    if (!dump.tables) throw new Error();
                    importAll(dump);
                    setMsg('Záloha je nahraná.');
                  } catch {
                    setMsg('Soubor se nepodařilo načíst. Vyber zálohu z aplikace Zdraví.');
                  }
                }}
              />
            </label>
          </div>
          {msg && <p role="status" className="small" style={{ marginTop: 10 }}>{msg}</p>}
          <button
            className="btn danger ghost wide"
            style={{ marginTop: 14 }}
            onClick={async () => {
              if (confirm('Smazat všechna data z tohohle zařízení? Bez zálohy to nejde vrátit.')) {
                await wipe();
                location.hash = '';
                location.reload();
              }
            }}
          >
            Smazat všechna data
          </button>
        </div>
      </section>

      <p className="muted small" style={{ marginTop: 22 }}>
        Plán tréninku, výživy a suplementů je obecné doporučení, ne lékařská péče. Aplikace nic nediagnostikuje, jen
        zaznamenává a zobrazuje.
      </p>
    </>
  );
}
