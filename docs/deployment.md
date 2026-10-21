# GitHub Pages deployment

The site is published at https://elitay152.github.io/careflow-dashboard/.
GitHub Pages serves the validated static `dist/` build; no backend service or
database/model credential is deployed.

## Repository configuration

- **Settings → Pages → Source:** GitHub Actions.
- **Settings → Environments → github-pages:** allow deployments from `main` only.
- Protect `main` with PRs, required `website` checks, blocked force pushes, and
  restricted deletion. Deployment is not a required pre-merge check.

## Publish and refresh

Merge a reviewed website change to `main`. **Website checks and Pages deployment**
installs from the lockfile, scans advisories/secrets, validates the snapshot and
release files, builds, and runs browser tests at root and `/careflow-dashboard/`.
Only a passing main-branch run uploads and deploys the build. PR/feature-branch
runs skip upload/deployment intentionally. Manual dispatch on `main` redeploys.

To publish new database data, first run `npm run data:refresh -- --confirm-synthetic`
locally with the backend available, then review and merge the snapshot. The hosted
workflow does not connect to local PostgreSQL or generate a cohort.

The check job has read-only repository access. Only deployment receives
`pages: write` and `id-token: write` in the `github-pages` environment. Actions are
pinned; deployments serialize and skip superseded source commits. Only `dist/`
is uploaded, with one-day artifact retention.

## Verify or roll back

Check the deployment job's environment URL, six navigation pages, agent replay,
and evidence download. Confirm the displayed source/build/export timestamps.
To roll back, revert the website commit through a PR; the same workflow rebuilds
and deploys it. Website rollback does not involve the backend usage ledger.

Local checks are listed in the README. `scripts/serve-pages.mjs` tests the
repository subpath on loopback; it is not a production server. GitHub Pages does
not apply repository `_headers` files as custom HTTP response headers. See
[security boundaries](security-audit.md) for CSP and framing limitations.
