# Website security audit — October 20, 2026

The merged static website was reviewed at commit `d666a8b`. No real provider
credential was identified in the available Git history, and npm reported no
known dependency advisories. The review found gaps in incoming snapshot
validation and release-file controls; those are fixed on this review branch.
No paid model calls or deployment were performed.

## Scope

Reviewed React rendering, forms and navigation; snapshot import and download;
copy/build scripts; Vite configuration; CSP; dependency manifests and lockfile;
Git history; and GitHub Actions. Exercised a production build in Chromium on
desktop and mobile. [Machine-readable evidence](security-evidence.json) records
versions, scan scope and check counts.

This is a source/build audit of a synthetic-data portfolio. It does not certify
an eventual hosting configuration, real-patient-data compliance, or arbitrary
future exports. The backend audit remains a separate assessment.

## Findings and fixes

| Finding | Exposure and evidence | Correction |
| --- | --- | --- |
| Incomplete recursive snapshot validation | Medium defense gap at the imported-data boundary. The original check accepted an object containing `patient_id` inside a clinical label, nested private content inside answer fields, and arbitrary identifier keys in resource inventory. The shipped snapshot did not contain these payloads; Careflow's existing exporter emits the expected primitive fields. | Validate every allowed field's type, structure and limits, including text, dates, arrays, codes and numeric aggregates. Resource inventory accepts only known FHIR type names. Unexpected private fields and nested structures fail before copy/build. |
| Arbitrary evidence destinations and inconsistent success metadata | Low-to-medium data-integrity/social-engineering risk, requiring a changed input export. Reproduced acceptance of an attacker-owned HTTPS evidence URL and a `passed` build with zero passed checks. No credential prompt or XSS exploit was found in the actual site. | Pin the version-1 archive link to the official evidence file. Reject unsupported modes/metrics, mismatched citations, inconsistent success counts, invalid dates, stale build timestamps, duplicate replay questions and fabricated forecast results. These are contract checks, not cryptographic source authentication. |
| Public-directory contents were copied without a release allowlist | Medium accidental-publication risk. In an isolated fixture, Vite copied a hidden `.env` containing a fake sentinel into `dist/`. This was a reproduction of default build behavior, not a credential found in the repository or release. Git ignores alone would not prevent that copy. | Check `public/` before bundling and `dist/` afterward. Permit only the reviewed favicon, aggregate JSON, built HTML and expected JS/CSS assets. Reject extra files/directories, source maps, non-files and symlinks. Verify the downloadable JSON is byte-identical to the validated input. |
| Sync re-read input after validation and overwrote output directly | Low local build-integrity risk. The old script validated one read, then called `copyFile`, allowing changed input or an interrupted copy to bypass the intended guarantee. No hostile filesystem writer was observed. | Read once with a 5 MiB bound and strict UTF-8 decoding, validate those bytes, then atomically rename a staged file into place. Invalid input preserves the prior snapshot. A source read is bounded even if the file grows during the read. |
| CSP and CI checks could be more explicit | Hardening; no exploit found in shipped UI. | Disallow base elements, child frames and workers in the meta CSP. Add regression tests for blocked inline script and off-origin connections, inert hostile form input and no browser storage writes. CI now also runs Node security tests and a tracked-file secret scanner. |

The contract intentionally supports the current version-1 project: 10 models,
32 quality checks, the documented archive, three baseline replays and no
forecast results. A changed metric catalog or source contract requires review
and corresponding validation updates. Validation does not recompute the
warehouse metrics; that logic remains in Careflow.

## Verified boundaries

- React renders labels, answers and citations as text. There is no
  `dangerouslySetInnerHTML`, raw HTML insertion, user-controlled script loader,
  database driver or live agent endpoint in the frontend.
- Agent input selects only an exported baseline example. Unsupported text is
  declined; it does not construct SQL, call a model or access a usage ledger.
  Hostile form text remained inert in Chromium. No model API keys are needed.
- The production browser used same-origin assets only. Explicit CSP tests
  blocked inline script and off-origin fetch; the browser issued no outbound
  request for the blocked destination. External links use HTTPS GitHub project
  URLs with `noopener noreferrer`. The clinical terminology URI is rendered as
  text, not fetched.
- Forms do not submit to a backend; meta CSP disables native form submissions.
  No localStorage/sessionStorage entries were written during tested agent use.
  The site includes no analytics tracker or third-party font download.
