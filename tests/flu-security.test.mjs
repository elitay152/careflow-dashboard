import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { validateFlu, readFluSnapshot } from "../scripts/validate-flu.mjs";
import { syncData } from "../scripts/sync-data.mjs";
const snapshot = JSON.parse(
  await readFile(
    new URL("../public/data/flusight.json", import.meta.url),
    "utf8",
  ),
);
test("public flu evidence has reproducible source, arithmetic and publication checks", () =>
  assert.equal(validateFlu(snapshot), snapshot));
const mutations = [
  [
    "interval calibration moved into holdout",
    (d) => {
      d.evaluation.intervals.protocol.calibration_end = "2025-07-05";
    },
  ],
  [
    "forged interval protocol checksum",
    (d) => {
      d.evaluation.intervals.protocol_sha256 = "0".repeat(64);
    },
  ],
  [
    "retuned interval radius",
    (d) => {
      d.evaluation.intervals.by_horizon[0].models[0].bands[0].radius += 1;
    },
  ],
  [
    "fabricated interval coverage",
    (d) => {
      d.evaluation.intervals.by_horizon[0].models[0].bands[0].metrics.coverage = 1;
    },
  ],
  [
    "fabricated interval width",
    (d) => {
      d.evaluation.intervals.by_horizon[0].models[0].bands[0].metrics.mean_width = 0;
    },
  ],
  [
    "forged peak-period interval score",
    (d) => {
      d.evaluation.intervals.by_horizon[0].models[0].bands[0].by_phase[1].mean_interval_score = 0;
    },
  ],
  [
    "private interval fields",
    (d) => {
      d.evaluation.intervals.by_horizon[0].patient_rows = [];
    },
  ],
  [
    "fabricated interval calibration count",
    (d) => {
      d.evaluation.intervals.by_horizon[0].calibration_n = 105;
    },
  ],

  [
    "forged peak timing",
    (d) => {
      d.evaluation.holdout.peak_diagnostics.by_horizon[0].models[0].peak.lag_weeks += 1;
    },
  ],
  [
    "forged peak error shares",
    (d) => {
      d.evaluation.holdout.peak_diagnostics.by_horizon[0].models[0].phases[0].error_share = 0;
    },
  ],
  [
    "redefined peak window",
    (d) => {
      d.evaluation.holdout.peak_diagnostics.peak_window.start = "2025-07-05";
    },
  ],
  [
    "hidden fields in peak analysis",
    (d) => {
      d.evaluation.holdout.peak_diagnostics.patient_rows = [];
    },
  ],

  [
    "patient rows",
    (d) => {
      d.patient_rows = [{ patient_id: "audit-sentinel" }];
    },
  ],
  [
    "private fields inside observations",
    (d) => {
      d.history[0].patient_id = "audit-sentinel";
    },
  ],
  [
    "synthetic-data labeling",
    (d) => {
      d.dataset_kind = "synthetic";
    },
  ],
  [
    "credential-bearing source links",
    (d) => {
      d.source.data_url = "https://example.invalid/audit-sentinel";
    },
  ],
  [
    "undocumented protocol fields",
    (d) => {
      d.protocol.raw_rows = [];
    },
  ],
  [
    "retuned model settings",
    (d) => {
      d.protocol.ridge_alpha = 1;
    },
  ],
  [
    "altered source revision",
    (d) => {
      d.source.revision = "0".repeat(40);
    },
  ],
  [
    "missing national data",
    (d) => {
      d.source.quality.national_missing_values = 1;
    },
  ],
  [
    "changed observations",
    (d) => {
      d.history[0].count += 1;
    },
  ],
  [
    "fabricated validation scores",
    (d) => {
      d.evaluation.validation.metrics[0].mae = 0;
    },
  ],
  [
    "invented holdout outcomes",
    (d) => {
      d.evaluation.holdout.predictions[0].actual += 1;
    },
  ],
  [
    "incomplete holdout",
    (d) => {
      d.evaluation.holdout.predictions.pop();
    },
  ],
  [
    "invalid forecast horizon",
    (d) => {
      d.evaluation.holdout.predictions[0].horizon = 5;
    },
  ],
  [
    "test-driven model selection",
    (d) => {
      d.evaluation.selected_model =
        d.evaluation.selected_model === "last_value"
          ? "seasonal_naive"
          : "last_value";
    },
  ],
  [
    "publication gate bypass",
    (d) => {
      d.evaluation.publication.status = "research_projection";
      d.evaluation.forecast = [
        { week: "2026-10-24", horizon: 1, prediction: 100 },
      ];
    },
  ],
  [
    "nonfinite scores",
    (d) => {
      d.evaluation.holdout.metrics[0].mae = Infinity;
    },
  ],
  [
    "impossible verification date",
    (d) => {
      d.source.verified_at = "2026-02-30T00:00:00Z";
    },
  ],
];
for (const [name, mutate] of mutations)
  test(`public flu rejects ${name}`, () => {
    const candidate = structuredClone(snapshot);
    mutate(candidate);
    assert.throws(() => validateFlu(candidate), /Invalid public flu contract/);
  });
test("invalid and oversized flu inputs cannot replace existing evidence", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "careflow-flu-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, "source.json"),
    target = join(root, "target.json");
  await writeFile(target, "preserved");
  const bad = structuredClone(snapshot);
  bad.history[0].patient_id = "audit-sentinel";
  await writeFile(source, JSON.stringify(bad));
  await assert.rejects(
    syncData(source, target, readFluSnapshot),
    /Invalid public flu contract/,
  );
  assert.equal(await readFile(target, "utf8"), "preserved");
  await writeFile(source, Buffer.alloc(512 * 1024 + 1));
  await assert.rejects(syncData(source, target, readFluSnapshot), /file.size/);
  assert.equal(await readFile(target, "utf8"), "preserved");
  await writeFile(source, JSON.stringify(snapshot));
  await syncData(source, target, readFluSnapshot);
  assert.deepEqual(await readFile(target), await readFile(source));
});
