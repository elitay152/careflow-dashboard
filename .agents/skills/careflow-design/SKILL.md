---
name: careflow-design
description: Refine or critique Careflow dashboard pages, charts, responsive layouts, and interactions while preserving its visual identity, truthful data presentation, accessibility, and static-site security boundaries. Use for frontend design work or a Careflow visual review, not backend pipelines, model tuning, or a general security audit.
---

# Careflow design

Help Eli Taylor present a personal, credible healthcare data engineering portfolio.
Favor clear evidence, readable charts, and intentional composition. Preserve the
established green/teal palette, clean layout, and personal voice. A design skill
supplies judgment; it does not require new libraries or a new visual framework.

## Read the project first

- Read the repository README and relevant component, styles, data contract, and tests.
- For trust boundaries, read `docs/security-audit.md`. Inspect existing screenshots
  as context, and the current render when evaluating appearance.
- Identify the page's audience, primary question, and existing behavior. Recruiters
  should find Eli's contribution quickly; technical readers should find evidence.
- Extract actual color roles, typography, spacing, and component conventions from
  the code. Existing fonts, cards, or rounded corners are not inherently bad.

## Choose the smallest useful change

Default to **refine**: improve a bounded page or component within the current system.
Use **extend** for a new element that should match it. Use **redesign** only when
requested. Do not expand a one-page request into a site-wide rewrite.

State a short working brief in the progress update: goal, mode, what to preserve,
and the few changes most likely to help. Use known preferences and make routine
choices autonomously. Ask for missing preferences only when they materially change
the result; do not add mandatory approval checkpoints or a long questionnaire.
Do not create extra design reports, versioned mockup copies, or brand documents
unless requested. For larger changes, show a concrete early render before polishing.

## Preserve these contracts

- Keep existing routes, anchors, navigation, data contracts, filters, citations,
  keyboard behavior, and working interactions unless the requested scope changes them.
- Retain Eli's supplied bio and experience; never invent credentials or achievements.
- Label synthetic patient histories, provider reference data, and observed public
  flu data distinctly. The website displays exported aggregates, not live PostgreSQL.
- Keep metric units, denominators, cohorts, horizons, baselines, missing values,
  model-selection rules, evaluation caveats, and publication gates intact.
- Never invent results, timestamps, monitoring activity, testimonials, or patient data.
  Keep evidence and important limitations discoverable; do not hide them for polish.
- Backend ingestion, metric definitions, model fitting, and evaluation belong in
  Careflow. Do not change their meaning through frontend presentation work.

## Design and implement

1. Repair hierarchy, legibility, alignment, spacing, and mobile behavior first.
2. Reduce competing emphasis and repeated decoration. Make primary findings easy
   to scan, with supporting methodology available through progressive disclosure.
3. Use semantic color consistently. Add categories only when they encode a real
   distinction; do not depend on color alone. Preserve the existing palette's roles.
4. Keep personality grounded in Eli's story and the project's actual work. Avoid
   stock AI imagery, ornamental dashboards, and motion that competes with reading.
5. Use the existing React/TypeScript/Vite stack, CSS, and Lucide icons. Reuse
   components and tokens where practical. Do not introduce a framework migration,
   chart-library replacement, dark mode, or dependency without a task-driven need.
6. Keep assets local and respect the CSP and release allowlist. No CDN scripts,
   remote fonts, trackers, browser credentials, or live model calls. Do not loosen
   security settings to accommodate a visual effect.
7. Use semantic HTML, visible focus, labeled controls, accessible alternatives,
   and reduced-motion behavior for any new animation.

Load only the reference relevant to the task:

- [Page critique](references/page-critique.md): hierarchy, density, and usability.
- [Chart design](references/chart-design.md): data encoding and exploration.
- [Verification](references/verification.md): checks and visual inspection.

Follow verification before reporting completion. Summarize the visible improvement,
checks performed, and any remaining limitation without inventing usability results.

## Attribution

Adapted from selected Garden Skills and Designer Skills material; project-specific
rules take precedence over upstream prototype conventions. See [LICENSES.md](LICENSES.md)
for exact source revisions, adapted areas, and the full MIT notices. Do not load or
apply the rest of either upstream collection automatically.
