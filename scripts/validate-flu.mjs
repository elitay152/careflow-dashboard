import { createHash } from "node:crypto";
import intervalProtocol from "./flu-interval-protocol.json" with { type: "json" };
import { open } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const fluModels = [
  "last_value",
  "seasonal_naive",
  "damped_growth",
  "seasonal_autoreg",
];
const repo = "https://github.com/cdcepi/FluSight-forecast-hub";
function fail(where) {
  throw new Error(`Invalid public flu contract at ${where}`);
}
function keys(value, allowed, where) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== allowed.length ||
    allowed.some((k) => !Object.hasOwn(value, k))
  )
    fail(where);
}
function equal(a, b, where) {
  if (JSON.stringify(a) !== JSON.stringify(b)) fail(where);
}
function integer(x, where) {
  if (!Number.isSafeInteger(x) || x < 0) fail(where);
}
function number(x, where) {
  if (typeof x !== "number" || !Number.isFinite(x) || x < 0) fail(where);
}
function string(x, where, max = 4096) {
  if (
    typeof x !== "string" ||
    !x.trim() ||
    x.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(x)
  )
    fail(where);
}
function array(x, where, max) {
  if (!Array.isArray(x) || x.length > max) fail(where);
}
function week(x, where) {
  if (
    typeof x !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(x) ||
    !Number.isFinite(Date.parse(x)) ||
    new Date(x).toISOString().slice(0, 10) !== x ||
    new Date(x).getUTCDay() !== 6
  )
    fail(where);
}
function timestamp(x, where) {
  if (
    typeof x !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/u.test(
      x,
    ) ||
    !Number.isFinite(Date.parse(x)) ||
    new Date(x).toISOString().slice(0, 10) !== x.slice(0, 10)
  )
    fail(where);
}
function shift(x, n) {
  return new Date(Date.parse(x) + n * 7 * 86400000).toISOString().slice(0, 10);
}
function sorted(x) {
  return Array.isArray(x)
    ? x.map(sorted)
    : x && typeof x === "object"
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, sorted(x[k])]),
        )
      : x;
}
function hash(x) {
  return createHash("sha256")
    .update(JSON.stringify(sorted(x)))
    .digest("hex");
}
function near(a, b, where) {
  number(a, where);
  if (Math.abs(a - b) > 1e-8 * Math.max(1, Math.abs(b))) fail(where);
}
function metrics(rows, models, where) {
  array(models, where, 4);
  equal(
    models.map((x) => x.model),
    fluModels,
    where,
  );
  for (const m of models) {
    keys(m, ["model", "mae", "rmse", "wape", "n", "by_horizon"], where);
    function check(part, value) {
      if (value.n !== part.length) fail(`${where}.n`);
      const errors = part.map((r) => Math.abs(r.actual - r[m.model]));
      const total = part.reduce((s, r) => s + r.actual, 0);
      const abs = errors.reduce((s, x) => s + x, 0);
      near(value.mae, abs / part.length, `${where}.mae`);
      near(
        value.rmse,
        Math.sqrt(errors.reduce((s, x) => s + x * x, 0) / part.length),
        `${where}.rmse`,
      );
      if (total) near(value.wape, abs / total, `${where}.wape`);
      else if (value.wape !== null) fail(`${where}.wape`);
    }
    check(rows, m);
    array(m.by_horizon, where, 4);
    equal(
      m.by_horizon.map((x) => x.horizon),
      [1, 2, 3, 4],
      where,
    );
    for (const h of m.by_horizon) {
      keys(h, ["horizon", "n", "mae", "rmse", "wape"], where);
      check(
        rows.filter((r) => r.horizon === h.horizon),
        h,
      );
    }
  }
}

function checkComputed(a, b, path) {
  if (typeof b === "number") {
    if (
      typeof a !== "number" ||
      !Number.isFinite(a) ||
      Math.abs(a - b) > 1e-8 * Math.max(1, Math.abs(b))
    )
      fail(path);
  } else if (Array.isArray(b)) {
    array(a, path, b.length);
    if (a.length !== b.length) fail(path);
    b.forEach((v, i) => checkComputed(a[i], v, `${path}.${i}`));
  } else if (b && typeof b === "object") {
    keys(a, Object.keys(b), path);
    for (const k of Object.keys(b)) checkComputed(a[k], b[k], `${path}.${k}`);
  } else if (a !== b) fail(path);
}

