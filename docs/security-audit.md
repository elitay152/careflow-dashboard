# Security boundaries

The website is a public, read-only view of aggregate synthetic data and a separate
public national influenza admissions series. Computation,
database access, model credentials, and spending controls belong in Careflow.

## Data and release controls

- Snapshot validation uses exact field allowlists, primitive types, numeric/date
  bounds, and fixed evidence destinations. Unexpected private fields fail.
- Forecast checks verify input hashes, split dates, score arithmetic, selection,
  and publication gating. Interval checks recompute earlier-season quantiles,
  radii, coverage, width, misses, and interval scores against the fixed calibration
  protocol. These establish consistency, not source authenticity.
- Sync validates one bounded UTF-8 read and atomically renames those bytes.
  Invalid data leaves the existing snapshot intact.
- Build allowlists reject unexpected files, symlinks, source maps, and mismatched
  downloadable JSON. Only reviewed static assets reach `dist/`.
- React renders text without raw HTML insertion. Agent input selects exported
  baseline examples; it does not construct SQL or make model calls.

The browser uses same-origin assets, no trackers or external fonts, and no
persistent storage. Meta CSP blocks inline scripts, off-origin connections,
forms, frames, objects, and workers. Inline styles support chart attributes.

## CI and hosting

CI runs dependency advisories, secret detection, data/build checks, security
regressions, and desktop/mobile browser tests. The secret baseline records exact
reviewed integrity/checksum values as false positives; source and lockfiles
remain scanned. Actions are pinned and checkout credentials are not persisted.
Only the main-branch deployment job receives Pages/OIDC write permissions.
See [deployment](deployment.md).

## Limits

Export authors and repository maintainers remain trusted. Schema validation and
`synthetic_only` cannot prove data is synthetic or de-identified; review source
and exports before publishing. The `synthetic_only` field applies to the synthetic cohort contract; public flu
observations use a separate pinned-source contract. No patient-level real data
is supported.

Meta CSP cannot set `frame-ancestors` or prove hosting response headers. GitHub
Pages does not support custom response headers via `_headers`. A public live
agent would require a separate authenticated backend and server-side budgets.
Keep FastAPI, Dagster, database ports, and development forwarding private.

Package scans are point-in-time advisory checks, not operating-system, unknown
vulnerability, or clinical compliance assessments. Automated accessibility tests
are not a complete accessibility review.
