import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { validateReadmission } from "../scripts/validate-readmission.mjs";
import { syncReadmission } from "../scripts/sync-readmission.mjs";
const current = JSON.parse(
  await readFile(
    new URL("../public/data/readmission.json", import.meta.url),
    "utf8",
  ),
);
const pending = {
  schema_version: 1,
  status: "not_run",
  dataset_kind: "observed_public_aggregate",
  generated_at: null,
  protocol: current.protocol,
  protocol_sha256: current.protocol_sha256,
  reason:
    "Awaiting the first successful UCI API fetch and patient-grouped benchmark. No real-data model results are claimed.",
};
test("current published readmission artifact obeys its status contract", () =>
  assert.equal(validateReadmission(current), current));
// Entirely artificial aggregate fixture for contract tests; never publish as UCI results.
function completedFixture() {
  const metrics = () => ({
    n: 150,
    positives: 15,
    prevalence: 0.1,
    average_precision: 0.1,
    roc_auc: 0.5,
    brier: 0.09,
    calibration: Array.from({ length: 10 }, (_, i) => ({
      lower: i / 10,
      upper: (i + 1) / 10,
      n: i === 1 ? 150 : 0,
      positives: i === 1 ? 15 : 0,
      mean_probability: i === 1 ? 0.1 : null,
      observed_rate: i === 1 ? 0.1 : null,
    })),
    review: [0.1, 0.2].map((capacity) => {
      const reviewed = Math.ceil(150 * capacity),
        captured = Math.floor(reviewed / 10);
      return {
        capacity,
        reviewed,
        captured,
        precision: captured / reviewed,
        recall: captured / 15,
      };
    }),
  });
  return {
    schema_version: 1,
    status: "completed",
    dataset_kind: "observed_public_aggregate",
    generated_at: "2026-10-24T00:00:00+00:00",
    protocol: pending.protocol,
    protocol_sha256: pending.protocol_sha256,
    source: {
      dataset_id: 296,
      name: "Diabetes 130-US Hospitals for Years 1999–2008",
      api_url: "https://archive.ics.uci.edu/api/dataset?id=296",
      data_url: "https://archive.ics.uci.edu/static/public/296/data.csv",
      page_url:
        "https://archive.ics.uci.edu/dataset/296/diabetes+130-us+hospitals+for+years+1999-2008",
      license_url: "https://creativecommons.org/licenses/by/4.0/",
      license_evidence:
        "CC BY 4.0 link checked on the official dataset page at retrieval",
      attribution:
        "Artificial fixture for contract tests only; never a published evaluation.",
      csv_sha256: "a".repeat(64),
      metadata_sha256: "b".repeat(64),
      license_page_sha256: "c".repeat(64),
      source_pinned: false,
    },
    software: { scikit_learn: "1.9.1" },
    quality: {
      source_rows: 101766,
      source_patients: 1000,
      eligible_encounters: 1000,
      eligible_patients: 1000,
      excluded_encounters: 100766,
      excluded_by_disposition: {
        11: 100766,
        13: 0,
        14: 0,
        19: 0,
        20: 0,
        21: 0,
      },
      source_labels: { "<30": 10000, ">30": 30000, NO: 61766 },
      duplicate_encounters: 0,
    },
    evaluation: {
      selected_model: "prevalence",
      patient_overlap: 0,
      splits: [
        { split: "train", encounters: 700, patients: 700, positives: 70 },
        { split: "validation", encounters: 150, patients: 150, positives: 15 },
        { split: "test", encounters: 150, patients: 150, positives: 15 },
      ],
      models: pending.protocol.models.map((model) => ({
        model,
        validation: metrics(),
        test: metrics(),
      })),
    },
    limitations: Array.from(
      { length: 6 },
      (_, i) => `Synthetic test limitation ${i}`,
    ),
  };
}
test("pending and completed readmission contracts are distinct and valid", () => {
  assert.equal(validateReadmission(pending), pending);
  assert.equal(validateReadmission(completedFixture()).status, "completed");
});
for (const [name, mutate] of [
  [
    "patient fields",
    (d) => {
      d.patient_rows = [];
    },
  ],
  [
    "private model fields",
    (d) => {
      d.evaluation.models[0].probabilities = [];
    },
  ],
  [
    "credential-bearing source URL",
    (d) => {
      d.source.data_url = "https://example.com?key=private";
    },
  ],
  [
    "changed protocol",
    (d) => {
      d.protocol.boosting.max_iter = 1000;
    },
  ],
  [
    "source row mismatch",
    (d) => {
      d.quality.source_rows--;
    },
  ],
  [
    "patient overlap",
    (d) => {
      d.evaluation.patient_overlap = 1;
    },
  ],
  [
    "invalid exclusion total",
    (d) => {
      d.quality.excluded_encounters--;
    },
  ],
  [
    "test-driven winner",
    (d) => {
      d.evaluation.selected_model = "boosting";
    },
  ],
  [
    "invalid probability",
    (d) => {
      d.evaluation.models[0].test.brier = NaN;
    },
  ],
  [
    "forged calibration rate",
    (d) => {
      d.evaluation.models[0].test.calibration[1].observed_rate = 0.9;
    },
  ],
  [
    "wrong reviewed count",
    (d) => {
      d.evaluation.models[0].test.review[0].reviewed = 100;
    },
  ],
  [
    "forged precision",
    (d) => {
      d.evaluation.models[0].test.review[0].precision = 1;
    },
  ],
  [
    "incorrect baseline AP",
    (d) => {
      d.evaluation.models[0].test.average_precision = 0.9;
    },
  ],
  [
    "missing model",
    (d) => {
      d.evaluation.models.pop();
    },
  ],
  [
    "unknown software",
    (d) => {
      d.software.patient_ids = [];
    },
  ],
  [
    "fabricated pending score",
    (d) => {
      d.status = "not_run";
    },
  ],
])
  test(`readmission rejects ${name}`, () => {
    const d = structuredClone(completedFixture());
    mutate(d);
    assert.throws(() => validateReadmission(d));
  });
test("pending state cannot claim a timestamp or results", () => {
  for (const key of ["generated_at", "evaluation"]) {
    const d = structuredClone(pending);
    d[key] = key === "generated_at" ? "2026-10-24T00:00:00+00:00" : {};
    assert.throws(() => validateReadmission(d));
  }
});
test("refresh atomically accepts only completed bounded evidence", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "careflow-readmission-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, "source.json"),
    destination = join(root, "destination.json");
  await writeFile(destination, "previous evidence");
  for (const bytes of [
    JSON.stringify(pending),
    JSON.stringify({ ...completedFixture(), patient_rows: [] }),
    "x".repeat(256 * 1024 + 1),
  ]) {
    await writeFile(source, bytes);
    await assert.rejects(syncReadmission(source, destination));
    assert.equal(await readFile(destination, "utf8"), "previous evidence");
  }
  const bytes = JSON.stringify(completedFixture());
  await writeFile(source, bytes);
  await syncReadmission(source, destination);
  assert.equal(await readFile(destination, "utf8"), bytes);
});
