// Per-browser list of repos this visitor opened. A convenience only: the
// shared "Recently indexed" list comes from the database.
const KEY = 'grepless:recent';

export interface RecentEntry {
  owner: string;
  name: string;
  at: number;
}

export function readRecent(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as RecentEntry[]) : [];
    return Array.isArray(list) ? list.filter((e) => e && e.owner && e.name) : [];
  } catch {
    return [];
  }
}

export function rememberRepo(owner: string, name: string) {
  try {
    const list = readRecent().filter((e) => `${e.owner}/${e.name}`.toLowerCase() !== `${owner}/${name}`.toLowerCase());
    list.unshift({ owner, name, at: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 12)));
  } catch {
    // storage unavailable (private mode) — nothing to do
  }
}
