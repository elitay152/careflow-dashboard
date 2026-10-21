import { createHash } from "node:crypto";
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
      ...(grouped ? ["group", "chronic_subset"] : []),
    ],
    location,
  );
  if (grouped && typeof row.chronic_subset !== "boolean")
    fail(`${location}.chronic_subset`);
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

function shiftMonth(value, offset) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 10);
}
function near(actual, expected, location) {
  if (expected === null) {
    if (actual !== null) fail(location);
    return;
  }
  numeric(actual, location);
  if (Math.abs(actual - expected) > 1e-6 * Math.max(1, Math.abs(expected)))
    fail(location);
}
function durationEvidence(row, location) {
  integer(row.measured_duration_count, location);
  if (row.measured_duration_count > row.encounter_count) fail(location);
  for (const key of ["average_duration_minutes", "median_duration_minutes"]) {
    if (row.measured_duration_count === 0) {
      if (row[key] !== null) fail(location);
    } else numeric(row[key], location);
  }
}
const FORECAST_MODELS = [
  "seasonal_naive",
  "seasonal_mean",
  "seasonal_trend",
  "damped_trend",
  "poisson_seasonal",
];
function forecastMetrics(rows, location) {
  array(rows, location, FORECAST_MODELS.length);
  if (rows.length !== FORECAST_MODELS.length) fail(location);
  rows.forEach((row, index) => {
    keys(row, ["model", "mae", "rmse", "wape"], location);
    if (row.model !== FORECAST_MODELS[index]) fail(location);
    numeric(row.mae, location);
    numeric(row.rmse, location);
    if (row.rmse + 1e-6 < row.mae) fail(location);
    if (row.wape !== null) numeric(row.wape, location);
  });
}
function validateForecast(forecast, monthly, exportedAt) {
  keys(
    forecast,
    ["status", "predictions", "held_out_metrics", "evaluation", "reason"],
    "forecast",
  );
  string(forecast.reason, "forecast.reason", 1000);
  if (forecast.status === "not_evaluated") {
    if (
      forecast.predictions !== null ||
      forecast.held_out_metrics !== null ||
      forecast.evaluation !== null
    )
      fail("forecast");
    return;
  }
  if (forecast.status !== "evaluated") fail("forecast");
  forecastMetrics(forecast.held_out_metrics, "forecast.metrics");
  const e = forecast.evaluation;
  keys(
    e,
    [
      "protocol",
      "benchmark_status",
      "evaluated_at",
      "input_sha256",
      "training_start",
      "training_end",
      "test_start",
      "test_end",
      "training_months",
      "model_window_months",
      "folds",
      "validation_metrics",
      "selected_model",
      "selected_beats_baseline",
      "test_predictions",
    ],
    "forecast.evaluation",
  );
  if (
    e.protocol !== "rolling_origin_v2" ||
    e.benchmark_status !== "development" ||
    e.training_months !== 108 ||
    e.model_window_months !== 60 ||
    typeof e.selected_beats_baseline !== "boolean"
  )
    fail("forecast.protocol");
  timestamp(e.evaluated_at, "forecast.evaluated_at");
  if (Date.parse(e.evaluated_at) > Date.parse(exportedAt))
    fail("forecast.evaluated_at");
  const series = monthly.slice(-120);
  if (
    series.length !== 120 ||
    series.some(
      (r, i) => r.encounter_month !== shiftMonth(series[0].encounter_month, i),
    )
  )
    fail("forecast.series");
  const digest = createHash("sha256")
    .update(
      JSON.stringify(
        series.map((r) => ({
          count: r.encounter_count,
          month: r.encounter_month,
        })),
      ),
    )
    .digest("hex");
  if (
    e.input_sha256 !== digest ||
    e.training_start !== series[0].encounter_month ||
    e.training_end !== series[107].encounter_month ||
    e.test_start !== series[108].encounter_month ||
    e.test_end !== series[119].encounter_month
  )
    fail("forecast.split");
  array(e.folds, "forecast.folds", 3);
  if (e.folds.length !== 3) fail("forecast.folds");
  e.folds.forEach((fold, i) => {
    keys(
      fold,
      ["training_end", "test_start", "test_end", "predictions"],
      "forecast.folds",
    );
    const stop = 72 + i * 12;
    if (
      fold.training_end !== series[stop - 1].encounter_month ||
      fold.test_start !== series[stop].encounter_month ||
      fold.test_end !== series[stop + 11].encounter_month
    )
      fail("forecast.folds");
    array(fold.predictions, "forecast.fold.predictions", 12);
    if (fold.predictions.length !== 12) fail("forecast.fold.predictions");
    fold.predictions.forEach((row, j) => {
      keys(
        row,
        ["encounter_month", "actual", ...FORECAST_MODELS],
        "forecast.fold.prediction",
      );
      if (
        row.encounter_month !== series[stop + j].encounter_month ||
        row.actual !== series[stop + j].encounter_count
      )
        fail("forecast.fold.actual");
      FORECAST_MODELS.forEach((model) =>
        numeric(row[model], "forecast.fold.prediction"),
      );
      if (row.seasonal_naive !== series[stop + j - 12].encounter_count)
        fail("forecast.fold.baseline");
    });
  });
  forecastMetrics(e.validation_metrics, "forecast.validation_metrics");
  FORECAST_MODELS.forEach((model, i) => {
    const rows = e.folds.flatMap((fold) => fold.predictions);
    const absolute = rows.reduce(
      (sum, row) => sum + Math.abs(row.actual - row[model]),
      0,
    );
    const total = rows.reduce((sum, row) => sum + row.actual, 0);
    near(
      e.validation_metrics[i].mae,
      absolute / rows.length,
      "forecast.validation.mae",
    );
    near(
      e.validation_metrics[i].rmse,
      Math.sqrt(
        rows.reduce((sum, row) => sum + (row.actual - row[model]) ** 2, 0) /
          rows.length,
      ),
      "forecast.validation.rmse",
    );
    near(
      e.validation_metrics[i].wape,
      total ? absolute / total : null,
      "forecast.validation.wape",
    );
  });
  const winner = e.validation_metrics.reduce((best, row) =>
    row.mae < best.mae ? row : best,
  );
  if (e.selected_model !== winner.model) fail("forecast.selection");
  array(e.test_predictions, "forecast.test_predictions", 12);
  if (e.test_predictions.length !== 12) fail("forecast.test_predictions");
  e.test_predictions.forEach((row, i) => {
    keys(
      row,
      ["encounter_month", "actual", ...FORECAST_MODELS],
      "forecast.test_predictions",
    );
    if (
      row.encounter_month !== series[108 + i].encounter_month ||
      row.actual !== series[108 + i].encounter_count
    )
      fail("forecast.actual");
    FORECAST_MODELS.forEach((model) =>
      numeric(row[model], "forecast.prediction"),
    );
    if (row.seasonal_naive !== series[96 + i].encounter_count)
      fail("forecast.baseline");
  });
  FORECAST_MODELS.forEach((model, i) => {
    const errors = e.test_predictions.map((r) => Math.abs(r.actual - r[model]));
    const absolute = errors.reduce((s, v) => s + v, 0);
    const actual = e.test_predictions.reduce((s, r) => s + r.actual, 0);
    const metric = forecast.held_out_metrics[i];
    near(metric.mae, absolute / 12, "forecast.mae");
    near(
      metric.rmse,
      Math.sqrt(errors.reduce((s, v) => s + v * v, 0) / 12),
      "forecast.rmse",
    );
    near(metric.wape, actual ? absolute / actual : null, "forecast.wape");
  });
  const selected = forecast.held_out_metrics.find(
    (r) => r.model === e.selected_model,
  );
  const beats =
    e.selected_model !== "seasonal_naive" &&
    selected.mae < forecast.held_out_metrics[0].mae;
  if (e.selected_beats_baseline !== beats) fail("forecast.gate");
  if (forecast.predictions !== null) fail("forecast.publication");
}

