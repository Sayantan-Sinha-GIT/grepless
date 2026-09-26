// Fetches a public repository as a single gzip tarball (no clone, no
// per-file API calls) and streams its entries through a small tar reader.
// The commit SHA comes from the tarball's pax global header, so result links
// can point at an immutable permalink.

import { LIMITS } from './config';

export class RepoError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface RepoRef {
  owner: string;
  name: string;
}

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const NAME_RE = /^[A-Za-z0-9._-]{1,100}$/;

/** Accepts `owner/repo`, any github.com URL (tree/blob paths are ignored), or an SSH remote. */
export function parseRepoInput(input: string): RepoRef | null {
  let s = input.trim();
  s = s.replace(/^git@github\.com:/i, '');
  s = s.replace(/^(https?:\/\/)?(www\.)?github\.com\//i, '');
  s = s.split(/[?#]/)[0];
  const [owner, rawName] = s.split('/').filter(Boolean);
  if (!owner || !rawName) return null;
  const name = rawName.replace(/\.git$/i, '');
  if (!OWNER_RE.test(owner) || !NAME_RE.test(name) || name === '.' || name === '..') return null;
  return { owner, name };
}

export interface RepoMeta {
  owner: string;
  name: string;
  description: string | null;
  stars: number | null;
  language: string | null;
}

/**
 * Optional metadata from the REST API. Unauthenticated calls are limited to
 * 60/hour per IP, so a rate-limit response is not fatal: we index anyway.
 */
export async function fetchRepoMeta(ref: RepoRef): Promise<RepoMeta | null> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'grepless',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  try {
    const res = await fetch(`https://api.github.com/repos/${ref.owner}/${ref.name}`, {
      headers,
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    if (res.status === 404) throw new RepoError('Repository not found. Only public GitHub repositories are supported.', 404);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      private: boolean;
      owner: { login: string };
      name: string;
      description: string | null;
      stargazers_count: number;
      language: string | null;
    };
    if (data.private) throw new RepoError('This repository is private. Only public repositories are supported.', 403);
    return {
      owner: data.owner.login,
      name: data.name,
      description: data.description,
      stars: data.stargazers_count,
      language: data.language,
    };
  } catch (err) {
    if (err instanceof RepoError) throw err;
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tarball streaming

class ByteReader {
  private chunks: Uint8Array[] = [];
  private length = 0;
  constructor(private readonly source: AsyncIterator<Uint8Array>) {}

  private async fill(n: number): Promise<boolean> {
    while (this.length < n) {
      const next = await this.source.next();
      if (next.done) return false;
      this.chunks.push(next.value);
      this.length += next.value.length;
    }
    return true;
  }

  async read(n: number): Promise<Buffer | null> {
    if (!(await this.fill(n))) return null;
    const all = this.chunks.length === 1 ? Buffer.from(this.chunks[0]) : Buffer.concat(this.chunks);
    const out = Buffer.from(all.subarray(0, n));
    const rest = all.subarray(n);
    this.chunks = rest.length ? [rest] : [];
    this.length = rest.length;
    return out;
  }

  async skip(n: number): Promise<void> {
    let left = n;
    while (left > 0) {
      if (this.length === 0 && !(await this.fill(1))) return;
      const take = Math.min(left, this.length);
      await this.read(take);
      left -= take;
    }
  }
}

function field(block: Buffer, start: number, len: number): string {
  const raw = block.subarray(start, start + len);
  const end = raw.indexOf(0);
  return raw.subarray(0, end === -1 ? len : end).toString('utf8');
}

function parsePax(data: Buffer): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < data.length) {
    const space = data.indexOf(0x20, i);
    if (space === -1) break;
    const len = parseInt(data.subarray(i, space).toString(), 10);
    if (!len) break;
    const record = data.subarray(space + 1, i + len - 1).toString('utf8');
    const eq = record.indexOf('=');
    if (eq > 0) out[record.slice(0, eq)] = record.slice(eq + 1);
    i += len;
  }
  return out;
}

export interface TarFile {
  path: string; // repo-relative, without the top-level folder
  size: number;
  content: Buffer | null; // null when skipped by `wantContent`
}

export interface RepoDownload {
  commitSha: string | null;
  files: AsyncGenerator<TarFile>;
}

function limitBytes(max: number, message: string) {
  let seen = 0;
  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      seen += chunk.byteLength;
      if (seen > max) controller.error(new RepoError(message, 413));
      else controller.enqueue(chunk);
    },
  });
}

