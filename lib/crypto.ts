// Small crypto helpers for sign-in. GitHub tokens are sealed with AES-256-GCM
// (key derived from AUTH_SECRET) before they are stored, and session cookies
// are random values whose SHA-256 is the only thing the database sees.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function key(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('AUTH_SECRET is not set (needs 32+ characters)');
  return createHash('sha256').update(secret).digest();
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), body.toString('base64url')].join('.');
}

/** Returns null when the value was tampered with or sealed under a different secret. */
export function unseal(sealed: string): string | null {
  const [version, iv, tag, body] = sealed.split('.');
  if (version !== 'v1' || !iv || !tag || body === undefined) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