const SEGMENT_DIMENSIONS = {
  age_band: ["0_17", "18_34", "35_49", "50_64", "65_79", "80_plus", "unknown"],
  gender: ["male", "female", "other", "unknown"],
  clinical_profile: [
    "diabetes_and_hypertension",
    "diabetes_without_hypertension",
    "hypertension_without_diabetes",
    "other_selected_chronic",
    "no_selected_chronic",
  ],
  utilization_band: ["none", "one", "two_to_five", "six_plus"],
};
function validateSegments(segments, current) {
  const summary = current.utilization_summary;
  if (segments === null) {
    if (summary !== null) fail("segments");
    return;
  }
  if (!summary) fail("segments");
  keys(
    segments,
    ["start_month", "end_month_exclusive", "age_as_of", "cells"],
    "segments",
  );
  date(segments.age_as_of, "segments.age_as_of");
  const cutoff = new Date(
    Date.parse(`${summary.end_month_exclusive}T00:00:00Z`) - 86400000,
  )
    .toISOString()
    .slice(0, 10);
  if (
    segments.start_month !== summary.start_month ||
    segments.end_month_exclusive !== summary.end_month_exclusive ||
    segments.age_as_of !== cutoff
  )
    fail("segments.window");
  array(segments.cells, "segments.cells", 560);
  const dimensions = Object.keys(SEGMENT_DIMENSIONS);
  const measures = [
    "patient_count",
    "seen_patients",
    "encounter_count",
    "active_request_count",
  ];
  const observed = new Set();
  for (const cell of segments.cells) {
    keys(cell, [...dimensions, ...measures], "segments.cell");
    dimensions.forEach((key) => {
      if (!SEGMENT_DIMENSIONS[key].includes(cell[key]))
        fail("segments.dimension");
    });
    const signature = JSON.stringify(dimensions.map((key) => cell[key]));
    if (observed.has(signature)) fail("segments.duplicate");
    observed.add(signature);
    measures.forEach((key) => integer(cell[key], "segments.measure"));
    if (
      !cell.patient_count ||
      cell.seen_patients > cell.patient_count ||
      cell.encounter_count < cell.seen_patients
    )
      fail("segments.measure");
    const n = cell.patient_count;
    if (cell.utilization_band === "none") {
      if (cell.seen_patients !== 0 || cell.encounter_count !== 0)
        fail("segments.utilization");
    } else {
      if (cell.seen_patients !== n) fail("segments.utilization");
      if (cell.utilization_band === "one" && cell.encounter_count !== n)
        fail("segments.utilization");
      if (
        cell.utilization_band === "two_to_five" &&
        (cell.encounter_count < 2 * n || cell.encounter_count > 5 * n)
      )
        fail("segments.utilization");
      if (cell.utilization_band === "six_plus" && cell.encounter_count < 6 * n)
        fail("segments.utilization");
    }
  }
  const sum = (key, rows = segments.cells) =>
    rows.reduce((s, r) => s + r[key], 0);
  const active =
    current.medication_status.find((r) => r.status === "active")
      ?.request_count ?? 0;
  if (
    sum("patient_count") !== current.counts.patients ||
    sum("seen_patients") !== summary.unique_patients ||
    sum("encounter_count") !== summary.encounter_count ||
    sum("active_request_count") !== active
  )
    fail("segments.totals");
  if (
    sum(
      "patient_count",
      segments.cells.filter(
        (r) => r.clinical_profile !== "no_selected_chronic",
      ),
    ) !== current.chronic_summary.affected_patients
  )
    fail("segments.clinical");
}