- The current export contains aggregates and pipeline metadata, not patient
  identifiers, raw FHIR payloads or database credentials. Source-load, build and
  export timestamps remain distinct. Archived Synthea results are separate
  from the hand-authored demo. Forecasting stays explicitly unevaluated.
- Runtime packages are version-pinned and `npm ci` uses the committed lockfile
  with integrity verification. No TLS or checksum verification was disabled.
  npm audit reported zero known advisories, including development dependencies.
- Workflow actions are pinned to commit SHAs, repository permissions are
  `contents: read`, checkout does not persist credentials, and the job has a
  15-minute timeout. There is no privileged `pull_request_target`, automatic
  deployment, provider secret binding, or paid-evaluation step.

## Secret review

Scanned three available commits and 23 unique blobs using detect-secrets 1.5.0
with provider verification disabled. The history scan produced 73 high-entropy
candidates; every candidate was an npm SHA-512 integrity field in
`package-lock.json`, confirmed by its field and line. No real credential was
identified. Existing portfolio screenshots were visually inspected; the scanner
does not perform OCR. Deleted/unavailable remote refs and old hosted artifacts
were outside the review.

The tracked-file CI baseline explicitly enables scanning of lockfiles rather
than exempting them. It records only the exact reviewed integrity hashes as
non-secrets and excludes its own generated baseline file. A deliberately fake
URL userinfo value in the rejection test has a targeted inline allowlist comment.
There is no general exemption for source, test, data or lock files. New candidates
require investigation; never add an actual key to the baseline to pass CI.
In a temporary Git fixture, the reviewed lockfile passed and an added fake
credential-bearing URL was blocked, confirming that lockfile detection is active.

## Validation

- **27 Node security tests passed:** reject malformed/private data, unsafe links,
  invalid evidence and modes, unexpected release files, source maps, symlinks,
  substituted downloads and oversized inputs; test atomic and repeatable sync.
- **26 Chromium desktop/mobile checks passed**, including the existing page,
  interaction and evidence tests plus CSP and hostile-input checks.
- All **12 page/viewport axe scans** passed their selected WCAG A/AA rules.
  Automated checks are not a complete accessibility assessment.
- Production TypeScript/Vite build and public/release allowlists passed. npm
  audit reported **zero known advisories**. The committed snapshot was unchanged.

Repeat the JavaScript checks with Node 24:

```bash
npm ci
npm audit
npm run test:security
npm run build
npx playwright install chromium
npm test
# Or use an existing compatible Chromium:
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test
```

For the exact tracked-file secret check, follow the pinned-tool commands in
`.github/workflows/checks.yml`. No model credential or backend is required.

## Remaining limits

- A boolean `synthetic_only` and schema validation cannot prove that every text
  value is synthetic or de-identified. Use Careflow's synthetic-only export
  workflow and review the JSON before publishing. Public repository history and
  public assets are permanently observable; rotate any real leaked credential.
- Data authors and repository maintainers remain trusted. These guards are not
  a sandbox for untrusted PR code or a cryptographic attestation of measurements.
  Keep branch protection and review requirements appropriate to your account;
  those GitHub settings could not be inspected here.
- No deployed origin was supplied or verified. The meta CSP does not establish
  TLS, cache rules, `X-Content-Type-Options`, or framing protection. In particular,
  `frame-src 'none'` prevents this page creating frames; it does not prevent
  someone framing this site. A host must supply a `frame-ancestors` CSP response
  header or `X-Frame-Options` for that protection. Meta CSP deliberately retains
  inline styles because React charts use style attributes; inline scripts are
  blocked. It permits same-origin connections for development compatibility.
- Vite preview is a local validation server, not a production hosting assessment.
  Dev/preview still bind to loopback. Publishing static files does not justify
  exposing FastAPI, Dagster, PostgreSQL or Codespaces service ports.
- npm advisories are point-in-time package data. Native binaries, the operating
  system, browser implementation, and unknown vulnerabilities are not covered.
  Vite's existing Lucide `use client` bundling notices are not test failures; this
  is a client-rendered site with no React Server Components boundary.
- GitHub Actions API access still returned Forbidden. Local checks passed;
  hosted workflow results and the new CI secret check must be verified on GitHub.
