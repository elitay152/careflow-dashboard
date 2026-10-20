import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

function keys(value, allowed, location) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !allowed.includes(key)) ||
    allowed.some((key) => !(key in value))
  ) {
    throw new Error(`Unexpected aggregate contract at ${location}`);
  }
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
  if (
    Object.values(value).some((item) => !Number.isSafeInteger(item) || item < 0)
  )
    throw new Error(`Invalid counts at ${location}`);
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
  if (
    data.schema_version !== 1 ||
    data.synthetic_only !== true ||
    !Number.isFinite(Date.parse(data.exported_at))
  )
    throw new Error("Expected a dated, synthetic-only version 1 export");
  keys(
    data.current,
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
  counts(data.current.counts, "current.counts");
  const monthly = [
    "encounter_month",
    "encounter_count",
    "unique_patients",
    "average_duration_minutes",
  ];
  const condition = [
    "condition_name",
    "code_system",
    "code",
    "affected_patients",
    "total_patients",
    "prevalence_fraction",
  ];
  const medication = ["status", "request_count"];
  data.current.monthly_utilization.forEach((row) =>
    keys(row, monthly, "monthly_utilization"),
  );
  data.current.conditions.forEach((row) => keys(row, condition, "conditions"));
  data.current.medication_status.forEach((row) =>
    keys(row, medication, "medication_status"),
  );
  keys(
    data.current.quality,
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
  keys(
    data.archive,
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
  counts(data.archive.counts, "archive.counts");
  if (
    Object.values(data.archive.resources).some(
      (value) => !Number.isSafeInteger(value) || value < 0,
    )
  )
    throw new Error("Expected numeric archived resource totals");
  keys(data.assistant, ["mode", "execution", "examples"], "assistant");
  if (
    data.assistant.mode !== "baseline" ||
    data.assistant.execution !== "exported_replay"
  )
    throw new Error("Only offline baseline replay is supported");
  for (const example of data.assistant.examples) {
    keys(
      example,
      ["question", "status", "answer", "rows", "citations", "plan"],
      "example",
    );
    keys(
      example.plan,
      ["metric", "start_month", "end_month", "condition_filter"],
      "plan",
    );
    const rowKeys =
      example.plan.metric === "condition_prevalence"
        ? condition
        : example.plan.metric === "medication_requests"
          ? medication
          : ["encounter_month", "value"];
    example.rows.forEach((row) => keys(row, rowKeys, "answer.rows"));
    example.citations.forEach((citation) =>
      keys(
        citation,
        ["metric_id", "title", "definition", "relation", "limitations"],
        "citation",
      ),
    );
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
    throw new Error("This version does not publish forecast results");
  return data;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  validateData(
    JSON.parse(
      await readFile(
        new URL("../public/data/careflow.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  console.log("Aggregate snapshot contract verified.");
}
