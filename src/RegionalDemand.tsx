import { useState } from "react";

type Metrics = {
  model: string;
  mae: number;
  rmse: number;
  wape: number | null;
};
type Forecast = {
  held_out_metrics: Metrics[] | null;
  evaluation: {
    selected_model: string;
    validation_metrics: Metrics[];
    test_predictions: ({ encounter_month: string; actual: number } & Record<
      string,
      string | number
    >)[];
  } | null;
};
type Group = {
  scope: string;
  key: string;
  label: string;
  care_setting: string;
  counts: number[];
  annual_count: number;
  eligible: boolean;
  forecast: Forecast | null;
};
export type DemandSnapshot = {
  months: string[];
  facility_count: number;
  coverage: {
    annual_finished_encounters: number;
    annual_matched_provider_encounters: number;
    annual_assigned_zip_encounters: number;
  };
  hospitalization: { annual_encounters: number; annual_patients: number };
  groups: Group[];
};
const names: Record<string, string> = {
  seasonal_naive: "Last year's month",
  seasonal_mean: "Five-year seasonal mean",
  seasonal_trend: "Seasonal trend",
  damped_trend: "Damped trend",
  poisson_seasonal: "Poisson seasonal",
};
const settings: Record<string, string> = {
  ambulatory: "Ambulatory visits",
  emergency: "Emergency visits",
  inpatient: "Inpatient encounters",
  other: "Other recorded encounters",
};
const number = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n);
const month = (s: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(s + "T00:00:00Z"));

