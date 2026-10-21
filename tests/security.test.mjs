import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateData } from "../scripts/validate-data.mjs";
import { syncData } from "../scripts/sync-data.mjs";
import { checkArtifacts, checkRelease } from "../scripts/check-artifacts.mjs";
const snapshot = JSON.parse(
  await readFile(
    new URL("../public/data/careflow.json", import.meta.url),
    "utf8",
  ),
);

test("refresh requires synthetic confirmation and preserves the snapshot on backend failure", async () => {
  const script = new URL("../scripts/refresh-data.mjs", import.meta.url);
  const destination = new URL("../public/data/careflow.json", import.meta.url);
  const before = await readFile(destination);
  const unconfirmed = spawnSync(process.execPath, [script.pathname], {
    encoding: "utf8",
  });
  assert.notEqual(unconfirmed.status, 0);
  assert.match(unconfirmed.stderr, /confirm-synthetic/);
  const backend = await mkdtemp(join(tmpdir(), "careflow-refresh-"));
  try {
    await mkdir(join(backend, "scripts"));
    await writeFile(join(backend, "scripts/refresh_public.sh"), "exit 42\n");
    const failed = spawnSync(
      process.execPath,
      [script.pathname, "--confirm-synthetic", "--backend-root", backend],
      { encoding: "utf8" },
    );
    assert.notEqual(failed.status, 0);
    assert.match(failed.stderr, /required command failed/);
    assert.deepEqual(await readFile(destination), before);
  } finally {
    await rm(backend, { recursive: true, force: true });
  }
});

test("the shipped aggregate snapshot satisfies the strict contract", () => {
  assert.equal(validateData(snapshot), snapshot);
});

test("an explicit unevaluated forecast keeps all evidence and predictions null", () => {
  const data = structuredClone(snapshot);
  data.forecast = {
    status: "not_evaluated",
    reason: "Insufficient observed history.",
    predictions: null,
    held_out_metrics: null,
    evaluation: null,
  };
  assert.equal(validateData(data), data);
});

