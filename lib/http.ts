import { RepoError } from './github';

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function errorResponse(err: unknown) {
  if (err instanceof RepoError) return json({ error: err.message }, err.status);
  console.error(err);
  return json({ error: 'Something went wrong on the server. Please try again.' }, 500);
}

export async function readJson<T>(req: Request): Promise<Partial<T>> {
  try {
    return (await req.json()) as Partial<T>;
  } catch {
    return {};
  }
}
