import type { Recording } from '../types';

const KEY = 'voice-memos-recordings';

export function getAll(): Recording[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function save(r: Recording): void {
  const all = getAll();
  const idx = all.findIndex((x) => x.id === r.id);
  if (idx >= 0) all[idx] = r;
  else all.unshift(r);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function getById(id: string): Recording | undefined {
  return getAll().find((r) => r.id === id);
}

export function remove(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(getAll().filter((r) => r.id !== id)));
}
