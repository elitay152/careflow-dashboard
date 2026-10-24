# Careflow dashboard

A React/TypeScript portfolio website for the
[Careflow healthcare data platform](https://github.com/elitay152/Careflow).
It renders aggregate synthetic data exported from PostgreSQL and a separate
public-data forecasting and readmission studies. The public browser
has no database connection, model credentials, or live agent endpoint.

**Website:** https://elitay152.github.io/careflow-dashboard/

Start with the overview’s four-stop tour: source → pipeline evidence → analytics
→ forecasting. See the [three-minute walkthrough and reproducible pipeline demo](https://github.com/elitay152/Careflow/blob/main/docs/demo.md).

![Analytics](docs/screenshots/analytics-desktop.png)

## Run

Requires Node 24 and npm. The committed snapshot runs without a backend:

```bash
npm ci
npm run dev
```

`npm run build` validates the snapshot, checks release files, and builds `dist/`.
`npm run preview` serves that build locally. Hash navigation and relative assets
support the GitHub Pages repository path.

## Pages

| Page | Contents |
| --- | --- |
| Overview | Eli Taylor’s background, a four-stop project tour, current cohort counts, and dbt evidence. |
| Simulated cohort | Aggregate inventory of six persisted FHIR resource types, including selected clinical Observations and provider organizations. |
| Analytics | Latest-12-month KPIs, monthly/annual trends, duration statistics, clinical/contextual groups, and medication request statuses. |
| Analytics agent | Three cited baseline answers replayed from the export; other inputs are declined. |
| Forecasting | Observed U.S. influenza admissions and a frozen holdout benchmark, plus separate synthetic facility/ZIP histories and capacity experiments. |
| Readmission risk | UCI discharge-time readmission benchmark, plus a separate synthetic 90-day inpatient experiment. |
| Pipeline health | Source-load, build, and export timestamps, quality checks, quarantines, and downloadable evidence. |

The synthetic snapshot contains 1,194 synthetic patients and a reference catalog of 852
provider organizations. Provider names are reference data; patient histories and
facility assignments are simulated. Metrics describe recorded
simulation data, not real healthcare demand or historical population rates.
[Definitions and forecast protocol](https://github.com/elitay152/Careflow/blob/main/docs/metrics.md)
live in Careflow, alongside the calculations.

The appointment scenario replays the latest 12 calendar months with observations.
Sessions, hours, appointment length, bookable time, and demand change are editable
assumptions. Whole slots are rounded down per clinician session; scenario visits
are rounded up, and monthly shortfalls do not carry forward. It runs locally over
exported counts without forecasting future demand or estimating real staffing.
The steady/increasing/decreasing examples use recorded histories, not model scores.
`npm test` checks the arithmetic and focused component rendering before running
the browser suite.

## Refresh from PostgreSQL

With both repos side by side and the backend's local PostgreSQL running:

```bash
npm run data:refresh -- --confirm-synthetic
```

This rebuilds/tests dbt, exports aggregates, validates and atomically copies the
snapshot, and builds the site. Defaults: `../Careflow`, raw schema
`synthea_p1000_seed43`, analytics schema `synthea_p1000_seed43_analytics`, seed-43
label. For a different cohort:

```bash
npm run data:refresh -- --confirm-synthetic \
  --backend-root /path/to/Careflow \
  --raw-schema my_cohort --analytics-schema my_cohort_analytics \
  --label "My synthetic cohort"
```

Credentials stay in the backend's `.env` or environment. Stop other loaders/dbt
jobs during refresh. The command reads existing data; it does not ingest,
schedule, or publish. Review the snapshot change and merge it to `main` for Pages
deployment. A browser reload alone does not refresh PostgreSQL data.

For an existing export, use `npm run data:sync -- /path/to/careflow.json`, then
`npm run build`. The site requires contract version 8. Analytics includes an aggregate cohort explorer with combined demographic, clinical-profile, and encounter-frequency filters; these filters apply only to the explorer. Only reviewed aggregate
JSON belongs in `public/data/`; keep raw files, ledgers, keys, and dumps outside it.

## Small reproducible demo

The [backend demo guide](https://github.com/elitay152/Careflow/blob/main/docs/demo.md)
contains the short walkthrough and `bash scripts/portfolio_demo.sh` command.
It generates three fictional patients, verifies quarantine and duplicate-safe reruns,
builds/tests dbt in fresh PostgreSQL schemas, and exports local aggregate evidence.
It does not replace this repository's committed snapshots. To view the website
without PostgreSQL, use `npm ci`, `npm run build`, and `npm run preview` above.

## Checks and hosting

```bash
npm ci
npm audit
npm run test:security
npm run build
npx playwright install chromium
npm test
npm run test:pages
```

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` to use an installed
browser. Tests cover desktop/mobile pages, keyboard controls, accessibility,
evidence integrity, CSP, and the real Pages subpath. Run logs and traces stay local.

- [GitHub Pages deployment](docs/deployment.md)
- [Security boundaries](docs/security-audit.md)

## Public influenza forecasting

The default forecasting view uses observed CDC/NHSN FluSight national admissions,
not the Synthea cohort. Its separate `public/data/flusight.json` contract contains
weekly aggregate observations, fixed-protocol evaluation, provenance, and the
full source repository MIT notice. The synthetic `careflow.json` contract and its
`synthetic_only` declaration apply only to the synthetic cohort.

```bash
npm run flu:refresh
# Reuse the pinned local source without a download:
npm run flu:refresh -- --offline
```

The backend checkout and its Python environment must be available alongside this
repo (or pass `--backend-root PATH`). Refresh validates the pinned source, runs
the benchmark, atomically copies the aggregate artifact, and builds the website.
It needs no database or model credentials. Deployment follows the usual review
and Pages workflow; reloading the browser does not fetch new observations. The
source revision and evaluation settings remain fixed until explicitly revised.

The validation-selected seasonal autoregression loses to persistence on the
reserved 2025/26 season, so future projections are withheld. The page exposes
observed counts, held-out predictions by horizon, and all four candidates. A
shaded peak window and interactive error breakdown show MAE, signed error, error
shares, and peak timing for the chosen model and horizon. These diagnostics are
retrospective and preserve the frozen evaluation and publication decision. The
80%/95% prediction-band control adds fixed earlier-season residual ranges and
reports achieved coverage, width, and misses. These nominal levels are not
guaranteed; interval calibration stops before the first holdout forecast origin
and never updates from holdout outcomes. This
retrospective revised-data evaluation assumes week-end availability; it does not
replay release delays or establish real-time planning performance. See the
[backend protocol and attribution](https://github.com/elitay152/Careflow/blob/main/docs/flusight.md).

## Project design skill

The repository-local [`careflow-design`](.agents/skills/careflow-design/SKILL.md)
skill guides frontend refinements and critiques. In a coding assistant that supports
repository-local `.agents/skills`, invoke it explicitly, for example:

```text
Use $careflow-design to improve chart readability on Analytics while preserving
the current palette, metric definitions, filters, and security boundaries.
```

It contains focused references for chart design, page critique, and verification,
plus upstream MIT notices and source revisions. It is explicitly invoked, adds no
application dependencies, and is not part of the public website build. Sessions
that discover skills only at startup may need to be reopened after checkout.

## UCI readmission deployment

Main-branch deployments fetch UCI dataset 296 through its metadata API, run the
fixed patient-grouped benchmark from a pinned Careflow commit, and atomically sync
only `public/data/readmission.json` before build and browser checks. The study is
separate from synthetic `careflow.json` and observed flu `flusight.json`.

PRs stay offline and use an explicit `not_run` snapshot; no fabricated real-data
scores are committed. On main, a failed fetch, source/license check, evaluation, or
contract check blocks deployment and retains the previous live site. Raw records
and fitted models are never uploaded. No API key, PostgreSQL, or paid model is needed.
The first real-data result is pending a successful Actions run.

The source CSV hash is recorded in each build. After reviewing a successful run,
set the Actions repository variable `UCI_READMISSION_SHA256` to that CSV hash to
require identical input on subsequent deployments. Each main deployment fetches
and trains again; there are no scheduled refreshes or automatic retries. Run the
existing website workflow manually to retry after an upstream failure.

For local refresh with an accessible UCI endpoint, run the backend command
`.venv/bin/python -m careflow.uci_readmission --download`, then in this repo
`npm run readmission:sync -- /path/to/Careflow/data/public/readmission.json` and
`npm run build`. The sync refuses pending evidence and leaves the prior file intact
on validation failure. See the [backend protocol](https://github.com/elitay152/Careflow/blob/main/docs/readmission.md).