/**
 * Streams the repository's default branch. `wantContent(path, size)` decides
 * whether a file body is buffered or skipped without being held in memory.
 */
export async function downloadRepo(
  ref: RepoRef,
  wantContent: (path: string, size: number) => boolean,
): Promise<RepoDownload> {
  const res = await fetch(`https://codeload.github.com/${ref.owner}/${ref.name}/tar.gz/HEAD`, {
    headers: { 'User-Agent': 'grepless' },
    signal: AbortSignal.timeout(120_000),
    cache: 'no-store',
  });
  if (res.status === 404) {
    throw new RepoError('Repository not found. Check the URL — only public GitHub repositories are supported.', 404);
  }
  if (!res.ok || !res.body) throw new RepoError(`GitHub returned ${res.status} while downloading the repository.`, 502);

  const stream = res.body
    .pipeThrough(limitBytes(LIMITS.maxTarballBytes, 'Repository is too large to index (over 60 MB compressed).'))
    .pipeThrough(new DecompressionStream('gzip') as unknown as TransformStream<Uint8Array, Uint8Array>)
    .pipeThrough(limitBytes(LIMITS.maxTarballBytes * 8, 'Repository is too large to index.'));
  const reader = new ByteReader((stream as unknown as AsyncIterable<Uint8Array>)[Symbol.asyncIterator]());

  // Read the first header eagerly so the commit SHA is known before iteration.
  let commitSha: string | null = null;
  let pending: Buffer | null = await reader.read(512);
  if (pending && String.fromCharCode(pending[156]) === 'g') {
    const size = parseInt(field(pending, 124, 12).trim() || '0', 8);
    const data = await reader.read(Math.ceil(size / 512) * 512);
    if (data) commitSha = parsePax(data.subarray(0, size)).comment ?? null;
    pending = null;
  }
  if (commitSha && !/^[0-9a-f]{40}$/.test(commitSha)) commitSha = null;

  async function* entries(): AsyncGenerator<TarFile> {
    let longName: string | null = null;
    let paxPath: string | null = null;
    while (true) {
      const header = pending ?? (await reader.read(512));
      pending = null;
      if (!header || header.every((b) => b === 0)) return;
      const type = String.fromCharCode(header[156] || 0x30);
      const size = parseInt(field(header, 124, 12).trim() || '0', 8) || 0;
      const padded = Math.ceil(size / 512) * 512;
      const prefix = field(header, 257, 6).startsWith('ustar') ? field(header, 345, 155) : '';
      let name = longName ?? paxPath ?? (prefix ? `${prefix}/${field(header, 0, 100)}` : field(header, 0, 100));

      if (type === 'L' || type === 'x' || type === 'g') {
        const data = await reader.read(padded);
        if (!data) return;
        const body = data.subarray(0, size);
        if (type === 'L') longName = body.toString('utf8').replace(/\0+$/, '');
        if (type === 'x') paxPath = parsePax(body).path ?? null;
        continue;
      }
      longName = null;
      paxPath = null;

      if (type !== '0') {
        await reader.skip(padded);
        continue;
      }
      name = name.split('/').slice(1).join('/');
      if (!name) {
        await reader.skip(padded);
        continue;
      }
      if (wantContent(name, size)) {
        const data = await reader.read(padded);
        if (!data) return;
        yield { path: name, size, content: data.subarray(0, size) };
      } else {
        await reader.skip(padded);
        yield { path: name, size, content: null };
      }
    }
  }

  return { commitSha, files: entries() };
}

export function blobUrl(owner: string, name: string, sha: string | null, path: string, start?: number, end?: number) {
  const ref = sha ?? 'HEAD';
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  const lines = start ? `#L${start}${end && end !== start ? `-L${end}` : ''}` : '';
  return `https://github.com/${owner}/${name}/blob/${ref}/${encoded}${lines}`;
}
