# CI/CD

Charmistry uses **GitHub Actions** for continuous integration and deployment to
Cloudflare Workers (via OpenNext).

## Pipeline overview

| Workflow | Trigger | What it does |
|---|---|---|
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | PR to `main` | lint → typecheck → test → build. The merge gate. |
| [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) | push to `main` | lint → typecheck → test → `build:cf` → `deploy`. Ships to Cloudflare only if the gate is green. |

The deploy workflow re-runs the gate before building, so a red test suite blocks
the deploy even on a direct push — not just on PRs.

## Local commands

```bash
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm test            # vitest (watch mode)
npm run test:run    # vitest (single run — what CI runs)
npm run build       # next build
npm run build:cf    # opennextjs-cloudflare build
npm run deploy      # opennextjs-cloudflare deploy (deploys a built app)
```

Run `npm run lint && npm run typecheck && npm run test:run` before pushing to
reproduce the CI gate locally.

## One-time setup

### 1. Cloudflare API token + account ID

- **Account ID**: Cloudflare dashboard → Workers & Pages → right sidebar (or run
  `npx wrangler whoami`).
- **API token**: dashboard → My Profile → **API Tokens** → **Create Token** →
  use the **"Edit Cloudflare Workers"** template. Scope it to this account. Copy
  the token value (shown once).

### 2. GitHub repository secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**.
Add:

| Secret | Used by | Notes |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | deploy | From step 1. |
| `CLOUDFLARE_ACCOUNT_ID` | deploy | From step 1. |
| `NEXT_PUBLIC_SUPABASE_URL` | ci + deploy build | Inlined at build time. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ci + deploy build | Inlined at build time. |
| `NEXT_PUBLIC_SITE_URL` | ci + deploy build | Inlined at build time. |
| `NEXT_PUBLIC_KLAVIYO_COMPANY_ID` | ci + deploy build | Inlined at build time. |
| `NEXT_PUBLIC_FB_PIXEL_ID` | ci + deploy build | Inlined at build time. |
| `NEXT_PUBLIC_GA_ID` | ci + deploy build | Inlined at build time. |

Copy the `NEXT_PUBLIC_*` values from your local `.env` / `.env.local`.

> **Runtime secrets are NOT set here.** `RESEND_*`, `PAYFAST_*`,
> `KLAVIYO_API_KEY`, `META_CAPI_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`,
> `ADMIN_FULFILMENT_KEY`, `MERCHANT_NOTIFICATION_EMAIL`, etc. are read at request
> time inside the Worker. They live on the Worker as Cloudflare secrets and
> persist across deploys — set them once with `npx wrangler secret put <NAME>`
> (or in the dashboard). The pipeline does not touch them.

### 3. Branch protection on `main`

Repo → **Settings → Branches → Add branch ruleset** (or classic branch
protection) for `main`:

- ✅ Require a pull request before merging.
- ✅ Require status checks to pass → select the **CI / Lint, typecheck, test,
  build** check.
- ✅ Require branches to be up to date before merging (recommended).

This is what makes "passes the test suite before it can reach `main`" enforced
rather than optional.

## Adding tests

Tests live next to the code as `*.test.ts` under `src/` and run in a Node
environment (see [`vitest.config.ts`](../vitest.config.ts)). The starter suite
covers the pure, high-value logic: PayFast signatures, discount math, shipping
cost, email canonicalisation, and the open-redirect guard.

To extend coverage:

- **More unit tests** — keep testing pure functions in `src/lib`. Fast, no infra.
- **Component/DOM tests** — add `@testing-library/react` + `jsdom` and set
  `environment: "jsdom"` (per-file via a `// @vitest-environment jsdom` comment,
  or globally in the config).
- **End-to-end** — add Playwright as a separate workflow/job that runs against a
  preview deploy (`npm run preview`) for full checkout-flow coverage.

## Alternative: Cloudflare Workers Builds

Cloudflare can also build/deploy directly from the connected GitHub repo
(dashboard → Workers & Pages → the Worker → **Builds**). It's simpler but its
test-gating is weaker, so we use GitHub Actions to keep the "tests gate the
deploy" guarantee. If you ever switch, disable the GitHub Actions deploy to avoid
double deploys.