function checkPeakDiagnostics(rows, diagnostics) {
  const observed = rows.filter((r) => r.horizon === 1);
  const peak = observed.reduce((a, b) => (b.actual > a.actual ? b : a));
  const start = shift(peak.week, -2),
    end = shift(peak.week, 2);
  const expected = {
    method: "descriptive_peak_window_v1",
    observed_peak: { week: peak.week, count: peak.actual },
    peak_window: { start, end },
    by_horizon: [1, 2, 3, 4].map((horizon) => {
      const part = rows.filter((r) => r.horizon === horizon);
      return {
        horizon,
        models: fluModels.map((model) => {
          const total = part.reduce(
            (s, r) => s + Math.abs(r[model] - r.actual),
            0,
          );
          const highest = part.reduce((a, b) => (b[model] > a[model] ? b : a));
          return {
            model,
            phases: ["before", "peak", "after"].map((phase) => {
              const subset = part.filter(
                (r) =>
                  (r.week < start
                    ? "before"
                    : r.week > end
                      ? "after"
                      : "peak") === phase,
              );
              const abs = subset.reduce(
                (s, r) => s + Math.abs(r[model] - r.actual),
                0,
              );
              return {
                phase,
                n: subset.length,
                mae: subset.length ? abs / subset.length : null,
                bias: subset.length
                  ? subset.reduce((s, r) => s + r[model] - r.actual, 0) /
                    subset.length
                  : null,
                error_share: total ? abs / total : null,
              };
            }),
            peak: {
              week: highest.week,
              count: highest[model],
              lag_weeks:
                (Date.parse(highest.week) - Date.parse(peak.week)) /
                (7 * 86400000),
              count_error: highest[model] - peak.actual,
            },
          };
        }),
      };
    }),
  };
  checkComputed(diagnostics, expected, "holdout.peak_diagnostics");
}

function checkIntervals(e) {
  const interval = e.intervals;
  keys(interval, ["protocol", "protocol_sha256", "by_horizon"], "intervals");
  equal(
    sorted(interval.protocol),
    sorted(intervalProtocol),
    "intervals.protocol",
  );
  if (interval.protocol_sha256 !== hash(intervalProtocol))
    fail("intervals.protocol_sha256");
  const { start, end } = e.holdout.peak_diagnostics.peak_window;
  const scores = (rows, model, radius, level) => {
    let below = 0,
      above = 0,
      width = 0,
      score = 0;
    for (const r of rows) {
      const lower = Math.max(0, Math.floor(r[model] - radius));
      const upper = Math.ceil(r[model] + radius);
      below += Number(r.actual < lower);
      above += Number(r.actual > upper);
      width += upper - lower;
      score +=
        upper -
        lower +
        (2 / (1 - level / 100)) *
          (Math.max(0, lower - r.actual) + Math.max(0, r.actual - upper));
    }
    const n = rows.length;
    return {
      n,
      coverage: n ? (n - below - above) / n : null,
      mean_width: n ? width / n : null,
      below,
      above,
      mean_interval_score: n ? score / n : null,
    };
  };
  const expected = [1, 2, 3, 4].map((horizon) => {
    const calibration = e.validation.predictions.filter(
      (r) =>
        r.horizon === horizon &&
        r.week >= intervalProtocol.calibration_start &&
        r.week <= intervalProtocol.calibration_end,
    );
    if (calibration.length !== 102) fail("intervals.calibration_n");
    const n = calibration.length;
    const ranks = intervalProtocol.levels.map((level) => ({
      level,
      rank: Math.ceil(((n + 1) * level) / 100),
    }));
    const part = e.holdout.predictions.filter((r) => r.horizon === horizon);
    return {
      horizon,
      calibration_n: n,
      quantile_ranks: ranks,
      models: fluModels.map((model) => {
        const residuals = calibration
          .map((r) => Math.abs(r.actual - r[model]))
          .sort((a, b) => a - b);
        return {
          model,
          bands: ranks.map(({ level, rank }) => {
            const radius = residuals[rank - 1];
            return {
              level,
              radius,
              metrics: scores(part, model, radius, level),
              by_phase: ["before", "peak", "after"].map((phase) => ({
                phase,
                ...scores(
                  part.filter(
                    (r) =>
                      (r.week < start
                        ? "before"
                        : r.week > end
                          ? "after"
                          : "peak") === phase,
                  ),
                  model,
                  radius,
                  level,
                ),
              })),
            };
          }),
        };
      }),
    };
  });
  checkComputed(interval.by_horizon, expected, "intervals.by_horizon");
}