export default function RegionalDemand({
  data,
}: {
  data: DemandSnapshot | null;
}) {
  const [scope, setScope] = useState("facility");
  const [setting, setSetting] = useState("ambulatory");
  const [chosen, setChosen] = useState("");
  const [showValues, setShowValues] = useState(false);
  if (!data)
    return (
      <p className="note demand-note">
        No enriched demand data is available. Rebuild the warehouse and refresh
        the export.
      </p>
    );
  const annualStart = new Date(data.months.at(-1)! + "T00:00:00Z");
  annualStart.setUTCMonth(annualStart.getUTCMonth() - 11);
  const observedAnnualMonths = data.months.filter(
    (m) => m >= annualStart.toISOString().slice(0, 10),
  ).length;
  const groups = data.groups
    .filter((g) => g.scope === scope && g.care_setting === setting)
    .sort(
      (a, b) =>
        b.annual_count - a.annual_count || a.label.localeCompare(b.label),
    );
  const selected = groups.find((g) => g.key === chosen) ?? groups[0];
  const evaluation = selected?.forecast?.evaluation;
  const metrics = selected?.forecast?.held_out_metrics;
  const chosenMetric = metrics?.find(
    (m) => m.model === evaluation?.selected_model,
  );
  const comparison = evaluation?.test_predictions ?? [];
  const counts = selected?.counts.slice(-36) ?? [];
  const months = data.months.slice(-counts.length);
  const max = Math.max(
    1,
    ...counts,
    ...comparison.flatMap((r) => [
      Number(r.seasonal_naive),
      Number(r[evaluation!.selected_model]),
    ]),
  );
  const x = (i: number) => 50 + (i * 730) / Math.max(1, counts.length - 1);
  const y = (v: number) => 210 - (v / max) * 165;
  const line = (values: number[], offset = 0) =>
    values.map((v, i) => `${i ? "L" : "M"}${x(i + offset)},${y(v)}`).join(" ");
  const matched = data.coverage.annual_finished_encounters
    ? (100 * data.coverage.annual_matched_provider_encounters) /
      data.coverage.annual_finished_encounters
    : 0;
  return (
    <>
      <p className="note demand-note">
        <strong>Demand within this synthetic cohort.</strong> Counts are
        finished encounters at the provider facility, not patients, staffed
        beds, or the facility’s full workload. ZIP areas use the provider’s
        first three ZIP digits, not the patient’s address. Provider names are
        reference data; patient activity and facility assignments are simulated.
      </p>
      <section className="panel demand-panel" aria-labelledby="demand-heading">
        <div className="panel-heading">
          <div>
            <h2 id="demand-heading">Explore demand by facility</h2>
            <p>
              Choose a care setting and a facility, or zoom out to its ZIP area.
            </p>
          </div>
        </div>
        <div className="demand-filters">
          <label>
            Group by
            <select
              aria-label="Demand grouping"
              value={scope}
              onChange={(e) => {
                setScope(e.target.value);
                setChosen("");
              }}
            >
              <option value="facility">Facility</option>
              <option value="zip_area">Facility ZIP area</option>
            </select>
          </label>
          <label>
            Care setting
            <select
              aria-label="Demand care setting"
              value={setting}
              onChange={(e) => {
                setSetting(e.target.value);
                setChosen("");
              }}
            >
              {Object.entries(settings).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {scope === "facility" ? "Facility" : "ZIP area"}
            <select
              aria-label="Demand location"
              value={selected?.key ?? ""}
              disabled={!groups.length}
              onChange={(e) => setChosen(e.target.value)}
            >
              {groups.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label} · {number(g.annual_count)} encounters
                </option>
              ))}
            </select>
          </label>
        </div>
        {!selected ? (
          <p className="empty-message">
            No recorded encounters for this setting in the latest 12 months.
          </p>
        ) : (
          <>
            <div className="segment-kpis demand-kpis">
              <div>
                <span>Encounters · latest 12 months</span>
                <strong>{number(selected.annual_count)}</strong>
              </div>
              <div>
                <span>Average per observed month</span>
                <strong>
                  {number(selected.annual_count / observedAnnualMonths)}
                </strong>
              </div>
              <div>
                <span>Model comparison</span>
                <strong>
                  {selected.eligible ? "Available" : "Sparse history"}
                </strong>
              </div>
            </div>
            <h3 className="demand-chart-title">
              {settings[setting]} · {selected.label}
            </h3>
            <p className="kpi-caption">
              Finished encounters per month · recorded counts over the latest{" "}
              {counts.length} observed months.
            </p>
            {evaluation && (
              <div className="forecast-legend">
                <span>
                  <i style={{ background: "#347a67" }} />
                  Recorded encounters
                </span>
                <span>
                  <i style={{ background: "#798a95" }} />
                  Last year's month
                </span>
                {evaluation.selected_model !== "seasonal_naive" && (
                  <span>
                    <i style={{ background: "#a07030" }} />
                    {names[evaluation.selected_model]}
                  </span>
                )}
              </div>
            )}
            <div
              className="utilization-chart"
              role="region"
              aria-label="Selected location demand chart"
              tabIndex={0}
            >
              <svg
                viewBox="0 0 850 270"
                role="img"
                aria-label={`${settings[setting]} per month at ${selected.label}`}
              >
                {[0, 1, 2, 3].map((t) => (
                  <g key={t}>
                    <line
                      x1="50"
                      x2="790"
                      y1={45 + t * 55}
                      y2={45 + t * 55}
                      stroke="#e7eeea"
                      strokeDasharray="4 5"
                    />
                    <text
                      x="40"
                      y={49 + t * 55}
                      textAnchor="end"
                      className="axis-label"
                    >
                      {number((max * (3 - t)) / 3)}
                    </text>
                  </g>
                ))}
                <path
                  d={line(counts)}
                  fill="none"
                  stroke="#347a67"
                  strokeWidth="2.5"
                />
                {counts.map((n, i) => (
                  <circle
                    key={months[i]}
                    cx={x(i)}
                    cy={y(n)}
                    r="3"
                    fill="#347a67"
                  >
                    <title>
                      {month(months[i])}: {n} recorded encounters
                    </title>
                  </circle>
                ))}
                {evaluation &&
                  comparison.length > 0 &&
                  [
                    "seasonal_naive",
                    ...(evaluation.selected_model === "seasonal_naive"
                      ? []
                      : [evaluation.selected_model]),
                  ].map((model, i) => (
                    <path
                      key={model}
                      d={line(
                        comparison.map((row) => Number(row[model])),
                        counts.length - comparison.length,
                      )}
                      fill="none"
                      stroke={i ? "#a07030" : "#798a95"}
                      strokeWidth="2"
                      strokeDasharray="6 4"
                    />
                  ))}
                {months.map(
                  (m, i) =>
                    (i % 6 === 0 || i === months.length - 1) && (
                      <text
                        key={m}
                        x={x(i)}
                        y="240"
                        textAnchor="middle"
                        className="axis-label"
                      >
                        {month(m)}
                      </text>
                    ),
                )}
              </svg>
            </div>
            {selected.eligible && evaluation && chosenMetric ? (
              <>
                <p className="note demand-note">
                  <strong>Retrospective model comparison.</strong> Dashed
                  estimates for {month(data.months.at(-12)!)}–
                  {month(data.months.at(-1)!)} use earlier data. Earlier
                  validation selected{" "}
                  {names[evaluation.selected_model].toLowerCase()}; its
                  benchmark MAE is {number(chosenMetric.mae)} encounters per
                  month. This previously inspected period is a development
                  benchmark; future predictions remain withheld.
                </p>
                <div
                  className="table-scroll"
                  role="region"
                  aria-label="Location model comparison"
                  tabIndex={0}
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Model</th>
                        <th>Earlier-window MAE</th>
                        <th>Benchmark MAE</th>
                        <th>Benchmark WAPE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics!.map((m) => (
                        <tr key={m.model}>
                          <td>
                            {names[m.model]}
                            {m.model === evaluation.selected_model
                              ? " (selected)"
                              : ""}
                          </td>
                          <td>
                            {number(
                              evaluation.validation_metrics.find(
                                (v) => v.model === m.model,
                              )!.mae,
                            )}
                          </td>
                          <td>{number(m.mae)}</td>
                          <td>
                            {m.wape === null ? "—" : number(m.wape * 100) + "%"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="note demand-note amber">
                <strong>
                  Not enough recorded activity for model comparison.
                </strong>{" "}
                We require 120 consecutive globally observed months, at least
                120 encounters in the latest year, activity in 10 of those 12
                months, and 36 active months in the preceding 60. This threshold
                is a display guard, not proof of forecast reliability. Recorded
                history remains visible.
              </p>
            )}
            <button
              className="text-link"
              aria-expanded={showValues}
              onClick={() => setShowValues(!showValues)}
            >
              {showValues ? "Hide" : "View"} recorded demand values
            </button>
            {showValues && (
              <div
                className="table-scroll"
                role="region"
                aria-label="Recorded location demand values"
                tabIndex={0}
              >
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Recorded encounters</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.months.map((m, i) => (
                      <tr key={m}>
                        <td>{m}</td>
                        <td>{selected.counts[i]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
      <p className="note demand-note">
        <strong>Coverage and next steps.</strong> {number(data.facility_count)}{" "}
        provider organizations are loaded; {number(matched)}% of latest-year
        encounters resolve to one. Only locations with recorded encounters in
        the latest year appear in the selector. Zero counts mean no recorded
        cohort encounters in a globally observed month; they do not establish
        that a facility was open or had no other patients. Facility and ZIP
        views overlap and must not be added.
      </p>
      <p className="note demand-note">
        <strong>Hospitalization prediction is not trained.</strong> The latest
        year contains {number(data.hospitalization.annual_encounters)} inpatient
        encounters among {number(data.hospitalization.annual_patients)}{" "}
        patients. More independent admission events, dated features, and
        follow-up checks are needed before building a patient risk model.
        Reference bed counts are retained privately; this subset of patients
        cannot establish whole-hospital occupancy.
      </p>
    </>
  );
}
