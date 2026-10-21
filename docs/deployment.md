# Publish the static website with GitHub Pages

The deployment workflow publishes the validated `dist/` directory. It does not
start or expose FastAPI, Dagster, PostgreSQL, a Node server, or a model endpoint.
It needs no database/provider credentials, personal access token, Codex settings
or cloud-environment publication.

## One-time GitHub settings

Before merging the deployment PR:

1. In `elitay152/careflow-dashboard`, open **Settings → Pages**. Under
   **Build and deployment → Source**, choose **GitHub Actions**. Use the workflow
   in this PR rather than creating a second suggested deployment workflow.
2. In **Settings → Environments**, create or select **github-pages**. Under
   **Deployment branches and tags**, choose **Selected branches and tags** and
   allow the **main** branch only. This environment rule adds a GitHub-enforced
   boundary around the deployment job.
3. Merge the deployment PR after its checks pass. The push to `main` starts
   **Website checks and Pages deployment** automatically.

The normal project URL, once the first deployment succeeds, is:

`https://elitay152.github.io/careflow-dashboard/`

Use the URL reported by the deployment job or Settings → Pages if a custom
domain is configured. The workflow's environment link comes from GitHub's actual
deployment output, not a hardcoded success claim.

The onboarding workspace's GitHub API returns Forbidden, so these settings and
hosted deployment cannot be enabled or verified from that workspace. A saved
workflow or locally passing build does not mean the site is already published.

## Checks and permission boundaries

- Every push and pull request runs the existing frozen install, advisory scan,
  Node security tests, tracked-file secret scan, build and browser tests.
- The same 26 desktop/mobile browser checks also run against the real project
  path `/careflow-dashboard/`. Relative assets, hash navigation and downloadable
  JSON work without server rewrites. The path test server serves only reviewed
  build files and intentionally returns 404 outside the project path.
- The artifact allowlist is checked again immediately before upload. Only
  `dist/` is uploaded, with one-day artifact retention. Source, `.env`, databases,
  raw FHIR files, usage ledgers, test traces and screenshots are not included.
- Upload and deployment require `refs/heads/main` and exclude pull-request
  events. A manual **Run workflow** from `main` can redeploy a checked build;
  dispatching another branch runs checks without publishing it.
- The check/build job has read-only repository permissions. Only the deployment
  job receives `pages: write` and `id-token: write`, uses the `github-pages`
  environment, and waits for all checks. GitHub supplies its short-lived token.
  No secret is embedded in the website.
- Per-ref workflow concurrency lets an active run finish and queues the latest
  pending run. Pages deployments are also serialized. A final read-only Git
  check skips a source commit already superseded on `main`, so a delayed run
  cannot intentionally roll the site back to that older source.
- Checkout, Node/Python setup and Pages actions are pinned to full commit SHAs.
  There is no `workflow_run` download of an untrusted PR artifact, no
  `pull_request_target`, and no paid evaluation or synthetic-data generation.

The `actions/configure-pages` step checks the already enabled Pages setting. It
does not try to bypass repository permissions or enable Pages using a personal
credential. If the deployment says Pages is not configured, set the source above
and rerun the workflow on `main`.

## Local verification

```bash
npm ci
npm audit
npm run test:security
npm run build
npx playwright install chromium
npm test
npm run test:pages
```

For an existing Chromium binary, prefix either browser command with
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`.
`scripts/serve-pages.mjs` is an ephemeral, loopback-only test helper. GitHub Pages
serves the uploaded static files; it does not run this helper in production.

## Verify the published site

After the **Deploy the checked build** step reports success, open its environment URL and check all
six navigation items, a baseline replay, and the JSON evidence download. Check
the site on a phone-sized screen too. Verify HTTPS and the returned response
headers at the actual published origin; a local test server cannot attest them.

The existing audit's hosting limits still apply: the meta CSP restricts browser
behavior but cannot set a response `frame-ancestors` policy. GitHub Pages does
not apply a repository `_headers` file as custom response headers. This is a
public, read-only synthetic-data site; a future live agent requires a separate
authenticated backend and server-side spending controls.

To revert a bad release, revert the offending commit on `main`; the same checked
workflow rebuilds and deploys that source. Do not restore or reset the backend's
model-usage ledger as part of a website rollback.
