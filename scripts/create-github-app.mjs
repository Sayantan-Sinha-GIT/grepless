// One-click creation of the grepless GitHub App (GitHub's "app manifest" flow).
//
//   node scripts/create-github-app.mjs
//
// Opens a local page with one button. GitHub shows the pre-filled app, you
// click "Create GitHub App", GitHub sends a one-time code back here, and this
// script swaps it for the app's credentials and writes them to .env.local
// (git-ignored). Nothing secret is printed.

import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';

const PORT = 4599;
const SITE = 'https://grepless.vercel.app';
const ENV_FILE = new URL('../.env.local', import.meta.url);
const state = randomBytes(16).toString('hex');

const manifest = {
  name: 'grepless',
  url: SITE,
  description:
    'Semantic code search over your GitHub repositories. Read-only: grepless downloads the code you choose, indexes it, and lets you search it by meaning.',
  hook_attributes: { url: `${SITE}/api/github/webhook`, active: false },
  redirect_url: `http://localhost:${PORT}/callback`,
  callback_urls: [`${SITE}/api/auth/callback`, 'http://localhost:3000/api/auth/callback'],
  setup_url: `${SITE}/api/auth/installed`,
  setup_on_update: true,
  public: true,
  default_permissions: { contents: 'read', metadata: 'read' },
  default_events: [],
  request_oauth_on_install: false,
};

const escape = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const page = (body) => `<!doctype html><meta charset="utf-8"><title>grepless · create GitHub App</title>
<style>body{font:16px/1.5 system-ui,sans-serif;background:#0f0d17;color:#f4f2fb;display:grid;place-items:center;min-height:100vh;margin:0}
main{max-width:34rem;padding:2rem}h1{font-weight:300;font-size:2.4rem;letter-spacing:-.03em;margin:0 0 1rem}
p{color:#a39db8}button{font:600 1rem system-ui;background:#c8f34a;color:#17210a;border:0;border-radius:999px;padding:1rem 1.6rem;cursor:pointer}
code{background:#17141f;padding:.1rem .4rem;border-radius:.4rem;color:#c8f34a}</style><main>${body}</main>`;

function upsertEnv(values) {
  let text = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : '';
  for (const [k, v] of Object.entries(values)) {
    const line = `${k}=${v}`;
    const re = new RegExp(`^${k}=.*$`, 'm');
    text = re.test(text) ? text.replace(re, line) : `${text.replace(/\n?$/, '\n')}${line}\n`;
  }
  writeFileSync(ENV_FILE, text);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(
      page(`<h1>Create the grepless GitHub App</h1>
<p>Make sure you are signed in to GitHub as <code>Sayantan-Sinha-GIT</code>. Click the button, then on GitHub click the green <b>Create GitHub App</b> button at the bottom.</p>
<form action="https://github.com/settings/apps/new?state=${state}" method="post">
<input type="hidden" name="manifest" value="${escape(JSON.stringify(manifest))}">
<button type="submit">Continue to GitHub →</button></form>`),
    );
    return;
  }
  if (url.pathname === '/callback') {
    const code = url.searchParams.get('code');
    if (!code || url.searchParams.get('state') !== state) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(page('<h1>That link is stale</h1><p>Go back to the first page and click the button again.</p>'));
      return;
    }
    try {
      const r = await fetch(`https://api.github.com/app-manifests/${code}/conversions`, {
        method: 'POST',
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'grepless-setup' },
      });
      const app = await r.json();
      if (!r.ok) throw new Error(app.message || `GitHub returned ${r.status}`);
      const existing = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : '';
      upsertEnv({
        GITHUB_APP_SLUG: app.slug,
        GITHUB_APP_ID: String(app.id),
        GITHUB_CLIENT_ID: app.client_id,
        GITHUB_CLIENT_SECRET: app.client_secret,
        ...(/^AUTH_SECRET=.{32,}$/m.test(existing) ? {} : { AUTH_SECRET: randomBytes(32).toString('base64url') }),
      });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(page(`<h1>Done ✓</h1><p>The app <code>${escape(app.slug)}</code> was created for <code>${escape(app.owner?.login ?? '?')}</code>. You can close this tab and go back to the terminal.</p>`));
      console.log(JSON.stringify({ ok: true, slug: app.slug, id: app.id, owner: app.owner?.login, url: app.html_url }));
      server.close();
      setTimeout(() => process.exit(0), 200);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(page(`<h1>Something went wrong</h1><p>${escape(String(err.message ?? err))}</p><p>Go back to the first page and try again.</p>`));
      console.error('conversion failed:', err.message ?? err);
    }
    return;
  }
  res.writeHead(404).end();
});

server.listen(PORT, () => console.log(`Open http://localhost:${PORT} and click the button.`));
