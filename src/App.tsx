import { useEffect, useState } from 'react';
import { Icon } from './ui';
import { importAll, useTable } from './lib/store';
import Today from './screens/Today';
import { TrainingHome, WorkoutDetail, SessionScreen, ExerciseScreen, PlanEditor } from './screens/Training';
import Metrics from './screens/Metrics';
import Health from './screens/Health';
import More from './screens/More';

const TABS = [
  ['dnes', 'Dnes'],
  ['trenink', 'Trénink'],
  ['metriky', 'Metriky'],
  ['zdravi', 'Zdraví'],
  ['vice', 'Více'],
];

function useRoute() {
  const read = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [r, setR] = useState(read);
  useEffect(() => {
    const h = () => {
      setR(read());
      scrollTo(0, 0);
    };
    addEventListener('hashchange', h);
    return () => removeEventListener('hashchange', h);
  }, []);
  return r;
}

function Welcome() {
  const [err, setErr] = useState('');
  const load = async (file?: File) => {
    try {
      const text = file ? await file.text() : await (await fetch('/seed/seed.json')).text();
      const dump = JSON.parse(text);
      if (!dump.tables) throw new Error();
      importAll(dump);
    } catch {
      setErr('Soubor se nepodařilo načíst. Vyber soubor seed.json nebo zálohu z aplikace Zdraví.');
    }
  };
  return (
    <div className="app">
      <div className="welcome">
        <h1>
          Zdra<span>ví</span>
        </h1>
        <p className="muted">
          Trénink, návyky, metriky a suplementy na jednom místě. Data zůstávají jen v tomhle zařízení.
        </p>
        <label className="btn pri wide">
          Nahrát můj plán ze souboru
          <input type="file" accept="application/json,.json" hidden onChange={(e) => load(e.target.files?.[0])} />
        </label>
        {import.meta.env.DEV && (
          <button className="btn wide" onClick={() => load()}>
            Načíst seed (jen při vývoji)
          </button>
        )}
        <button className="btn ghost wide" onClick={() => importAll({ tables: { profiles: [{ id: 'me', household_id: 'home', name: '' }] } })}>
          Začít s prázdnou aplikací
        </button>
        {err && <p role="alert" style={{ color: 'var(--warn)' }}>{err}</p>}
      </div>
    </div>
  );
}

export default function App() {
  const r = useRoute();
  const profiles = useTable('profiles');
  if (!profiles.length) return <Welcome />;

  const tab = r[0] && TABS.some((t) => t[0] === r[0]) ? r[0] : 'dnes';
  let screen;
  if (tab === 'trenink') {
    if (r[1] === 'w' && r[2]) screen = <WorkoutDetail id={r[2]} />;
    else if (r[1] === 's' && r[2]) screen = <SessionScreen id={r[2]} />;
    else if (r[1] === 'c' && r[2]) screen = <ExerciseScreen id={r[2]} />;
    else if (r[1] === 'upravit' && r[2]) screen = <PlanEditor id={r[2]} />;
    else screen = <TrainingHome />;
  } else if (tab === 'metriky') screen = <Metrics />;
  else if (tab === 'zdravi') screen = <Health />;
  else if (tab === 'vice') screen = <More />;
  else screen = <Today />;

  return (
    <>
      <main className="app">{screen}</main>
      <nav className="nav" aria-label="Hlavní">
        <div>
          {TABS.map(([id, label]) => (
            <a key={id} href={'#/' + id} aria-current={tab === id ? 'page' : undefined}>
              <Icon n={id} />
              {label}
            </a>
          ))}
        </div>
      </nav>
    </>
  );
}