export function validateFlu(data) {
  keys(
    data,
    [
      "schema_version",
      "dataset_kind",
      "generated_at",
      "source",
      "protocol",
      "protocol_sha256",
      "series_sha256",
      "history",
      "evaluation",
      "limitations",
    ],
    "root",
  );
  if (
    data.schema_version !== 1 ||
    data.dataset_kind !== "observed_public_aggregate"
  )
    fail("root.kind");
  timestamp(data.generated_at, "generated_at");
  const p = data.protocol,
    s = data.source,
    e = data.evaluation;
  keys(
    p,
    [
      "protocol",
      "target",
      "location",
      "source",
      "models",
      "horizons",
      "validation",
      "holdout",
      "minimum_history_weeks",
      "autoregression_window_weeks",
      "ridge_alpha",
      "growth_window_weeks",
      "growth_log_slope_bound",
      "growth_damping",
      "selection",
      "publication_gate",
      "evaluation_role",
    ],
    "protocol",
  );
  if (
    p.protocol !== "flusight_us_v1" ||
    p.location !== "US" ||
    p.target !==
      "Weekly reported laboratory-confirmed influenza hospital admissions"
  )
    fail("protocol.identity");
  equal(p.models, fluModels, "protocol.models");
  equal(p.horizons, [1, 2, 3, 4], "protocol.horizons");
  for (const [key, value] of Object.entries({
    minimum_history_weeks: 64,
    autoregression_window_weeks: 104,
    ridge_alpha: 10,
    growth_window_weeks: 4,
    growth_log_slope_bound: 0.25,
    growth_damping: 0.8,
  }))
    if (p[key] !== value) fail(`protocol.${key}`);
  equal(
    p.validation,
    [
      { season: "2023/24", start: "2023-07-01", end: "2024-06-29" },
      { season: "2024/25", start: "2024-07-06", end: "2025-06-28" },
    ],
    "protocol.validation",
  );
  equal(
    p.holdout,
    { season: "2025/26", start: "2025-07-05", end: "2026-06-27" },
    "protocol.holdout",
  );
  if (
    p.selection !== "Lowest pooled validation MAE; ties follow model order" ||
    p.publication_gate !==
      "Validation winner must strictly beat both last_value and seasonal_naive on pooled holdout MAE" ||
    p.evaluation_role !==
      "Retrospective rolling-origin evaluation using a pinned revised dataset; not real-time vintage validation"
  )
    fail("protocol.rules");
  keys(
    p.source,
    ["repository", "revision", "path", "sha256", "first_week", "last_week"],
    "protocol.source",
  );
  keys(
    s,
    [
      "name",
      "repository",
      "revision",
      "sha256",
      "data_url",
      "documentation_url",
      "license_url",
      "license_notice",
      "attribution",
      "verified_at",
      "quality",
    ],
    "source",
  );
  if (
    s.name !== "CDC/NHSN via FluSight" ||
    s.repository !== repo ||
    p.source.repository !== repo ||
    p.source.path !== "target-data/target-hospital-admissions.csv" ||
    !/^[a-f0-9]{40}$/u.test(s.revision) ||
    !/^[a-f0-9]{64}$/u.test(s.sha256) ||
    s.revision !== p.source.revision ||
    s.sha256 !== p.source.sha256
  )
    fail("source.identity");
  for (const [key, path] of Object.entries({
    data_url: p.source.path,
    documentation_url: "target-data/README.md",
    license_url: "LICENSE",
  }))
    if (s[key] !== `${repo}/blob/${s.revision}/${path}`) fail(`source.${key}`);
  string(s.license_notice, "source.license_notice", 2500);
  if (
    !s.license_notice.startsWith(
      "MIT License\n\nCopyright (c) 2022 Consortium of Infectious Disease Modeling Hubs\n",
    ) ||
    !s.license_notice.endsWith("SOFTWARE.\n")
  )
    fail("source.license_notice");
  string(s.attribution, "source.attribution", 600);
  timestamp(s.verified_at, "source.verified_at");
  if (Date.parse(s.verified_at) > Date.parse(data.generated_at))
    fail("source.verified_at");
  keys(
    s.quality,
    [
      "rows",
      "locations",
      "missing_state_values",
      "national_missing_values",
      "duplicate_location_weeks",
      "national_week_gaps",
    ],
    "source.quality",
  );
  for (const [key, value] of Object.entries(s.quality))
    integer(value, `source.quality.${key}`);
  if (
    s.quality.national_missing_values ||
    s.quality.duplicate_location_weeks ||
    s.quality.national_week_gaps ||
    s.quality.locations !== 53 ||
    s.quality.rows !== 13038 ||
    s.quality.missing_state_values !== 36
  )
    fail("source.quality");
  array(data.history, "history", 1000);
  if (data.history.length !== 246) fail("history.length");
  const actual = new Map();
  for (const [i, row] of data.history.entries()) {
    keys(row, ["week", "count"], "history.row");
    week(row.week, "history.week");
    integer(row.count, "history.count");
    if (i && row.week !== shift(data.history[i - 1].week, 1))
      fail("history.gap");
    actual.set(row.week, row.count);
  }
  if (
    data.history[0].week !== p.source.first_week ||
    data.history.at(-1).week !== p.source.last_week ||
    p.source.first_week !== "2022-02-05" ||
    p.source.last_week !== "2026-10-17" ||
    Date.parse(p.source.last_week) > Date.parse(s.verified_at)
  )
    fail("history.coverage");
  if (
    hash(data.history) !== data.series_sha256 ||
    hash(p) !== data.protocol_sha256
  )
    fail("input.hash");
  keys(
    e,
    [
      "selected_model",
      "validation",
      "holdout",
      "publication",
      "forecast",
      "intervals",
    ],
    "evaluation",
  );
  keys(e.validation, ["seasons", "metrics", "predictions"], "validation");
  equal(
    e.validation.seasons,
    p.validation.map((x) => {
      const n = (Date.parse(x.end) - Date.parse(x.start)) / (7 * 86400000) + 1;
      return { ...x, targets: n, forecasts: n * 4 };
    }),
    "validation.seasons",
  );
  function checkRows(rows, windows, where) {
    array(rows, where, 2000);
    const expected = [];
    for (const w of windows)
      for (let d = w.start; d <= w.end; d = shift(d, 1))
        for (const h of [1, 2, 3, 4]) expected.push([d, h]);
    if (rows.length !== expected.length) fail(`${where}.length`);
    rows.forEach((r, i) => {
      keys(r, ["week", "horizon", "actual", ...fluModels], where);
      equal([r.week, r.horizon], expected[i], where);
      if (r.actual !== actual.get(r.week)) fail(`${where}.actual`);
      for (const m of fluModels) number(r[m], `${where}.prediction`);
    });
  }
  checkRows(e.validation.predictions, p.validation, "validation.predictions");
  metrics(e.validation.predictions, e.validation.metrics, "validation.metrics");
  const selected = e.validation.metrics.reduce((a, b) =>
    b.mae < a.mae ? b : a,
  ).model;
  if (e.selected_model !== selected) fail("selection");
  keys(
    e.holdout,
    [
      "season",
      "start",
      "end",
      "targets",
      "forecasts",
      "metrics",
      "predictions",
      "peak_diagnostics",
    ],
    "holdout",
  );
  for (const key of ["season", "start", "end"])
    if (e.holdout[key] !== p.holdout[key]) fail("holdout.window");
  if (e.holdout.targets !== 52 || e.holdout.forecasts !== 208)
    fail("holdout.counts");
  checkRows(e.holdout.predictions, [p.holdout], "holdout.predictions");
  metrics(e.holdout.predictions, e.holdout.metrics, "holdout.metrics");
  checkPeakDiagnostics(e.holdout.predictions, e.holdout.peak_diagnostics);
  checkIntervals(e);
  const selectedMae = e.holdout.metrics.find((m) => m.model === selected).mae;
  const publish = ["last_value", "seasonal_naive"].every(
    (m) => selectedMae < e.holdout.metrics.find((x) => x.model === m).mae,
  );
  keys(e.publication, ["status", "reason"], "publication");
  equal(
    e.publication,
    {
      status: publish ? "research_projection" : "withheld",
      reason: publish
        ? "Validation winner beat both simple baselines on pooled holdout MAE."
        : "Validation winner did not strictly beat both simple baselines on pooled holdout MAE.",
    },
    "publication.gate",
  );
  if (!publish) {
    if (e.forecast !== null) fail("forecast.withheld");
  } else {
    array(e.forecast, "forecast", 4);
    if (e.forecast.length !== 4) fail("forecast.length");
    e.forecast.forEach((r, i) => {
      keys(r, ["week", "horizon", "prediction"], "forecast.row");
      if (r.horizon !== i + 1 || r.week !== shift(p.source.last_week, i + 1))
        fail("forecast.week");
      number(r.prediction, "forecast.prediction");
    });
  }
  array(data.limitations, "limitations", 8);
  if (data.limitations.length < 5) fail("limitations");
  data.limitations.forEach((x) => string(x, "limitations", 400));
  return data;
}

export async function readFluSnapshot(path) {
  const handle = await open(path, "r");
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 512 * 1024) fail("file.size");
    const buffer = Buffer.alloc(512 * 1024 + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(
        buffer,
        length,
        buffer.length - length,
        null,
      );
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > 512 * 1024) fail("file.size");
    const raw = buffer.subarray(0, length);
    validateFlu(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)),
    );
    return raw;
  } finally {
    await handle.close();
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await readFluSnapshot(
    process.argv[2] || new URL("../public/data/flusight.json", import.meta.url),
  );
  console.log(
    "Public flu provenance, dates, metrics, selection, and publication gate verified.",
  );
}
