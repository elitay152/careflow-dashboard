import { open } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const FHIR_TYPES = new Set([
  "AllergyIntolerance",
  "CarePlan",
  "CareTeam",
  "Claim",
  "Condition",
  "Device",
  "DiagnosticReport",
  "DocumentReference",
  "Encounter",
  "ExplanationOfBenefit",
  "ImagingStudy",
  "Immunization",
  "Location",
  "Medication",
  "MedicationAdministration",
  "MedicationRequest",
  "Observation",
  "Organization",
  "Patient",
  "Practitioner",
  "PractitionerRole",
  "Procedure",
  "Provenance",
  "SupplyDelivery",
]);
const MONTHLY = new Set([
  "monthly_encounters",
  "monthly_patients",
  "mean_encounter_duration",
]);
const METRICS = new Set([
  ...MONTHLY,
  "condition_prevalence",
  "medication_requests",
]);
const MEDICATION_STATUSES = new Set([
  "active",
  "on-hold",
  "cancelled",
  "completed",
  "entered-in-error",
  "stopped",
  "draft",
  "unknown",
]);
const EVIDENCE_URL =
  "https://github.com/elitay152/Careflow/blob/main/docs/validation-results.json";
function fail(location) {
  throw new Error(`Invalid aggregate contract at ${location}`);
}
function record(value, location) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(location);
}
function keys(value, allowed, location) {
  record(value, location);
  if (
    Object.keys(value).length !== allowed.length ||
    allowed.some((key) => !Object.hasOwn(value, key))
  )
    fail(location);
}
function string(value, location, max = 4096) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)
  )
    fail(location);
}
function integer(value, location) {
  if (!Number.isSafeInteger(value) || value < 0) fail(location);
}
function numeric(value, location) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    fail(location);
}
function array(value, location, max = 10000) {
  if (!Array.isArray(value) || value.length > max) fail(location);
}
function date(value, location) {
  if (
    typeof value !== "string" ||
    !/^[1-9]\d{3}-\d{2}-\d{2}$/u.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    fail(location);
}
function timestamp(value, location) {
  if (
    typeof value !== "string" ||
    !/^[1-9]\d{3}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/u.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  )
    fail(location);
  date(value.slice(0, 10), location);
}
function month(value, location) {
  date(value, location);
  if (!value.endsWith("-01")) fail(location);
}
function identifier(value, location) {
  if (typeof value !== "string" || !/^[a-z][a-z0-9_]{0,62}$/u.test(value))
    fail(location);
}
function counts(value, location) {
  keys(
    value,
    [
      "patients",
      "encounters",
      "conditions",
      "medications",
      "loads",
      "quarantine",
    ],
    location,
  );
  Object.values(value).forEach((item) => integer(item, location));
}
function condition(row, location, population, grouped = false) {
  keys(
    row,
    [
      "condition_name",
      "code_system",
      "code",
      "affected_patients",
      "total_patients",
      "prevalence_fraction",
      ...(grouped ? ["group"] : []),
    ],
    location,
  );
  if (
    grouped &&
    ![
      "clinical",
      "social_context",
      "history",
      "care_context",
      "unclassified",
    ].includes(row.group)
  )
    fail(`${location}.group`);
  for (const key of ["condition_name", "code_system", "code"])
    string(row[key], location);
  integer(row.affected_patients, location);
  integer(row.total_patients, location);
  numeric(row.prevalence_fraction, location);
  if (
    row.total_patients !== population ||
    row.affected_patients > row.total_patients ||
    row.total_patients === 0 ||
    Math.abs(
      row.prevalence_fraction - row.affected_patients / row.total_patients,
    ) > 1e-9
  )
    fail(location);
}
function medication(row, location) {
  keys(row, ["status", "request_count"], location);
  if (!MEDICATION_STATUSES.has(row.status)) fail(location);
  integer(row.request_count, location);
}

export function validateData(data) {
  keys(
    data,
    [
      "schema_version",
      "synthetic_only",
      "exported_at",
      "current",
      "archive",
      "assistant",
      "forecast",
    ],
    "root",
  );
  if (data.schema_version !== 2 || data.synthetic_only !== true) fail("root");
  timestamp(data.exported_at, "exported_at");
  const current = data.current;
  keys(
    current,
    [
      "label",
      "raw_schema",
      "analytics_schema",
      "source_loaded_at",
      "counts",
      "monthly_utilization",
      "conditions",
      "medication_status",
      "quality",
    ],
    "current",
  );
  string(current.label, "current.label", 200);
  identifier(current.raw_schema, "raw_schema");
  identifier(current.analytics_schema, "analytics_schema");
  if (current.source_loaded_at !== null) {
    timestamp(current.source_loaded_at, "source_loaded_at");
    if (Date.parse(current.source_loaded_at) > Date.parse(data.exported_at))
      fail("source_loaded_at");
  }
  counts(current.counts, "current.counts");
  array(current.monthly_utilization, "monthly_utilization", 2400);
  let previous = "";
  for (const row of current.monthly_utilization) {
    keys(
      row,
      [
        "encounter_month",
        "encounter_count",
        "unique_patients",
        "average_duration_minutes",
      ],
      "monthly_utilization",
    );
    month(row.encounter_month, "encounter_month");
    integer(row.encounter_count, "encounter_count");
    integer(row.unique_patients, "unique_patients");
    if (row.average_duration_minutes !== null)
      numeric(row.average_duration_minutes, "average_duration_minutes");
    if (
      row.encounter_month <= previous ||
      row.unique_patients > current.counts.patients ||
      row.unique_patients > row.encounter_count
    )
      fail("monthly_utilization");
    previous = row.encounter_month;
  }
  array(current.conditions, "conditions");
  current.conditions.forEach((row) =>
    condition(row, "conditions", current.counts.patients, true),
  );
  array(
    current.medication_status,
    "medication_status",
    MEDICATION_STATUSES.size,
  );
  current.medication_status.forEach((row) =>
    medication(row, "medication_status"),
  );
  if (
    new Set(current.medication_status.map((row) => row.status)).size !==
      current.medication_status.length ||
    current.medication_status.reduce(
      (sum, row) => sum + row.request_count,
      0,
    ) !== current.counts.medications
  )
    fail("medication_status");
  const quality = current.quality;
  keys(
    quality,
    [
      "status",
      "completed_at",
      "models_passed",
      "checks_passed",
      "checks_total",
      "invocation_id",
    ],
    "quality",
  );
  if (quality.status === "unverified") {
    if (
      Object.entries(quality).some(
        ([key, value]) => key !== "status" && value !== null,
      )
    )
      fail("quality");
  } else {
    if (!["passed", "failed"].includes(quality.status)) fail("quality.status");
    timestamp(quality.completed_at, "quality.completed_at");
    string(quality.invocation_id, "invocation_id", 128);
    for (const key of ["models_passed", "checks_passed", "checks_total"])
      integer(quality[key], `quality.${key}`);
    if (
      quality.checks_passed > quality.checks_total ||
      Date.parse(quality.completed_at) > Date.parse(data.exported_at) ||
      (current.source_loaded_at &&
        Date.parse(quality.completed_at) < Date.parse(current.source_loaded_at))
    )
      fail("quality");
    if (
      quality.status === "passed" &&
      (quality.models_passed !== 10 ||
        quality.checks_passed !== 32 ||
        quality.checks_total !== 32)
    )
      fail("quality.passed");
  }
  const archive = data.archive;
  keys(
    archive,
    [
      "label",
      "recorded_on",
      "evidence_url",
      "counts",
      "resources",
      "accepted",
      "rejected",
      "ignored",
      "input_files",
      "dbt_models_passed",
      "dbt_tests_passed",
    ],
    "archive",
  );
  string(archive.label, "archive.label", 200);
  date(archive.recorded_on, "archive.recorded_on");
  if (archive.evidence_url !== EVIDENCE_URL) fail("archive.evidence_url");
  counts(archive.counts, "archive.counts");
  record(archive.resources, "archive.resources");
  if (!Object.keys(archive.resources).length) fail("archive.resources");
  for (const [name, value] of Object.entries(archive.resources)) {
    if (!FHIR_TYPES.has(name)) fail("archive.resources");
    integer(value, "archive.resources");
  }
  for (const name of [
    "accepted",
    "rejected",
    "ignored",
    "input_files",
    "dbt_models_passed",
    "dbt_tests_passed",
  ])
    integer(archive[name], `archive.${name}`);
  if (
    Object.values(archive.resources).reduce((sum, value) => sum + value, 0) !==
      archive.accepted + archive.rejected + archive.ignored ||
    archive.dbt_models_passed !== 10 ||
    archive.dbt_tests_passed !== 32
  )
    fail("archive.evidence");
  keys(data.assistant, ["mode", "execution", "examples"], "assistant");
  if (
    data.assistant.mode !== "baseline" ||
    data.assistant.execution !== "exported_replay"
  )
    fail("assistant");
  array(data.assistant.examples, "examples", 3);
  if (data.assistant.examples.length !== 3) fail("examples");
  const questions = new Set();
  for (const example of data.assistant.examples) {
    keys(
      example,
      ["question", "status", "answer", "rows", "citations", "plan"],
      "example",
    );
    string(example.question, "question", 1000);
    string(example.answer, "answer");
    const normalized = example.question
      .trim()
      .toLowerCase()
      .replace(/[?.!]+$/u, "")
      .replace(/\s+/gu, " ");
    if (questions.has(normalized) || example.status !== "answered")
      fail("example");
    questions.add(normalized);
    const plan = example.plan;
    keys(
      plan,
      ["metric", "start_month", "end_month", "condition_filter"],
      "plan",
    );
    if (!METRICS.has(plan.metric)) fail("plan.metric");
    for (const field of ["start_month", "end_month"]) {
      if (plan[field] !== null) {
        month(plan[field], field);
        if (!MONTHLY.has(plan.metric)) fail(field);
      }
    }
    if (
      plan.start_month &&
      plan.end_month &&
      plan.start_month >= plan.end_month
    )
      fail("plan.date_range");
    if (plan.condition_filter !== null) {
      string(plan.condition_filter, "condition_filter", 100);
      if (plan.metric !== "condition_prevalence") fail("condition_filter");
    }
    array(example.rows, "answer.rows", 50);
    for (const row of example.rows) {
      if (plan.metric === "condition_prevalence")
        condition(row, "answer.rows", current.counts.patients);
      else if (plan.metric === "medication_requests")
        medication(row, "answer.rows");
      else {
        keys(row, ["encounter_month", "value"], "answer.rows");
        month(row.encounter_month, "answer.rows");
        if (plan.metric === "mean_encounter_duration") {
          if (row.value !== null) numeric(row.value, "answer.rows");
        } else integer(row.value, "answer.rows");
      }
    }
    array(example.citations, "citations", 1);
    if (example.citations.length !== 1) fail("citations");
    for (const citation of example.citations) {
      keys(
        citation,
        ["metric_id", "title", "definition", "relation", "limitations"],
        "citation",
      );
      if (citation.metric_id !== plan.metric) fail("citation.metric_id");
      for (const field of ["title", "definition"])
        string(citation[field], `citation.${field}`);
      const relation = MONTHLY.has(plan.metric)
        ? "mart_monthly_utilization"
        : plan.metric === "condition_prevalence"
          ? "mart_condition_prevalence"
          : "fct_medication_requests";
      if (citation.relation !== `${current.analytics_schema}.${relation}`)
        fail("citation.relation");
      array(citation.limitations, "limitations", 20);
      citation.limitations.forEach((value) => string(value, "limitations"));
    }
  }
  keys(
    data.forecast,
    ["status", "predictions", "held_out_metrics"],
    "forecast",
  );
  if (
    data.forecast.status !== "not_evaluated" ||
    data.forecast.predictions !== null ||
    data.forecast.held_out_metrics !== null
  )
    fail("forecast");
  return data;
}

export async function readSnapshot(path) {
  const limit = 5 * 1024 * 1024;
  const handle = await open(path, "r");
  try {
    if ((await handle.stat()).size > limit) fail("snapshot size");
    // Bound the read even if a writer grows the file after the size check.
    const buffer = Buffer.alloc(limit + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(
        buffer,
        length,
        buffer.length - length,
        null,
      );
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    if (length > limit) fail("snapshot size");
    const bytes = buffer.subarray(0, length);
    validateData(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    );
    return bytes;
  } finally {
    await handle.close();
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await readSnapshot(new URL("../public/data/careflow.json", import.meta.url));
  console.log("Aggregate snapshot contract verified.");
}
