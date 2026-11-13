import { all, get, ids, put, uid, Row } from './store';

export interface PlanItem {
  exercise_id: string;
  sets: number;
  reps_min: number;
  reps_max: number;
  unit: 'op' | 's' | 'm';
  per_side?: boolean;
  start?: string;
}
export interface Workout extends Row {
  code: string;
  name: string;
  weekday: number; // 1 = pondělí
  optional?: boolean;
  items: PlanItem[];
}
export interface Exercise extends Row {
  name: string;
  technique?: string;
  note?: string;
  image?: string;
  substitutes?: string[];
}
export interface SetLog {
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  done: boolean;
}
export interface Entry {
  exercise_id: string;
  original_id?: string;
  pain?: number;
  target: PlanItem;
  sets: SetLog[];
}
export interface Session extends Row {
  workout_id: string;
  code: string;
  date: string;
  finished_at?: string;
  entries: Entry[];
}
export interface Day extends Row {
  date: string;
  habits: Record<string, number | boolean>;
  supplements: Record<string, boolean>;
  evening?: { mucus?: number; back?: number; neck?: number; fresh?: number; tags?: string[]; note?: string };
}
export interface Habit extends Row {
  name: string;
  kind: 'check' | 'count';
  target?: number;
  unit?: string;
  order: number;
}
export interface Metric extends Row {
  date: string;
  type: string;
  value: number;
}
export interface Phase extends Row {
  name: string;
  start: string;
  end: string;
  goals: { text: string; done?: boolean }[];
  steps: { until: string; target: number }[];
}

// ---- datum ----
export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => iso(new Date());
export const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
export const weekday = (s: string) => ((parse(s).getDay() + 6) % 7) + 1; // 1 = po
export const diffDays = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 864e5);
export const DNY = ['pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota', 'neděle'];
export const DNY_KR = ['po', 'út', 'st', 'čt', 'pá', 'so', 'ne'];
export const cz = (s: string) => {
  const d = parse(s);
  return `${d.getDate()}. ${d.getMonth() + 1}.`;
};
export const num = (n: number | null | undefined, digits = 1) =>
  n == null ? '' : n.toLocaleString('cs-CZ', { maximumFractionDigits: digits });
export const toNum = (s: string): number | null => {
  const v = parseFloat(s.replace(',', '.').replace(/\s/g, ''));
  return isFinite(v) ? v : null;
};

// ---- den ----
export function dayOf(days: Day[], date: string): Day {
  return (
    days.find((d) => d.date === date) ?? { id: ids().user_id + ':' + date, date, habits: {}, supplements: {} }
  );
}
export function saveDay(day: Day, patch: Partial<Day>) {
  put('days', { ...day, ...patch });
}

// ---- fáze ----
export function currentPhase(phases: Phase[], date = today()): Phase | undefined {
  const sorted = [...phases].sort((a, b) => a.start.localeCompare(b.start));
  return sorted.find((p) => date <= p.end) ?? sorted[sorted.length - 1];
}
export function stepTarget(phase: Phase | undefined, date = today()): number | undefined {
  if (!phase?.steps?.length) return undefined;
  return (phase.steps.find((s) => date <= s.until) ?? phase.steps[phase.steps.length - 1]).target;
}
export function targetRpe(phase: Phase | undefined, date = today()): number {
  const t = get('profiles', ids().user_id)?.training ?? {};
  if (!phase || date < phase.start) return t.rpe_start ?? 6;
  return diffDays(phase.start, date) < (t.rpe_switch_weeks ?? 2) * 7 ? t.rpe_start ?? 6 : t.rpe_after ?? 7;
}

// ---- trénink ----
export const sessions = () => all<Session>('sessions');

export function lastEntry(exerciseId: string, beforeId?: string): Entry | undefined {
  const list = sessions()
    .filter((s) => s.id !== beforeId)
    .sort((a, b) => (b.date + (b.updated_at ?? '')).localeCompare(a.date + (a.updated_at ?? '')));
  for (const s of list) {
    const e = s.entries.find((x) => x.exercise_id === exerciseId && x.sets.some((y) => y.done));
    if (e) return e;
  }
}

// Všechny série na horní hranici opakování a RPE nejvýš 7: navrhni přidat.
export function progression(e: Entry | undefined): boolean {
  if (!e) return false;
  const done = e.sets.filter((s) => s.done);
  return (
    done.length >= e.target.sets &&
    done.every((s) => (s.reps ?? 0) >= e.target.reps_max && s.rpe != null && s.rpe <= 7 && (s.weight ?? 0) > 0)
  );
}

export function makeEntry(item: PlanItem, exerciseId = item.exercise_id, original?: string): Entry {
  const prev = lastEntry(exerciseId);
  return {
    exercise_id: exerciseId,
    original_id: original,
    target: item,
    sets: Array.from({ length: item.sets }, (_, i) => {
      const p = prev?.sets[Math.min(i, prev.sets.length - 1)];
      return { weight: p?.weight ?? null, reps: p?.reps ?? null, rpe: null, done: false };
    }),
  };
}

export function startSession(w: Workout): Session {
  const open = sessions().find((s) => s.workout_id === w.id && s.date === today() && !s.finished_at);
  if (open) return open;
  return put<Session>('sessions', {
    id: uid(),
    workout_id: w.id,
    code: w.code,
    date: today(),
    entries: w.items.map((i) => makeEntry(i)),
  });
}

export const repsLabel = (i: PlanItem) =>
  `${i.sets}×${i.reps_min === i.reps_max ? i.reps_min : i.reps_min + '-' + i.reps_max}${
    i.unit === 'op' ? '' : ' ' + i.unit
  }${i.per_side ? ' na stranu' : ''}`;