function validateDemand(demand, monthly, exportedAt, totalPatients) {
  if (!monthly.length) {
    if (demand !== null) fail("demand");
    return;
  }
  keys(
    demand,
    ["months", "facility_count", "coverage", "hospitalization", "groups"],
    "demand",
  );
  const source = monthly.slice(-120);
  array(demand.months, "demand.months", 120);
  if (
    JSON.stringify(demand.months) !==
    JSON.stringify(source.map((r) => r.encounter_month))
  )
    fail("demand.months");
  integer(demand.facility_count, "demand.facility_count");
  keys(
    demand.coverage,
    [
      "finished_encounters",
      "matched_provider_encounters",
      "assigned_zip_encounters",
      "annual_finished_encounters",
      "annual_matched_provider_encounters",
      "annual_assigned_zip_encounters",
    ],
    "demand.coverage",
  );
  Object.values(demand.coverage).forEach((n) => integer(n, "demand.coverage"));
  const c = demand.coverage;
  const annualStart = shiftMonth(source.at(-1).encounter_month, -11);
  if (
    c.finished_encounters !==
      source.reduce((s, r) => s + r.encounter_count, 0) ||
    c.annual_finished_encounters !==
      source
        .filter((r) => r.encounter_month >= annualStart)
        .reduce((s, r) => s + r.encounter_count, 0) ||
    c.matched_provider_encounters > c.finished_encounters ||
    c.assigned_zip_encounters > c.matched_provider_encounters ||
    c.annual_matched_provider_encounters > c.annual_finished_encounters ||
    c.annual_assigned_zip_encounters > c.annual_matched_provider_encounters
  )
    fail("demand.coverage");
  keys(
    demand.hospitalization,
    ["annual_encounters", "annual_patients"],
    "demand.hospitalization",
  );
  Object.values(demand.hospitalization).forEach((n) =>
    integer(n, "demand.hospitalization"),
  );
  if (
    demand.hospitalization.annual_encounters > c.annual_finished_encounters ||
    demand.hospitalization.annual_patients >
      demand.hospitalization.annual_encounters ||
    demand.hospitalization.annual_patients > totalPatients
  )
    fail("demand.hospitalization");
  array(demand.groups, "demand.groups", 5000);
  const observed = new Set(),
    totals = { facility: 0, zip_area: 0 };
  const seriesTotals = {
    facility: source.map(() => 0),
    zip_area: source.map(() => 0),
  };
  const consecutive =
    source.length === 120 &&
    source.every(
      (r, i) => r.encounter_month === shiftMonth(source[0].encounter_month, i),
    );
  for (const group of demand.groups) {
    keys(
      group,
      [
        "scope",
        "key",
        "label",
        "care_setting",
        "counts",
        "annual_count",
        "eligible",
        "forecast",
      ],
      "demand.group",
    );
    if (
      !["facility", "zip_area"].includes(group.scope) ||
      !["ambulatory", "emergency", "inpatient", "other"].includes(
        group.care_setting,
      )
    )
      fail("demand.group");
    string(group.key, "demand.key", 40);
    string(group.label, "demand.label", 200);
    if (
      !(
        group.scope === "facility"
          ? /^site_[a-f0-9]{12}$/u
          : /^[A-Z]{2}-[0-9]{3}$/u
      ).test(group.key)
    )
      fail("demand.key");
    const signature = [group.scope, group.key, group.care_setting].join("|");
    if (observed.has(signature)) fail("demand.duplicate");
    observed.add(signature);
    array(group.counts, "demand.counts", 120);
    if (group.counts.length !== source.length) fail("demand.counts");
    group.counts.forEach((n, i) => {
      integer(n, "demand.count");
      seriesTotals[group.scope][i] += n;
    });
    const annual = group.counts.reduce(
      (s, n, i) => s + (source[i].encounter_month >= annualStart ? n : 0),
      0,
    );
    if (!annual || group.annual_count !== annual) fail("demand.annual_count");
    totals[group.scope] += annual;
    const eligible =
      consecutive &&
      annual >= 120 &&
      group.counts.slice(-12).filter((n) => n > 0).length >= 10 &&
      group.counts.slice(-72, -12).filter((n) => n > 0).length >= 36;
    if (group.eligible !== eligible) fail("demand.eligibility");
    if (!eligible) {
      if (group.forecast !== null) fail("demand.sparse");
    } else {
      if (!group.forecast || group.forecast.status !== "evaluated")
        fail("demand.forecast");
      validateForecast(
        group.forecast,
        source.map((r, i) => ({
          encounter_month: r.encounter_month,
          encounter_count: group.counts[i],
        })),
        exportedAt,
      );
    }
  }
  if (
    totals.facility !== c.annual_matched_provider_encounters ||
    totals.zip_area !== c.annual_assigned_zip_encounters
  )
    fail("demand.totals");
  for (const scope of Object.keys(seriesTotals))
    if (seriesTotals[scope].some((n, i) => n > source[i].encounter_count))
      fail("demand.series_totals");
}

