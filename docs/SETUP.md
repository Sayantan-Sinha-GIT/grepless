# grepless — setup & operations

This page lists where everything lives and what to do when something needs attention. Everything is already set up, and nothing on this page is required for the site to work.

## Where things live

| Thing | Where | Account |
|---|---|---|
| Code | https://github.com/Sayantan-Sinha-GIT/grepless | GitHub `Sayantan-Sinha-GIT` |
| Website | https://grepless.vercel.app | Vercel `sayantan-sinha-git` → project **grepless** |
| Database | Supabase project **semantic-code-search** (region Mumbai, `ap-south-1`) | Supabase org "Sayantan-Sinha-GIT's Org" |

Every push to the `main` branch on GitHub redeploys the site automatically.

## Environment variables (Vercel → grepless → Settings → Environment Variables)

| Name | What it is | Required |
|---|---|---|
| `DATABASE_URL` | Connection string for the `grepless_app` database role (transaction pooler, port 6543) | yes |
| `ONNXRUNTIME_NODE_INSTALL_CUDA` | `skip`. Stops the build from downloading about 300 MB of GPU libraries it doesn't need | yes |
| `GEMINI_API_KEY` | Turns on the optional **Explain** button, using Google Gemini's free tier (tried first) | no |
| `GROQ_API_KEY` | Groq's free API, used automatically if Gemini fails or hits its limit | no |
| `EXPLAIN_ENABLED` / `EXPLAIN_MODEL` | Alternative: `EXPLAIN_ENABLED=true` uses Vercel AI Gateway instead (Vercel requires a card on the account to unlock its free AI credits) | no |
| `GITHUB_TOKEN` | Only used to show repo description and stars without GitHub's 60-requests/hour limit | no |

### Optional: add a GitHub token (takes 2 minutes)
Without it, a busy day may occasionally show a repo without its description or star count. Indexing itself never needs it.
1. Open https://github.com/settings/personal-access-tokens/new
2. **Token name:** `grepless-public-read` · **Expiration:** 1 year · **Repository access:** *Public repositories*.
3. Leave all permissions as they are. Click **Generate token** and copy it.
4. Open https://vercel.com/core-dumped1/grepless/settings/environment-variables
5. **Key:** `GITHUB_TOKEN` · **Value:** paste · keep all environments ticked · **Save**.
6. Go to the **Deployments** tab → on the top deployment click **⋯** → **Redeploy**.

### Optional: turn on the ✦ Explain button (free, no card)
Search works fully without it. The button adds a one-sentence AI summary under each result. Gemini answers first; if it fails, Groq answers instead. The button stays hidden until at least one key is set.
1. Gemini key: https://aistudio.google.com/apikey → **Create API key** → copy.
2. Groq key: https://console.groq.com/keys → **Create API Key** → copy (starts with `gsk_`).
3. Open https://vercel.com/core-dumped1/grepless/settings/environment-variables
4. Add `GEMINI_API_KEY` = the Gemini key, then `GROQ_API_KEY` = the Groq key (Production + Preview ticked, **Sensitive** on) → **Save**.
5. **Deployments** tab → top deployment → **⋯** → **Redeploy**. The ✦ Explain button now appears on every result.

## Limits (see `lib/config.ts`)
60 MB compressed tarball · 1,500 files · 6,000 chunks · 200 KB per file · 3 repos indexing at the same time.

## Troubleshooting

| Symptom | What to do |
|---|---|
| A repo shows **Error** | Click **Try again**. If it says "not found" or "private", the repo is private or the URL is wrong. |
| Indexing seems stuck | Reload the page. Indexing resumes from where it stopped. |
| Site shows a server error | Vercel → grepless → **Logs**, and look at the red lines. |
| Database paused | Free Supabase projects pause after 7 days without traffic. Open the Supabase dashboard → project → **Restore**. |

## Sign in with GitHub (private repos)

grepless is a **GitHub App** named `grepless`, owned by `Sayantan-Sinha-GIT`. It can only *read* code and basic repo details, and only for repos someone chose to share with it.

| Name (Vercel env) | What it is |
|---|---|
| `GITHUB_APP_SLUG` | The app's short name, used in `github.com/apps/<slug>` |
| `GITHUB_APP_ID` | The app's number |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Let the site swap GitHub's sign-in code for a token |
| `AUTH_SECRET` | Random 43 characters. Encrypts GitHub tokens in the database. **Changing it signs everyone out.** |

The sign-in button stays hidden until all five are set.

- App settings: https://github.com/settings/apps/grepless-search
- Who has installed it: https://github.com/settings/installations
- To recreate the app from scratch: `node scripts/create-github-app.mjs`, click the button, then **Create GitHub App** on GitHub. It writes the values to `.env.local`.

### Troubleshooting sign-in
| Symptom | What to do |
|---|---|
| "GitHub did not complete the sign-in" | Try again. If it keeps happening, check the Vercel logs for `[auth] callback failed`. |
| A private repo says "Not one of yours" | On `/me`, click **Add or remove repos** and tick that repo on GitHub. |
| Sign-in button missing | One of the five variables above is missing in Vercel. |
