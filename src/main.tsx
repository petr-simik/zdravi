import { createRoot } from 'react-dom/client';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './styles.css';
import { init } from './lib/store';
import App from './App';

const theme = localStorage.getItem('zdravi.theme');
if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;

init().then(() => createRoot(document.getElementById('root')!).render(<App />));

// Offline: service worker si uloží všechno, co stránka načetla.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(() =>
    navigator.serviceWorker.ready.then((reg) => {
      const urls = performance.getEntriesByType('resource').map((e) => e.name).concat(location.href.split('#')[0]);
      reg.active?.postMessage({ cache: urls });
    }),
  );
}
