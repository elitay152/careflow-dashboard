import { useState } from "react";
import {
  capacityLimits,
  defaultCapacity,
  planCapacity,
  type CapacityAssumptions,
} from "./capacity";
const number = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n);
const month = (s: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(s + "T00:00:00Z"));
const fields: {
  key: keyof CapacityAssumptions;
  label: string;
  hint: string;
}[] = [
  {
    key: "sessions",
    label: "Sessions per month",
    hint: "Dedicated to this cohort",
  },
  { key: "hours", label: "Hours per session", hint: "Scheduled block length" },
  {
    key: "visitMinutes",
    label: "Minutes per visit",
    hint: "Assumed appointment slot",
  },
  {
    key: "bookablePercent",
    label: "Bookable time (%)",
    hint: "Time left after other work",
  },
  {
    key: "demandChange",
    label: "Demand change (%)",
    hint: "What-if change to recorded visits",
  },
];
export default function CapacityPlanner({
  months,
  counts,
  label,
}: {
  months: string[];
  counts: number[];
  label: string;
}) {
  const [values, setValues] = useState<
    Record<keyof CapacityAssumptions, string>
  >(
    () =>
      Object.fromEntries(
        Object.entries(defaultCapacity).map(([k, v]) => [k, String(v)]),
      ) as Record<keyof CapacityAssumptions, string>,
  );
  const [showTable, setShowTable] = useState(false);
  const invalid = fields.filter(
    ({ key }) =>
      values[key].trim() === "" ||
      !Number.isInteger(Number(values[key])) ||
      Number(values[key]) < capacityLimits[key][0] ||
      Number(values[key]) > capacityLimits[key][1],
  );
  const assumptions = Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, Number(v)]),
  ) as CapacityAssumptions;
  const result = invalid.length ? null : planCapacity(counts, assumptions);
  const max = Math.max(
    1,
    result?.capacity ?? 0,
    ...counts,
    ...(result?.months.map((m) => m.scenario) ?? []),
  );
  const step = 730 / Math.max(1, months.length - 1),
    x = (i: number) => 55 + i * step,
    y = (n: number) => 210 - (165 * n) / max;
  return (
    <section
      className="panel capacity-panel"
      aria-labelledby="capacity-heading"
    >
      <div className="panel-heading">
        <div>
          <h2 id="capacity-heading">Plan an appointment block</h2>
          <p>
            {label} · {month(months[0])}–{month(months.at(-1)!)}
          </p>
        </div>
        <button
          className="text-link"
          onClick={() =>
            setValues(
              Object.fromEntries(
                Object.entries(defaultCapacity).map(([k, v]) => [k, String(v)]),
              ) as Record<keyof CapacityAssumptions, string>,
            )
          }
        >
          Reset assumptions
        </button>
      </div>
      <p className="capacity-intro">
        Replay these recorded months with a hypothetical appointment block
        dedicated to this cohort. All inputs below are assumptions. This is a
        what-if scenario, not a forecast or the facility’s actual staffing.
      </p>
      <div className="capacity-inputs">
        {fields.map(({ key, label, hint }) => (
          <label key={key}>
            {label}
            <input
              type="number"
              aria-label={label}
              min={capacityLimits[key][0]}
              max={capacityLimits[key][1]}
              step="1"
              value={values[key]}
              aria-invalid={invalid.some((f) => f.key === key)}
              aria-describedby={`capacity-${key}-hint`}
              onChange={(e) =>
                setValues((v) => ({ ...v, [key]: e.target.value }))
              }
            />
            <small id={`capacity-${key}-hint`}>{hint}</small>
          </label>
        ))}
      </div>
      {!result ? (
        <p className="note demand-note" role="alert">
          Enter whole numbers within the displayed limits:{" "}
          {invalid
            .map(
              (f) =>
                `${f.label} (${capacityLimits[f.key][0]} to ${capacityLimits[f.key][1]})`,
            )
            .join(", ")}
          . Results are hidden until the assumptions are valid.
        </p>
      ) : (
        <>
          <div
            className="segment-kpis capacity-kpis"
            role="status"
            aria-live="polite"
          >
            <div>
              <span>Appointment slots per month</span>
              <strong>{number(result.capacity)}</strong>
            </div>
            <div>
              <span>Months above assumed capacity</span>
              <strong>
                {result.monthsOverCapacity} of {months.length}
              </strong>
            </div>
            <div>
              <span>Scenario visits above capacity</span>
              <strong>{number(result.totalShortfall)}</strong>
            </div>
          </div>
          <p className="capacity-explanation">
            {result.slotsPerSession} whole slots per session ×{" "}
            {assumptions.sessions} sessions = {result.capacity} slots/month,
            using {result.scheduledHours} scheduled hours. At peak scenario
            demand ({result.peak} visits),{" "}
            {result.peakSessions === null
              ? "no finite number of these sessions can cover demand because each session has zero usable slots"
              : `${result.peakSessions} sessions would be needed`}
            . Monthly shortfalls are separate; visits are not carried into later
            months.
          </p>
          <div className="forecast-legend">
            <span>
              <i style={{ background: "#63869b" }} />
              Recorded encounters
            </span>
            <span>
              <i style={{ background: "#347a67" }} />
              Scenario visits
            </span>
            <span>
              <i style={{ background: "#ac8b51" }} />
              Assumed appointment capacity
            </span>
          </div>
          <div
            className="utilization-chart"
            role="region"
            aria-label="Appointment capacity scenario chart"
            tabIndex={0}
          >
            <svg
              viewBox="0 0 850 270"
              role="img"
              aria-label="Recorded monthly encounters and scenario visits compared with assumed appointment capacity"
            >
              {[0, 1, 2, 3].map((t) => (
                <g key={t}>
                  <line
                    x1="50"
                    x2="795"
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
              {result.months.map((m, i) => (
                <g key={months[i]}>
                  <rect
                    x={x(i) - Math.min(12, step / 5)}
                    y={y(m.recorded)}
                    width={Math.min(12, step / 5)}
                    height={210 - y(m.recorded)}
                    fill="#63869b"
                    rx="2"
                  />
                  <rect
                    x={x(i)}
                    y={y(m.scenario)}
                    width={Math.min(12, step / 5)}
                    height={210 - y(m.scenario)}
                    fill="#347a67"
                    rx="2"
                  />
                  <title>
                    {month(months[i])}: {m.recorded} recorded, {m.scenario}{" "}
                    scenario visits, {m.capacity} slots, {m.shortfall} above
                    capacity
                  </title>
                  {(i % 2 === 0 || i === months.length - 1) && (
                    <text
                      x={x(i)}
                      y="242"
                      textAnchor="middle"
                      className="axis-label"
                    >
                      {month(months[i])}
                    </text>
                  )}
                </g>
              ))}
              <line
                x1="50"
                x2="795"
                y1={y(result.capacity)}
                y2={y(result.capacity)}
                stroke="#ac8b51"
                strokeWidth="2"
                strokeDasharray="6 4"
              />
            </svg>
          </div>
          <details className="capacity-definitions">
            <summary>Calculation and scope</summary>
            <p>
              Each ambulatory encounter uses one equal-length slot. Each session
              is one clinician’s block; concurrent blocks count as separate
              sessions. Whole slots are rounded down separately for each
              session: floor(hours × 60 × bookable fraction ÷ minutes per
              visit). Scenario visits are rounded up after applying your demand
              change. A shortfall is max(scenario visits − slots, 0). Unused
              slots in another month do not offset it. Counts cover only loaded
              synthetic patients; these are not whole-facility utilization,
              waiting-time, or staffing estimates. Missing months are not
              treated as zero. No model predictions or measured encounter
              durations are used to set appointment length.
            </p>
          </details>
          <button
            className="text-link"
            aria-expanded={showTable}
            onClick={() => setShowTable((v) => !v)}
          >
            {showTable ? "Hide" : "View"} monthly capacity values
          </button>
          {showTable && (
            <div
              className="table-scroll"
              role="region"
              aria-label="Monthly appointment capacity values"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Recorded encounters</th>
                    <th>Scenario visits</th>
                    <th>Assumed slots</th>
                    <th>Above capacity</th>
                    <th>Unused slots</th>
                  </tr>
                </thead>
                <tbody>
                  {result.months.map((m, i) => (
                    <tr key={months[i]}>
                      <td>{months[i]}</td>
                      <td>{m.recorded}</td>
                      <td>{m.scenario}</td>
                      <td>{m.capacity}</td>
                      <td>{m.shortfall}</td>
                      <td>{m.spare}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