test("development benchmarks cannot publish future predictions even after improvement", () => {
  const data = structuredClone(snapshot);
  const f = data.forecast,
    e = f.evaluation;
  e.selected_model = "seasonal_mean";
  e.selected_beats_baseline = true;
  e.validation_metrics[1] = {
    model: "seasonal_mean",
    mae: 0,
    rmse: 0,
    wape: 0,
  };
  e.folds.forEach((fold) =>
    fold.predictions.forEach((row) => {
      row.seasonal_mean = row.actual;
    }),
  );
  e.test_predictions.forEach((row) => {
    row.seasonal_mean = row.actual;
  });
  f.held_out_metrics[1] = { model: "seasonal_mean", mae: 0, rmse: 0, wape: 0 };
  assert.equal(validateData(data), data);
  f.predictions = [{ encounter_month: "2025-01-01", value: 10 }];
  assert.throws(() => validateData(data), /forecast.publication/);
});
test("risk evidence may be absent without exposing private artifacts", () => {
  const data = structuredClone(snapshot);
  data.risk = null;
  assert.equal(validateData(data), data);
});
const mutations = [
  [
    "measurement values in aggregate counts",
    (d) => {
      d.current.counts.observations = [
        { patient_id: "audit-sentinel", bmi: 25 },
      ];
    },
  ],
  [
    "private observation rows",
    (d) => {
      d.current.observations = [{ patient_id: "audit-sentinel", value: 25 }];
    },
  ],
  [
    "private fields in risk evidence",
    (d) => {
      d.risk.patient_rows = [{ patient_id: "audit-sentinel" }];
    },
  ],
  [
    "patient identifiers in risk splits",
    (d) => {
      d.risk.splits[0].patient_ids = ["audit-sentinel"];
    },
  ],
  [
    "an undocumented risk feature",
    (d) => {
      d.risk.features.push("patient_id");
    },
  ],
  [
    "stale risk evidence",
    (d) => {
      d.risk.source_loaded_at = "2020-01-01T00:00:00Z";
    },
  ],
  [
    "an invalid risk threshold",
    (d) => {
      d.risk.models[0].threshold = 2;
    },
  ],
  [
    "a fabricated risk precision",
    (d) => {
      d.risk.models[0].test.precision = 0;
    },
  ],
  [
    "a fabricated risk confusion count",
    (d) => {
      d.risk.models[0].test.true_positive += 1;
    },
  ],
  [
    "private notes in calibration",
    (d) => {
      d.risk.models[0].calibration[0].private_notes = "audit-sentinel";
    },
  ],
  [
    "incorrect calibration totals",
    (d) => {
      d.risk.models[0].calibration[0].snapshots += 1;
    },
  ],
  [
    "private independent-cohort rows",
    (d) => {
      d.risk.external.patient_rows = ["audit-sentinel"];
    },
  ],
  [
    "false risk readiness status",
    (d) => {
      d.risk.status = "insufficient_data";
    },
  ],

  [
    "private fields in a demand group",
    (d) => {
      d.demand.groups[0].patient_ids = ["audit-sentinel"];
    },
  ],
  [
    "a nested facility label",
    (d) => {
      d.demand.groups[0].label = { private_notes: "audit-sentinel" };
    },
  ],
  [
    "an invalid demand scope",
    (d) => {
      d.demand.groups[0].scope = "patient";
    },
  ],
  [
    "duplicated demand groups",
    (d) => {
      d.demand.groups.push({ ...d.demand.groups[0] });
    },
  ],
  [
    "fabricated demand volume",
    (d) => {
      d.demand.groups[0].annual_count += 1;
    },
  ],
  [
    "a sparse group incorrectly scored",
    (d) => {
      const g = d.demand.groups.find((g) => !g.eligible);
      g.eligible = true;
    },
  ],
  [
    "changed regional coverage",
    (d) => {
      d.demand.coverage.annual_matched_provider_encounters -= 1;
    },
  ],
  [
    "a changed demand calendar",
    (d) => {
      d.demand.months[0] = "2000-01-01";
    },
  ],
  [
    "future regional predictions",
    (d) => {
      d.demand.groups.find((g) => g.eligible).forecast.predictions = [
        { encounter_month: "2025-01-01", value: 100 },
      ];
    },
  ],

  [
    "uninspected-test claim on development data",
    (d) => {
      d.forecast.evaluation.benchmark_status = "untouched";
    },
  ],
  [
    "fabricated historical validation score",
    (d) => {
      d.forecast.evaluation.validation_metrics[0].mae += 1;
    },
  ],
  [
    "changed historical validation actual",
    (d) => {
      d.forecast.evaluation.folds[0].predictions[0].actual += 1;
    },
  ],
  [
    "private fields in historical predictions",
    (d) => {
      d.forecast.evaluation.folds[0].predictions[0].patient_id =
        "audit-sentinel";
    },
  ],
  [
    "private forecast evaluation metadata",
    (d) => {
      d.forecast.evaluation.patient_ids = ["audit-sentinel"];
    },
  ],
  [
    "a fabricated KPI patient ratio",
    (d) => {
      d.current.utilization_summary.encounters_per_seen_patient = 1000;
    },
  ],
  [
    "an annual patient count smaller than an observed month",
    (d) => {
      d.current.annual_utilization.at(-1).unique_patients = 0;
    },
  ],
  [
    "a median without any measured encounters",
    (d) => {
      d.current.utilization_summary.measured_duration_count = 0;
    },
  ],
  [
    "an invalid chronic-subset flag",
    (d) => {
      d.current.conditions[0].chronic_subset = "yes";
    },
  ],
  [
    "a fabricated held-out accuracy score",
    (d) => {
      d.forecast.held_out_metrics[0].mae = 0;
    },
  ],
  [
    "a changed holdout actual",
    (d) => {
      d.forecast.evaluation.test_predictions[0].actual += 1;
    },
  ],
  [
    "a model selected after viewing the holdout",
    (d) => {
      d.forecast.evaluation.selected_model = "seasonal_naive";
    },
  ],
  [
    "a changed evaluation input hash",
    (d) => {
      d.forecast.evaluation.input_sha256 = "0".repeat(64);
    },
  ],
  [
    "private fields in a segment cell",
    (d) => {
      d.current.segments.cells[0].patient_id = "audit-sentinel";
    },
  ],
  [
    "duplicate segment cells",
    (d) => {
      d.current.segments.cells.push({ ...d.current.segments.cells[0] });
    },
  ],
  [
    "unknown segment dimension",
    (d) => {
      d.current.segments.cells[0].gender = "private-category";
    },
  ],
  [
    "inconsistent segment totals",
    (d) => {
      d.current.segments.cells[0].patient_count += 1;
    },
  ],
  [
    "incorrect simulation cutoff",
    (d) => {
      d.current.segments.age_as_of = "2020-01-01";
    },
  ],
  [
    "unknown condition group",
    (d) => {
      d.current.conditions[0].group = "chronic";
    },
  ],
  [
    "an old snapshot without condition groups",
    (d) => {
      d.schema_version = 1;
    },
  ],
  [
    "nested private fields in a clinical label",
    (d) => {
      d.current.conditions[0].condition_name = { patient_id: "audit-sentinel" };
    },
  ],
  [
    "nested metadata in an assistant answer",
    (d) => {
      d.assistant.examples[0].answer = { private_notes: "audit-sentinel" };
    },
  ],
  [
    "private arrays inside limitations",
    (d) => {
      d.assistant.examples[0].citations[0].limitations[0] = ["audit-sentinel"];
    },
  ],
  [
    "an extra private field",
    (d) => {
      d.current.patient_ids = ["audit-sentinel"];
    },
  ],
  [
    "arbitrary identifiers in resource inventory",
    (d) => {
      d.archive.resources["audit-patient-id"] = 1;
    },
  ],
  [
    "a phishing evidence URL",
    (d) => {
      d.archive.evidence_url = "https://attacker.example/prompt";
    },
  ],
  [
    "a script evidence URL",
    (d) => {
      d.archive.evidence_url = "javascript:alert(1)";
    },
  ],
  [
    "a credential-bearing evidence URL",
    (d) => {
      d.archive.evidence_url =
        "https://user:audit-sentinel@github.com/elitay152/Careflow/blob/main/docs/validation-results.json"; // pragma: allowlist secret
    },
  ],
  [
    "inconsistent passing quality evidence",
    (d) => {
      d.current.quality.checks_passed = 0;
    },
  ],
  [
    "stale quality evidence",
    (d) => {
      d.current.quality.completed_at = "2025-01-01T00:00:00Z";
    },
  ],
  [
    "unverified evidence with success counts",
    (d) => {
      d.current.quality.status = "unverified";
    },
  ],
  [
    "impossible date",
    (d) => {
      d.archive.recorded_on = "2026-02-30";
    },
  ],
  [
    "non-numeric aggregate value",
    (d) => {
      d.current.monthly_utilization[0].encounter_count = "3";
    },
  ],
  [
    "a non-finite aggregate value",
    (d) => {
      d.current.conditions[0].prevalence_fraction = Infinity;
    },
  ],
  [
    "an unsupported metric",
    (d) => {
      d.assistant.examples[0].plan.metric = "patient_lookup";
    },
  ],
  [
    "mismatched citation metric",
    (d) => {
      d.assistant.examples[0].citations[0].metric_id = "medication_requests";
    },
  ],
  [
    "a non-baseline mode",
    (d) => {
      d.assistant.mode = "llm";
    },
  ],
  [
    "a fabricated forecast",
    (d) => {
      d.forecast.predictions = [100];
    },
  ],
  [
    "a duplicate replay question",
    (d) => {
      d.assistant.examples[1].question = d.assistant.examples[0].question;
    },
  ],
];
for (const [name, mutate] of mutations)
  test(`rejects ${name}`, () => {
    const candidate = structuredClone(snapshot);
    mutate(candidate);
    assert.throws(() => validateData(candidate), /Invalid aggregate contract/);
  });