const RISK_FEATURES = [
  "age_years",
  "encounters_90d",
  "encounters_365d",
  "emergency_365d",
  "inpatient_episodes_365d",
  "days_since_completed_encounter",
  "recorded_chronic_codes",
  "recorded_diabetes",
  "recorded_hypertension",
];
const RISK_EXCLUSIONS = [
  "under_18",
  "history_short",
  "dead_at_index",
  "unknown_death_date",
  "hospitalized_at_index",
  "censored",
  "outside_split",
];
function validateRisk(risk, current, exportedAt) {
  if (risk === null) return;
  const counts = [
    "patients",
    "candidate_snapshots",
    "eligible_snapshots",
    "assigned_snapshots",
    "raw_inpatient_encounters",
    "inpatient_episodes",
    "conditions",
    "undated_conditions",
  ];
  keys(
    risk,
    [
      "protocol",
      "observation_end",
      "status",
      "blockers",
      "evaluated_at",
      "source_loaded_at",
      "input_sha256",
      ...counts,
      "exclusions",
      "features",
      "splits",
      "models",
      "external",
    ],
    "risk",
  );
  if (
    risk.protocol !== "admission_90d_v1" ||
    !["evaluated", "ready_not_trained", "insufficient_data"].includes(
      risk.status,
    ) ||
    JSON.stringify(risk.features) !== JSON.stringify(RISK_FEATURES)
  )
    fail("risk.protocol");
  counts.forEach((k) => integer(risk[k], "risk.counts"));
  date(risk.observation_end, "risk.observation_end");
  timestamp(risk.evaluated_at, "risk.evaluated_at");
  timestamp(risk.source_loaded_at, "risk.source_loaded_at");
  if (
    risk.source_loaded_at !== current.source_loaded_at ||
    Date.parse(risk.source_loaded_at) > Date.parse(risk.evaluated_at) ||
    Date.parse(risk.evaluated_at) > Date.parse(exportedAt)
  )
    fail("risk.evidence");
  if (
    typeof risk.input_sha256 !== "string" ||
    !/^[a-f0-9]{64}$/u.test(risk.input_sha256)
  )
    fail("risk.hash");
  if (
    risk.patients !== current.counts.patients ||
    risk.conditions !== current.counts.conditions ||
    risk.undated_conditions > risk.conditions ||
    risk.inpatient_episodes > risk.raw_inpatient_encounters ||
    risk.raw_inpatient_encounters > current.counts.encounters ||
    risk.candidate_snapshots !== risk.patients * 40
  )
    fail("risk.counts");
  keys(risk.exclusions, RISK_EXCLUSIONS, "risk.exclusions");
  Object.values(risk.exclusions).forEach((n) => integer(n, "risk.exclusions"));
  if (
    risk.eligible_snapshots !==
      risk.candidate_snapshots -
        Object.entries(risk.exclusions)
          .filter(([k]) => k !== "outside_split")
          .reduce((s, [, n]) => s + n, 0) ||
    risk.assigned_snapshots !==
      risk.eligible_snapshots - risk.exclusions.outside_split
  )
    fail("risk.accounting");
  array(risk.splits, "risk.splits", 3);
  if (risk.splits.length !== 3) fail("risk.splits");
  const periods = [
    ["train", "2015-01-01", "2020-10-01"],
    ["validation", "2021-01-01", "2022-10-01"],
    ["test", "2023-01-01", "2024-10-01"],
  ];
  const splitCounts = [
      "snapshots",
      "patients",
      "positive_snapshots",
      "positive_patients",
      "negative_patients",
    ],
    blockers = [];
  risk.splits.forEach((split, i) => {
    keys(split, ["split", "start", "end", ...splitCounts], "risk.split");
    splitCounts.forEach((k) => integer(split[k], "risk.split"));
    if (
      JSON.stringify([split.split, split.start, split.end]) !==
        JSON.stringify(periods[i]) ||
      split.positive_snapshots > split.snapshots ||
      split.positive_patients > split.patients ||
      split.positive_patients > split.positive_snapshots ||
      split.negative_patients > split.patients ||
      split.patients > split.snapshots ||
      split.snapshots > split.patients * (i === 0 ? 24 : 8)
    )
      fail("risk.split");
    if (split.positive_patients < (i === 0 ? 50 : 10))
      blockers.push(split.split + "_positive_patients");
    if (split.negative_patients < 50)
      blockers.push(split.split + "_negative_patients");
  });
  if (risk.undated_conditions)
    blockers.push("missing_condition_recorded_dates");
  if (
    JSON.stringify(blockers) !== JSON.stringify(risk.blockers) ||
    blockers.length > 0 !== (risk.status === "insufficient_data")
  )
    fail("risk.readiness");
  if (
    risk.splits.reduce((s, r) => s + r.snapshots, 0) !==
      risk.assigned_snapshots ||
    risk.splits.reduce((s, r) => s + r.patients, 0) > risk.patients
  )
    fail("risk.splits");
  const external = risk.external;
  if (external !== null) {
    keys(
      external,
      [
        "patients",
        "snapshots",
        "positive_snapshots",
        "positive_patients",
        "source_loaded_at",
        "input_sha256",
        "observation_end",
      ],
      "risk.external",
    );
    [
      "patients",
      "snapshots",
      "positive_snapshots",
      "positive_patients",
    ].forEach((k) => integer(external[k], "risk.external"));
    timestamp(external.source_loaded_at, "risk.external.source_loaded_at");
    if (
      external.observation_end !== risk.observation_end ||
      Date.parse(external.source_loaded_at) > Date.parse(risk.evaluated_at) ||
      !/^[a-f0-9]{64}$/u.test(external.input_sha256) ||
      external.positive_patients < 20 ||
      external.positive_patients > external.patients ||
      external.positive_patients > external.positive_snapshots ||
      external.positive_snapshots > external.snapshots ||
      external.snapshots > external.patients * 8
    )
      fail("risk.external");
  }
  const rate = (v, nullable = false) => {
    if (v === null && nullable) return;
    numeric(v, "risk.rate");
    if (v > 1) fail("risk.rate");
  };
  function metrics(m, split) {
    keys(
      m,
      [
        "average_precision",
        "brier",
        "precision",
        "recall",
        "true_positive",
        "false_positive",
        "false_negative",
        "true_negative",
      ],
      "risk.metrics",
    );
    [
      "true_positive",
      "false_positive",
      "false_negative",
      "true_negative",
    ].forEach((k) => integer(m[k], "risk.confusion"));
    ["average_precision", "brier", "recall"].forEach((k) => rate(m[k]));
    rate(m.precision, true);
    const tp = m.true_positive,
      fp = m.false_positive,
      fn = m.false_negative,
      tn = m.true_negative;
    if (
      tp + fn !== split.positive_snapshots ||
      tp + fp + fn + tn !== split.snapshots
    )
      fail("risk.confusion");
    near(m.precision, tp + fp ? tp / (tp + fp) : null, "risk.precision");
    near(m.recall, tp / (tp + fn), "risk.recall");
  }
  function calibration(bins, split) {
    array(bins, "risk.calibration", 5);
    if (bins.length !== 5) fail("risk.calibration");
    const bounds = [0, 0.01, 0.025, 0.05, 0.1, 1];
    bins.forEach((bin, i) => {
      keys(
        bin,
        ["lower", "upper", "snapshots", "mean_risk", "observed_rate"],
        "risk.calibration",
      );
      integer(bin.snapshots, "risk.calibration");
      if (bin.lower !== bounds[i] || bin.upper !== bounds[i + 1])
        fail("risk.calibration");
      rate(bin.mean_risk, !bin.snapshots);
      rate(bin.observed_rate, !bin.snapshots);
      if (
        !bin.snapshots &&
        (bin.mean_risk !== null || bin.observed_rate !== null)
      )
        fail("risk.calibration");
      if (
        bin.snapshots &&
        (bin.mean_risk < bin.lower || bin.mean_risk > bin.upper)
      )
        fail("risk.calibration");
    });
    if (bins.reduce((s, b) => s + b.snapshots, 0) !== split.snapshots)
      fail("risk.calibration");
    near(
      bins.reduce((s, b) => s + (b.observed_rate ?? 0) * b.snapshots, 0),
      split.positive_snapshots,
      "risk.calibration.outcomes",
    );
  }
  array(risk.models, "risk.models", 3);
  if (
    JSON.stringify(risk.models.map((m) => m.model)) !==
    JSON.stringify(
      risk.status === "evaluated"
        ? ["prevalence", "prior_admission", "logistic"]
        : [],
    )
  )
    fail("risk.models");
  for (const model of risk.models) {
    keys(
      model,
      [
        "model",
        "threshold",
        "validation",
        "test",
        "calibration",
        "external",
        "external_calibration",
      ],
      "risk.model",
    );
    rate(model.threshold);
    metrics(model.validation, risk.splits[1]);
    metrics(model.test, risk.splits[2]);
    calibration(model.calibration, risk.splits[2]);
    if (external) {
      metrics(model.external, external);
      calibration(model.external_calibration, external);
    } else if (model.external !== null || model.external_calibration !== null)
      fail("risk.external");
  }
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
      "demand",
      "risk",
    ],
    "root",
  );
  if (data.schema_version !== 7 || data.synthetic_only !== true) fail("root");
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
      "annual_utilization",
      "utilization_summary",
      "chronic_summary",
      "segments",
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
        "median_duration_minutes",
        "measured_duration_count",
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
    durationEvidence(row, "monthly_utilization");
    previous = row.encounter_month;
  }
  array(current.annual_utilization, "annual_utilization", 200);
  previous = "";
  for (const row of current.annual_utilization) {
    keys(
      row,
      [
        "encounter_month",
        "encounter_count",
        "unique_patients",
        "average_duration_minutes",
        "median_duration_minutes",
        "measured_duration_count",
      ],
      "annual_utilization",
    );
    month(row.encounter_month, "annual_utilization");
    if (
      !row.encounter_month.endsWith("-01-01") ||
      row.encounter_month <= previous
    )
      fail("annual_utilization");
    previous = row.encounter_month;
    integer(row.encounter_count, "annual_utilization");
    integer(row.unique_patients, "annual_utilization");
    if (
      row.unique_patients > current.counts.patients ||
      row.unique_patients > row.encounter_count
    )
      fail("annual_utilization");
    durationEvidence(row, "annual_utilization");
    const months = current.monthly_utilization.filter(
      (m) => m.encounter_month.slice(0, 4) === row.encounter_month.slice(0, 4),
    );
    if (
      !months.length ||
      months.reduce((sum, m) => sum + m.encounter_count, 0) !==
        row.encounter_count ||
      months.reduce((sum, m) => sum + m.measured_duration_count, 0) !==
        row.measured_duration_count ||
      row.unique_patients < Math.max(...months.map((m) => m.unique_patients))
    )
      fail("annual_utilization");
  }
  if (
    new Set(
      current.monthly_utilization.map((m) => m.encounter_month.slice(0, 4)),
    ).size !== current.annual_utilization.length
  )
    fail("annual_utilization");
  const summary = current.utilization_summary;
  if (summary === null) {
    if (current.monthly_utilization.length) fail("utilization_summary");
  } else {
    keys(
      summary,
      [
        "encounter_count",
        "unique_patients",
        "measured_duration_count",
        "median_duration_minutes",
        "average_duration_minutes",
        "start_month",
        "end_month_exclusive",
        "encounters_per_seen_patient",
        "cohort_share",
      ],
      "utilization_summary",
    );
    const last = current.monthly_utilization.at(-1)?.encounter_month;
    if (
      !last ||
      summary.start_month !== shiftMonth(last, -11) ||
      summary.end_month_exclusive !== shiftMonth(last, 1)
    )
      fail("utilization_summary");
    integer(summary.encounter_count, "utilization_summary");
    integer(summary.unique_patients, "utilization_summary");
    durationEvidence(summary, "utilization_summary");
    const window = current.monthly_utilization.filter(
      (r) =>
        r.encounter_month >= summary.start_month &&
        r.encounter_month < summary.end_month_exclusive,
    );
    if (
      summary.encounter_count !==
        window.reduce((s, r) => s + r.encounter_count, 0) ||
      summary.measured_duration_count !==
        window.reduce((s, r) => s + r.measured_duration_count, 0) ||
      summary.unique_patients > current.counts.patients ||
      summary.unique_patients > summary.encounter_count ||
      summary.unique_patients <
        Math.max(...window.map((r) => r.unique_patients))
    )
      fail("utilization_summary");
    near(
      summary.encounters_per_seen_patient,
      summary.unique_patients
        ? summary.encounter_count / summary.unique_patients
        : null,
      "utilization_summary.ratio",
    );
    near(
      summary.cohort_share,
      current.counts.patients
        ? summary.unique_patients / current.counts.patients
        : null,
      "utilization_summary.share",
    );
  }
  keys(
    current.chronic_summary,
    ["affected_patients", "total_patients", "mapped_codes"],
    "chronic_summary",
  );
  Object.values(current.chronic_summary).forEach((value) =>
    integer(value, "chronic_summary"),
  );
  if (
    current.chronic_summary.total_patients !== current.counts.patients ||
    current.chronic_summary.affected_patients > current.counts.patients ||
    current.chronic_summary.mapped_codes !== 19
  )
    fail("chronic_summary");
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
  validateSegments(current.segments, current);
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
      (quality.models_passed !== 11 ||
        quality.checks_passed !== 39 ||
        quality.checks_total !== 39)
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
  validateRisk(data.risk, current, data.exported_at);
  validateDemand(
    data.demand,
    current.monthly_utilization,
    data.exported_at,
    current.counts.patients,
  );
  validateForecast(
    data.forecast,
    current.monthly_utilization,
    data.exported_at,
  );
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
