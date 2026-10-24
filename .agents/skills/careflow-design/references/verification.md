# Verification

Use existing project checks. Do not add a second test framework, call a paid model,
refresh a large dataset, or install unrelated tooling to verify a design change.

## Match checks to the change

| Change | Verification |
| --- | --- |
| Skill or documentation only | Check metadata, references, and licenses. Run the build/release check when verifying that files stay out of deployment; browser tests are unnecessary. |
| Component, layout, style, or interaction | Run `npm run build`, relevant existing Playwright checks on desktop and mobile, and inspect screenshots of the affected states. |
| Navigation, asset paths, export loading, or deployment assumptions | Include `npm run test:pages` for the GitHub Pages repository path. |
| Public export contract, input handling, or security-sensitive frontend behavior | Include `npm run test:security` and the relevant contract checks. Coordinate backend changes when required; do not silently edit scientific results. |

CI runs the full required suites. Locally, target meaningful checks and broaden
only when shared changes, failures, or unresolved risks justify it. Fix verified
regressions before completion. Report any blocked check and its actual reason.

## Executable and visual checks

- Use existing scripts and `playwright.config.ts` / `playwright.pages.config.ts`.
  Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` only when using an installed browser.
- Inspect desktop and mobile renders for readable text, clipping, overflow, useful
  ordering, and coherent spacing. Exercise new or changed controls and overlays.
- Check keyboard navigation, visible focus, labels, table access, and selected states.
  Inspect reduced-motion behavior if motion changes.
- Keep console/network checks, accessibility checks, and screenshot review distinct.
  Automated accessibility passes do not prove complete WCAG compliance.
- Preserve CSP, no external requests, the static-file allowlist, and matching
  validated source/built exports. Do not place skill files or reports in `public/`.
- Keep screenshots, traces, and run logs local by default. Update existing curated
  screenshots only when they represent a meaningful visible change; do not commit
  routine generated reports or new documentation for every iteration.

## Completion

Explain what visibly changed, why it helps, and which checks passed. Distinguish
local validation from CI and live deployment. Do not claim usability improvements
were measured without real research. Follow the user's existing branch/PR workflow;
implementation scope is not permission to merge or publish unrelated changes.
