import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import protocol from "./uci-readmission-protocol.json" with { type: "json" };
const fail = (where) => {
  throw new Error(`Invalid readmission contract at ${where}`);
};
const sorted = (x) =>
  Array.isArray(x)
    ? x.map(sorted)
    : x && typeof x === "object"
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, sorted(x[k])]),
        )
      : x;
const hash = (x) =>
  createHash("sha256")
    .update(JSON.stringify(sorted(x)))
    .digest("hex");
function keys(x, list, path) {
  if (
    !x ||
    typeof x !== "object" ||
    Array.isArray(x) ||
    Object.keys(x).length !== list.length ||
    list.some((k) => !Object.hasOwn(x, k))
  )
    fail(path);
}
function count(x, path) {
  if (!Number.isSafeInteger(x) || x < 0) fail(path);
}
function probability(x, path) {
  if (typeof x !== "number" || !Number.isFinite(x) || x < 0 || x > 1)
    fail(path);
}
function near(a, b, path) {
  if (
    typeof a !== "number" ||
    !Number.isFinite(a) ||
    Math.abs(a - b) > 1e-8 * Math.max(1, Math.abs(b))
  )
    fail(path);
}
function equal(a, b, path) {
  if (JSON.stringify(sorted(a)) !== JSON.stringify(sorted(b))) fail(path);
}
function text(x, path, max = 1000) {
  if (
    typeof x !== "string" ||
    !x.trim() ||
    x.length > max ||
    /[\u0000-\u001f]/u.test(x)
  )
    fail(path);
}
function fingerprint(x, path) {
  if (typeof x !== "string" || !/^[a-f0-9]{64}$/u.test(x)) fail(path);
}
function metrics(m, split, path) {
  keys(
    m,
    [
      "n",
      "positives",
      "prevalence",
      "average_precision",
      "roc_auc",
      "brier",
      "calibration",
      "review",
    ],
    path,
  );
  if (m.n !== split.encounters || m.positives !== split.positives)
    fail(`${path}.counts`);
  for (const k of ["prevalence", "average_precision", "roc_auc", "brier"])
    probability(m[k], `${path}.${k}`);
  near(m.prevalence, m.positives / m.n, path);
  if (!Array.isArray(m.calibration) || m.calibration.length !== 10)
    fail(`${path}.calibration`);
  let n = 0,
    pos = 0;
  for (const [i, b] of m.calibration.entries()) {
    keys(
      b,
      ["lower", "upper", "n", "positives", "mean_probability", "observed_rate"],
      path,
    );
    equal([b.lower, b.upper], [i / 10, (i + 1) / 10], path);
    count(b.n, path);
    count(b.positives, path);
    if (b.positives > b.n) fail(path);
    n += b.n;
    pos += b.positives;
    if (!b.n) {
      if (b.mean_probability !== null || b.observed_rate !== null) fail(path);
    } else {
      probability(b.mean_probability, path);
      if (b.mean_probability < b.lower || b.mean_probability > b.upper)
        fail(path);
      near(b.observed_rate, b.positives / b.n, path);
    }
  }
  if (n !== m.n || pos !== m.positives) fail(`${path}.calibration.counts`);
  if (!Array.isArray(m.review) || m.review.length !== 2) fail(`${path}.review`);
  m.review.forEach((r, i) => {
    keys(r, ["capacity", "reviewed", "captured", "precision", "recall"], path);
    if (
      r.capacity !== [0.1, 0.2][i] ||
      r.reviewed !== Math.ceil(m.n * r.capacity)
    )
      fail(path);
    count(r.captured, path);
    if (r.captured > Math.min(r.reviewed, m.positives)) fail(path);
    near(r.precision, r.captured / r.reviewed, path);
    near(r.recall, r.captured / m.positives, path);
  });
}
export function validateReadmission(d) {
  if (
    !d ||
    d.schema_version !== 1 ||
    d.dataset_kind !== "observed_public_aggregate"
  )
    fail("identity");
  equal(d.protocol, protocol, "protocol");
  if (d.protocol_sha256 !== hash(protocol)) fail("protocol.sha256");
  if (d.status === "not_run") {
    keys(
      d,
      [
        "schema_version",
        "status",
        "dataset_kind",
        "generated_at",
        "protocol",
        "protocol_sha256",
        "reason",
      ],
      "pending",
    );
    if (
      d.generated_at !== null ||
      d.reason !==
        "Awaiting the first successful UCI API fetch and patient-grouped benchmark. No real-data model results are claimed."
    )
      fail("pending.evidence");
    return d;
  }
  if (d.status !== "completed") fail("status");
  keys(
    d,
    [
      "schema_version",
      "status",
      "dataset_kind",
      "generated_at",
      "protocol",
      "protocol_sha256",
      "source",
      "software",
      "quality",
      "evaluation",
      "limitations",
    ],
    "root",
  );
  if (
    typeof d.generated_at !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?\+00:00$/u.test(
      d.generated_at,
    ) ||
    !Number.isFinite(Date.parse(d.generated_at))
  )
    fail("timestamp");
  const s = d.source;
  keys(
    s,
    [
      "dataset_id",
      "name",
      "api_url",
      "data_url",
      "page_url",
      "license_url",
      "license_evidence",
      "attribution",
      "csv_sha256",
      "metadata_sha256",
      "license_page_sha256",
      "source_pinned",
    ],
    "source",
  );
  const fixed = {
    dataset_id: 296,
    name: "Diabetes 130-US Hospitals for Years 1999–2008",
    api_url: "https://archive.ics.uci.edu/api/dataset?id=296",
    data_url: "https://archive.ics.uci.edu/static/public/296/data.csv",
    page_url:
      "https://archive.ics.uci.edu/dataset/296/diabetes+130-us+hospitals+for+years+1999-2008",
    license_url: "https://creativecommons.org/licenses/by/4.0/",
    license_evidence:
      "CC BY 4.0 link checked on the official dataset page at retrieval",
  };
  for (const [k, v] of Object.entries(fixed))
    if (s[k] !== v) fail(`source.${k}`);
  for (const k of ["csv_sha256", "metadata_sha256", "license_page_sha256"])
    fingerprint(s[k], k);
  text(s.attribution, "attribution");
  if (typeof s.source_pinned !== "boolean") fail("source_pinned");
  keys(d.software, ["scikit_learn"], "software");
  if (d.software.scikit_learn !== "1.9.1") fail("software");
  const q = d.quality;
  keys(
    q,
    [
      "source_rows",
      "source_patients",
      "eligible_encounters",
      "eligible_patients",
      "excluded_encounters",
      "excluded_by_disposition",
      "source_labels",
      "duplicate_encounters",
    ],
    "quality",
  );
  for (const k of [
    "source_rows",
    "source_patients",
    "eligible_encounters",
    "eligible_patients",
    "excluded_encounters",
    "duplicate_encounters",
  ])
    count(q[k], k);
  if (
    q.source_rows !== 101766 ||
    q.duplicate_encounters !== 0 ||
    q.eligible_encounters + q.excluded_encounters !== q.source_rows ||
    !q.eligible_patients ||
    q.eligible_patients > q.source_patients ||
    q.source_patients > q.source_rows ||
    q.eligible_patients > q.eligible_encounters
  )
    fail("quality.counts");
  keys(
    q.excluded_by_disposition,
    protocol.excluded_discharge_codes.map(String),
    "exclusions",
  );
  Object.values(q.excluded_by_disposition).forEach((v) =>
    count(v, "exclusions"),
  );
  if (
    Object.values(q.excluded_by_disposition).reduce((a, b) => a + b, 0) !==
    q.excluded_encounters
  )
    fail("exclusions.sum");
  keys(q.source_labels, ["<30", ">30", "NO"], "labels");
  Object.values(q.source_labels).forEach((v) => count(v, "labels"));
  if (Object.values(q.source_labels).reduce((a, b) => a + b, 0) !== 101766)
    fail("labels.sum");
  const e = d.evaluation;
  keys(
    e,
    ["selected_model", "splits", "patient_overlap", "models"],
    "evaluation",
  );
  if (
    e.patient_overlap !== 0 ||
    !Array.isArray(e.splits) ||
    e.splits.length !== 3 ||
    !Array.isArray(e.models) ||
    e.models.length !== 4
  )
    fail("evaluation.structure");
  e.splits.forEach((s, i) => {
    keys(s, ["split", "encounters", "patients", "positives"], "split");
    if (s.split !== ["train", "validation", "test"][i]) fail("split.name");
    [s.encounters, s.patients, s.positives].forEach((v) => count(v, "split"));
    if (
      s.encounters < 20 ||
      !s.patients ||
      s.patients > s.encounters ||
      !s.positives ||
      s.positives >= s.encounters
    )
      fail("split.counts");
  });
  if (
    e.splits.reduce((a, s) => a + s.encounters, 0) !== q.eligible_encounters ||
    e.splits.reduce((a, s) => a + s.patients, 0) !== q.eligible_patients
  )
    fail("split.sums");
  e.models.forEach((m, i) => {
    keys(m, ["model", "validation", "test"], "model");
    if (m.model !== protocol.models[i]) fail("model.name");
    metrics(m.validation, e.splits[1], "validation");
    metrics(m.test, e.splits[2], "test");
  });
  const winner = e.models.reduce((a, b) =>
    b.validation.average_precision > a.validation.average_precision ? b : a,
  );
  if (e.selected_model !== winner.model) fail("selection");
  const trainRate = e.splits[0].positives / e.splits[0].encounters;
  for (const name of ["validation", "test"]) {
    const m = e.models[0][name];
    near(m.average_precision, m.prevalence, "baseline.ap");
    near(m.roc_auc, 0.5, "baseline.auc");
    near(
      m.brier,
      trainRate ** 2 * (1 - m.prevalence) + (1 - trainRate) ** 2 * m.prevalence,
      "baseline.brier",
    );
  }
  if (!Array.isArray(d.limitations) || d.limitations.length !== 6)
    fail("limitations");
  d.limitations.forEach((x) => text(x, "limitations"));
  return d;
}
export async function readReadmission(path) {
  const f = await open(path, "r");
  try {
    const stat = await f.stat();
    if (!stat.isFile() || stat.size > 256 * 1024) fail("file.size");
    const bytes = Buffer.alloc(256 * 1024 + 1);
    let n = 0;
    while (n < bytes.length) {
      const r = await f.read(bytes, n, bytes.length - n, null);
      if (!r.bytesRead) break;
      n += r.bytesRead;
    }
    if (n > 256 * 1024) fail("file.size");
    const raw = bytes.subarray(0, n);
    validateReadmission(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)),
    );
    return raw;
  } finally {
    await f.close();
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await readReadmission(
    new URL("../public/data/readmission.json", import.meta.url),
  );
  console.log("Readmission evidence contract verified.");
}
