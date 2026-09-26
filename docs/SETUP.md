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
| `GROQ_API_KEY` | Turns on the optional **Explain** button using Groq's free API (no card needed) | no |
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

### Optional: turn on the ✦ Explain button (3 minutes, free, no card)
Search works fully without it. The button adds a one-sentence AI summary under each result, and it stays hidden until you do this.
1. Open https://console.groq.com/keys and sign in with Google or GitHub.
2. Click **Create API Key**, name it `grepless`, click **Submit**, and copy the key (it starts with `gsk_`).
3. Open https://vercel.com/core-dumped1/grepless/settings/environment-variables
4. **Key:** `GROQ_API_KEY` · **Value:** paste · keep all environments ticked · **Save**.
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

## Future: private repos (GitHub OAuth)
This is the one feature that needs a manual step, because GitHub doesn't allow apps to create OAuth apps. If you want it later:
1. https://github.com/settings/applications/new
2. **Application name:** `grepless` · **Homepage URL:** `https://grepless.vercel.app` · **Authorization callback URL:** `https://grepless.vercel.app/api/auth/callback`
3. Register, then **Generate a new client secret**.
4. Add them in Vercel (same page as above) as `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`. Don't paste the secret into chats or commit it to GitHub.
