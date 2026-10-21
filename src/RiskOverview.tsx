import { useState } from "react";
type Metrics = {
  average_precision: number;
  brier: number;
  precision: number | null;
  recall: number;
  true_positive: number;
  false_positive: number;
  false_negative: number;
  true_negative: number;
};
type Bin = {
  lower: number;
  upper: number;
  snapshots: number;
  mean_risk: number | null;
  observed_rate: number | null;
};
type Model = {
  model: string;
  threshold: number;
  validation: Metrics;
  test: Metrics;
  calibration: Bin[];
  external: Metrics | null;
  external_calibration: Bin[] | null;
};
export type RiskSummary = {
  status: string;
  protocol: string;
  observation_end: string;
  evaluated_at: string;
  patients: number;
  eligible_snapshots: number;
  assigned_snapshots: number;
  raw_inpatient_encounters: number;
  inpatient_episodes: number;
  conditions: number;
  undated_conditions: number;
  features: string[];
  exclusions: Record<string, number>;
  blockers: string[];
  splits: {
    split: string;
    start: string;
    end: string;
    snapshots: number;
    patients: number;
    positive_snapshots: number;
    positive_patients: number;
  }[];
  models: Model[];
  external: {
    patients: number;
    snapshots: number;
    positive_snapshots: number;
    positive_patients: number;
  } | null;
};
const names: Record<string, string> = {
  prevalence: "Training prevalence",
  prior_admission: "Prior admission baseline",
  logistic: "Logistic regression",
};
const features: Record<string, string> = {
  age_years: "Age at snapshot",
  encounters_90d: "Completed encounters · 90 days",
  encounters_365d: "Completed encounters · 365 days",
  emergency_365d: "Completed emergency visits · 365 days",
  inpatient_episodes_365d: "Prior completed inpatient episodes · 365 days",
  days_since_completed_encounter: "Days since last completed encounter",
  recorded_chronic_codes: "Previously recorded selected chronic codes",
  recorded_diabetes: "Previously recorded type 2 diabetes",
  recorded_hypertension: "Previously recorded hypertension",
};
const number = (v: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(v);
const pct = (v: number | null) => (v === null ? "—" : number(v * 100) + "%");
export default function RiskOverview({ data }: { data: RiskSummary | null }) {
  const [view, setView] = useState("external"),
    [modelName, setModelName] = useState("logistic");
  if (!data)
    return (
      <p className="note demand-note">
        No current hospitalization-risk evaluation has been exported. Run the
        private audit and refresh the aggregate snapshot. No individual risk
        scores are shown.
      </p>
    );
  const external = Boolean(data.external) && view === "external";
  const cohort = external ? data.external! : data.splits[2];
  const logistic = data.models.find((m) => m.model === "logistic");
  const selected = data.models.find((m) => m.model === modelName);
  const metric = external ? selected?.external : selected?.test;
  const bins =
    (external ? selected?.external_calibration : selected?.calibration) ?? [];
  const max = Math.max(
    0.1,
    ...bins.flatMap((b) => [b.mean_risk ?? 0, b.observed_rate ?? 0]),
  );
  const limit = Math.min(1, Math.ceil(max * 10) / 10),
    x = (v: number) => 60 + (v / limit) * 660,
    y = (v: number) => 210 - (v / limit) * 165;
  return (
    <>
      <p className="note demand-note">
        <strong>Exploratory synthetic-data study.</strong> The target is a new
        inpatient episode starting after an adult’s snapshot and within 90 days.
        Overlapping or touching inpatient encounters are merged. These results
        do not establish clinical validity, and individual scores are not
        published.
      </p>
      <section
        className="panel risk-panel"
        aria-labelledby="risk-cohort-heading"
      >
        <div className="panel-heading">
          <div>
            <h2 id="risk-cohort-heading">Patients and time held apart</h2>
            <p>
              Every patient belongs to one split. Training stops before
              validation; validation stops before the internal test.
            </p>
          </div>
        </div>
        <div className="risk-splits">
          {data.splits.map((s) => (
            <article key={s.split}>
              <span className="eyebrow">
                {s.split === "test" ? "INTERNAL TEST" : s.split.toUpperCase()}
              </span>
              <h3>{number(s.patients)} patients</h3>
              <p>
                {number(s.snapshots)} snapshots · {number(s.positive_snapshots)}{" "}
                positive outcomes among {number(s.positive_patients)} patients
              </p>
              <small>
                Snapshot dates {s.start}–{s.end}
              </small>
            </article>
          ))}
        </div>
        {data.external && (
          <p className="risk-copy">
            <strong>Independent cohort:</strong>{" "}
            {number(data.external.patients)} new patients from a different
            simulator seed, with {number(data.external.positive_snapshots)}{" "}
            positive snapshots among {number(data.external.positive_patients)}{" "}
            patients. The model and validation-selected threshold are unchanged.
          </p>
        )}
      </section>
      {data.status !== "evaluated" ? (
        <p className="note demand-note">
          <strong>No model fitted.</strong>{" "}
          {data.status === "insufficient_data"
            ? "Event-count or date-coverage checks have not passed."
            : "The dataset passed the checks, but model fitting has not been requested."}{" "}
          Readiness checks are descriptive gates, not proof of reliable
          prediction.
        </p>
      ) : (
        <>
          {logistic?.test.recall === 0 && (
            <p className="note demand-note">
              <strong>
                The selected threshold missed the positive outcomes.
              </strong>{" "}
              At the locked threshold, logistic regression caught{" "}
              {logistic.test.true_positive} of{" "}
              {data.splits[2].positive_snapshots} positive internal-test
              snapshots
              {data.external && logistic.external && (
                <>
                  {" "}
                  and {logistic.external.true_positive} of{" "}
                  {data.external.positive_snapshots} positive independent-cohort
                  snapshots
                </>
              )}
              . The model and threshold remain unchanged; this is an evaluation
              experiment, not a deployed risk tool.
            </p>
          )}
          <section
            className="panel risk-panel"
            aria-labelledby="risk-result-heading"
          >
            <div className="panel-heading">
              <div>
                <h2 id="risk-result-heading">Model comparison</h2>
                <p>
                  Average precision measures ranking; Brier score measures
                  probability error. Neither is percent accuracy.
                </p>
              </div>
            </div>
            {data.external && (
              <div
                className="segmented risk-controls"
                aria-label="Risk evaluation cohort"
              >
                <button
                  aria-pressed={external}
                  onClick={() => setView("external")}
                >
                  Independent cohort
                </button>
                <button
                  aria-pressed={!external}
                  onClick={() => setView("test")}
                >
                  Internal test
                </button>
              </div>
            )}
            <p className="risk-copy">
              {external ? "Independent cohort" : "Internal test"}:{" "}
              {number(cohort.positive_snapshots)} positive outcomes /{" "}
              {number(cohort.snapshots)} snapshots (
              {pct(cohort.positive_snapshots / cohort.snapshots)}), across{" "}
              {number(cohort.patients)} patients. Repeated snapshots from one
              patient are correlated.
            </p>
            <div
              className="table-scroll"
              role="region"
              aria-label="Hospitalization model comparison"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Validation AP ↑</th>
                    <th>{external ? "Independent" : "Test"} AP ↑</th>
                    <th>Brier score ↓</th>
                    <th>Precision</th>
                    <th>Recall</th>
                  </tr>
                </thead>
                <tbody>
                  {data.models.map((m) => {
                    const result = external ? m.external! : m.test;
                    return (
                      <tr key={m.model}>
                        <td>{names[m.model]}</td>
                        <td>{m.validation.average_precision.toFixed(3)}</td>
                        <td>{result.average_precision.toFixed(3)}</td>
                        <td>{result.brier.toFixed(4)}</td>
                        <td>{pct(result.precision)}</td>
                        <td>{pct(result.recall)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <label className="risk-select">
              Inspect a model
              <select
                aria-label="Risk model"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
              >
                {data.models.map((m) => (
                  <option key={m.model} value={m.model}>
                    {names[m.model]}
                  </option>
                ))}
              </select>
            </label>
            {selected && metric && (
              <>
                <div className="segment-kpis risk-kpis" aria-live="polite">
                  <div>
                    <span>True positive snapshots</span>
                    <strong>{number(metric.true_positive)}</strong>
                  </div>
                  <div>
                    <span>False positive snapshots</span>
                    <strong>{number(metric.false_positive)}</strong>
                  </div>
                  <div>
                    <span>Missed positive snapshots</span>
                    <strong>{number(metric.false_negative)}</strong>
                  </div>
                </div>
                <p className="risk-copy">
                  Decision threshold: {pct(selected.threshold)} estimated risk.
                  It was chosen to maximize F1 on validation only. This is an
                  experimental threshold, not a clinical cutoff.
                </p>
              </>
            )}
          </section>
          <section
            className="panel risk-panel"
            aria-labelledby="calibration-heading"
          >
            <div className="panel-heading">
              <div>
                <h2 id="calibration-heading">
                  Do estimated probabilities match outcomes?
                </h2>
                <p>
                  {names[modelName]} ·{" "}
                  {external ? "independent cohort" : "internal test"}. Small
                  bins can move substantially with a few outcomes.
                </p>
              </div>
            </div>
            <div
              className="utilization-chart"
              role="region"
              aria-label="Risk calibration chart"
              tabIndex={0}
            >
              <svg
                viewBox="0 0 850 280"
                role="img"
                aria-label="Mean estimated admission risk compared with observed outcome rate"
              >
                <line
                  x1="60"
                  y1="210"
                  x2="720"
                  y2="45"
                  stroke="#82908b"
                  strokeDasharray="6 4"
                />
                {[0, 1, 2, 3].map((i) => (
                  <g key={i}>
                    <line
                      x1="60"
                      x2="720"
                      y1={210 - i * 55}
                      y2={210 - i * 55}
                      stroke="#e7eeea"
                    />
                    <text
                      x="49"
                      y={214 - i * 55}
                      textAnchor="end"
                      className="axis-label"
                    >
                      {pct((limit * i) / 3)}
                    </text>
                    <text
                      x={60 + i * 220}
                      y="233"
                      textAnchor="middle"
                      className="axis-label"
                    >
                      {pct((limit * i) / 3)}
                    </text>
                  </g>
                ))}
                {bins
                  .filter((b) => b.snapshots > 0)
                  .map((b) => (
                    <circle
                      key={b.lower}
                      cx={x(b.mean_risk!)}
                      cy={y(b.observed_rate!)}
                      r="6"
                      fill="#347a67"
                    >
                      <title>
                        {b.snapshots} snapshots: mean risk {pct(b.mean_risk)},
                        observed {pct(b.observed_rate)}
                      </title>
                    </circle>
                  ))}
                <text
                  x="390"
                  y="264"
                  textAnchor="middle"
                  className="axis-label"
                >
                  Mean estimated risk
                </text>
                <text
                  transform="translate(14 130) rotate(-90)"
                  textAnchor="middle"
                  className="axis-label"
                >
                  Observed outcome rate
                </text>
              </svg>
            </div>
            <p className="risk-copy">
              The dashed line represents equal estimated and observed rates.
              Empty bins have no estimated outcome rate.
            </p>
            <div
              className="table-scroll"
              role="region"
              aria-label="Risk calibration values"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Estimated risk bin</th>
                    <th>Snapshots</th>
                    <th>Mean estimated risk</th>
                    <th>Observed outcome rate</th>
                  </tr>
                </thead>
                <tbody>
                  {bins.map((b) => (
                    <tr key={b.lower}>
                      <td>
                        {pct(b.lower)}–{pct(b.upper)}
                      </td>
                      <td>{number(b.snapshots)}</td>
                      <td>{pct(b.mean_risk)}</td>
                      <td>{pct(b.observed_rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      <section
        className="panel risk-panel"
        aria-labelledby="risk-features-heading"
      >
        <div className="panel-heading">
          <div>
            <h2 id="risk-features-heading">
              What the model can know at a snapshot
            </h2>
            <p>
              Features use earlier completed encounters and diagnosis codes
              whose onset and recorded dates both precede the snapshot. Current
              condition and medication statuses are excluded.
            </p>
          </div>
        </div>
        <ul className="risk-features">
          {data.features.map((f) => (
            <li key={f}>{features[f]}</li>
          ))}
        </ul>
        <details className="risk-method">
          <summary>Cohort rules, follow-up, and limitations</summary>
          <p>
            Quarterly snapshots use adults with at least 365 days since their
            first available encounter. Patients already in an inpatient episode
            are excluded. Overlapping/touching stays across providers are
            merged; a later non-touching stay is a new episode.
          </p>
          <p>
            Observation is attested through {data.observation_end} (exclusive)
            from the simulator configuration, not inferred from the last visit
            or verified enrollment. Deaths without an observed admission before
            the horizon are censored, not assigned a negative outcome. An
            observed admission before death remains positive. Undated deaths are
            excluded.
          </p>
          <p>
            {number(data.exclusions.censored)} snapshots were excluded for
            incomplete negative-outcome follow-up, and{" "}
            {number(data.exclusions.hospitalized_at_index)} for an ongoing
            inpatient episode. Recorded-date coverage:{" "}
            {number(data.conditions - data.undated_conditions)} /{" "}
            {number(data.conditions)} conditions. Event-dated reconstruction
            does not recreate every historical correction or real-world
            data-arrival delay.
          </p>
          <p>
            The pipeline standardizes features on training data only, then fits
            a fixed L2 logistic model. Baselines use training prevalence or
            prior-admission groups. No model is refitted or threshold adjusted
            on internal or independent test labels. Readiness requires 50
            positive training patients and 10 each in validation/test; those
            minimums do not establish statistical reliability. The independent
            simulator cohort checks robustness to another seed, not
            generalization to real patients.
          </p>
          <p>
            Protocol {data.protocol}. No individual feature rows, predictions,
            or model files are published.
          </p>
        </details>
      </section>
    </>
  );
}
