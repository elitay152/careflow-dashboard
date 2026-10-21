import assert from "node:assert/strict";
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

test("the shipped aggregate snapshot satisfies the strict contract", () => {
  assert.equal(validateData(snapshot), snapshot);
});
const mutations = [
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
      // Deliberately fake userinfo for the URL-rejection regression test.
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