test("unverified build evidence remains valid only with null outcome fields", () => {
  const candidate = structuredClone(snapshot);
  candidate.current.quality = {
    status: "unverified",
    completed_at: null,
    models_passed: null,
    checks_passed: null,
    checks_total: null,
    invocation_id: null,
  };
  assert.doesNotThrow(() => validateData(candidate));
});

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "careflow-security-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const directory of ["public/data", "dist/data", "dist/assets"])
    await mkdir(join(root, directory), { recursive: true });
  for (const stage of ["public", "dist"]) {
    await writeFile(
      join(root, stage, "data/careflow.json"),
      JSON.stringify(snapshot),
    );
    await writeFile(
      join(root, stage, "favicon.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg"/>',
    );
  }
  await writeFile(
    join(root, "dist/index.html"),
    "<!doctype html><title>Audit fixture</title>",
  );
  await writeFile(join(root, "dist/assets/index-audit.js"), "// audit fixture");
  return root;
}
test("release rejects an unexpected public environment file", async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, "public/.env"), "audit-only-sentinel");
  await assert.rejects(
    checkArtifacts(join(root, "public"), "public"),
    /Unexpected public artifact/,
  );
});
test("release rejects private bundles and source maps in the built output", async (t) => {
  const root = await fixture(t);
  await writeFile(
    join(root, "dist/assets/index-audit.js.map"),
    "audit-only-sentinel",
  );
  await assert.rejects(checkRelease(root), /Unexpected public artifact/);
});
test("release rejects symlinks into other workspace files", async (t) => {
  const root = await fixture(t);
  await symlink(
    join(root, "dist/index.html"),
    join(root, "public/linked.html"),
  );
  await assert.rejects(
    checkArtifacts(join(root, "public"), "public"),
    /Symlink/,
  );
});
test("release rejects a substituted downloadable snapshot", async (t) => {
  const root = await fixture(t);
  await checkRelease(root);
  await writeFile(join(root, "dist/data/careflow.json"), "{}");
  await assert.rejects(checkRelease(root), /differs/);
});
test("sync preserves a good destination on invalid input and copies valid bytes exactly", async (t) => {
  const root = await fixture(t);
  const source = join(root, "source.json"),
    target = join(root, "public/data/careflow.json");
  const original = await readFile(target);
  await writeFile(source, "{}");
  await assert.rejects(syncData(source, target), /Invalid aggregate contract/);
  assert.deepEqual(await readFile(target), original);
  const bytes = Buffer.from(JSON.stringify(snapshot, null, 2) + "\n");
  await writeFile(source, bytes);
  await syncData(source, target);
  await syncData(source, target);
  assert.deepEqual(await readFile(target), bytes);
});

test("oversized input is rejected before replacing an existing snapshot", async (t) => {
  const root = await fixture(t);
  const source = join(root, "oversized.json");
  const destination = join(root, "public/data/careflow.json");
  const original = await readFile(destination);
  await writeFile(source, Buffer.alloc(5 * 1024 * 1024 + 1, 32));
  await assert.rejects(syncData(source, destination), /snapshot size/);
  assert.deepEqual(await readFile(destination), original);
});
