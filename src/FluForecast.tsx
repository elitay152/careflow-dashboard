import { useState } from "react";
import FluIntervals, {
  intervalBounds,
  type IntervalEvidence,
} from "./FluIntervals";
import FluPeakErrors, { type PeakDiagnostics } from "./FluPeakErrors";

export type FluModel =
  | "last_value"
  | "seasonal_naive"
  | "damped_growth"
  | "seasonal_autoreg";
type Prediction = { week: string; horizon: number; actual: number } & Record<
  FluModel,
  number
>;
type Scores = { n: number; mae: number; rmse: number; wape: number | null };
type ModelScores = Scores & {
  model: FluModel;
  by_horizon: (Scores & { horizon: number })[];
};
export type FluSnapshot = {
  generated_at: string;
  source: {
    name: string;
    data_url: string;
    documentation_url: string;
    license_url: string;
    license_notice: string;
    attribution: string;
    verified_at: string;
    revision: string;
    quality: { rows: number; locations: number; missing_state_values: number };
  };
  protocol: {
    protocol: string;
    holdout: { season: string; start: string; end: string };
    validation: { season: string; start: string; end: string }[];
  };
  history: { week: string; count: number }[];
  evaluation: {
    selected_model: FluModel;
    intervals: IntervalEvidence;
    validation: { metrics: ModelScores[] };
    holdout: {
      targets: number;
      forecasts: number;
      predictions: Prediction[];
      metrics: ModelScores[];
      peak_diagnostics: PeakDiagnostics;
    };
    publication: { status: string; reason: string };
    forecast: { week: string; horizon: number; prediction: number }[] | null;
  };
  limitations: string[];
};
const names: Record<FluModel, string> = {
  last_value: "Last-week persistence",
  seasonal_naive: "Last year's week",
  damped_growth: "Damped recent growth",
  seasonal_autoreg: "Seasonal autoregression",
};
const number = (x: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(x);
const percent = (x: number | null) =>
  x === null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "percent",
        maximumFractionDigits: 1,
      }).format(x);
const date = (x: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(x));
function External({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children} ↗
    </a>
  );
}

function Chart({
  rows,
  label,
  model,
  baseline = false,
  peakWindow,
  intervalLabel,
}: {
  rows: {
    week: string;
    actual: number;
    prediction?: number;
    lower?: number;
    upper?: number;
    baseline?: number;
  }[];
  label: string;
  model?: string;
  baseline?: boolean;
  peakWindow?: { start: string; end: string };
  intervalLabel?: string;
}) {
  const max = Math.max(
    1,
    ...rows.flatMap((r) => [
      r.actual,
      r.prediction ?? 0,
      r.upper ?? 0,
      baseline ? (r.baseline ?? 0) : 0,
    ]),
  );
  const x = (i: number) => 64 + (i * 780) / Math.max(1, rows.length - 1),
    y = (n: number) => 250 - (n * 216) / max;
  const shaded = rows.flatMap((r, i) =>
    peakWindow && r.week >= peakWindow.start && r.week <= peakWindow.end
      ? [i]
      : [],
  );
  const step = 780 / Math.max(1, rows.length - 1);
  const path = (key: "actual" | "prediction" | "baseline") =>
    rows.map((r, i) => `${i ? "L" : "M"}${x(i)},${y(r[key] ?? 0)}`).join(" ");
  const ticks = [
    ...new Set([
      0,
      Math.floor((rows.length - 1) / 4),
      Math.floor((rows.length - 1) / 2),
      Math.floor(((rows.length - 1) * 3) / 4),
      rows.length - 1,
    ]),
  ];
  return (
    <>
      <div className="flu-chart-legend">
        {intervalLabel && (
          <span>
            <i className="flu-interval-band" />
            {intervalLabel}
          </span>
        )}
        {peakWindow && (
          <span>
            <i className="flu-peak-window" />
            Observed peak ±2 weeks
          </span>
        )}
        <span>
          <i className="flu-observed" />
          Observed admissions
        </span>
        {model && (
          <span>
            <i className="flu-predicted" />
            {model}
          </span>
        )}
        {baseline && (
          <span>
            <i className="flu-baseline" />
            Last-week persistence
          </span>
        )}
      </div>
      <svg
        className="flu-chart"
        viewBox="0 0 900 300"
        role="img"
        aria-label={label}
      >
        <title>{label}</title>
        {shaded.length > 0 && (
          <rect
            x={Math.max(64, x(shaded[0]) - step / 2)}
            y="34"
            width={
              Math.min(844, x(shaded.at(-1)!) + step / 2) -
              Math.max(64, x(shaded[0]) - step / 2)
            }
            height="216"
            fill="#f5e6c9"
          >
            <title>
              Observed peak window: two weeks before and after the peak
            </title>
          </rect>
        )}
        {intervalLabel && (
          <path
            d={`${rows.map((r, i) => `${i ? "L" : "M"}${x(i)},${y(r.upper!)}`).join(" ")} ${rows
              .map((_, i) => {
                const j = rows.length - 1 - i;
                return `L${x(j)},${y(rows[j].lower!)}`;
              })
              .join(" ")} Z`}
            fill="#317b6b"
            fillOpacity="0.15"
          >
            <title>{intervalLabel}; calibrated on earlier seasons</title>
          </path>
        )}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line
              x1="64"
              x2="844"
              y1={y(max * f)}
              y2={y(max * f)}
              stroke="#e0e8e3"
            />
            <text x="54" y={y(max * f) + 4} textAnchor="end">
              {new Intl.NumberFormat("en-US", {
                notation: "compact",
                maximumFractionDigits: 0,
              }).format(max * f)}
            </text>
          </g>
        ))}
        {ticks.map((i) => (
          <text
            key={i}
            x={x(i)}
            y="278"
            textAnchor={
              i === 0 ? "start" : i === rows.length - 1 ? "end" : "middle"
            }
          >
            {new Intl.DateTimeFormat("en-US", {
              month: "short",
              year: "2-digit",
              timeZone: "UTC",
            }).format(new Date(rows[i].week))}
          </text>
        ))}
        <path
          d={path("actual")}
          fill="none"
          stroke="#205a4b"
          strokeWidth="2.7"
        />
        {model && (
          <path
            d={path("prediction")}
            fill="none"
            stroke="#b17b47"
            strokeWidth="2.4"
            strokeDasharray="7 4"
          />
        )}
        {baseline && (
          <path
            d={path("baseline")}
            fill="none"
            stroke="#728c9a"
            strokeWidth="1.8"
            strokeDasharray="2 4"
          />
        )}
        {rows.map((r, i) => (
          <circle key={r.week} cx={x(i)} cy={y(r.actual)} r="3" fill="#205a4b">
            <title>
              {date(r.week)}: {number(r.actual)} observed
              {r.prediction === undefined
                ? ""
                : `; ${number(r.prediction)} predicted`}
            </title>
          </circle>
        ))}
      </svg>
    </>
  );
}

export default function FluForecast({ data }: { data: FluSnapshot }) {
  const e = data.evaluation,
    selected = e.selected_model;
  const [horizon, setHorizon] = useState(1),
    [model, setModel] = useState<FluModel>(selected),
    [baseline, setBaseline] = useState(true),
    [values, setValues] = useState(false),
    [intervalLevel, setIntervalLevel] = useState("80");
  const band =
    intervalLevel === "none"
      ? undefined
      : e.intervals.by_horizon
          .find((h) => h.horizon === horizon)!
          .models.find((m) => m.model === model)!
          .bands.find((b) => b.level === Number(intervalLevel))!;
  const selectedScores = e.holdout.metrics.find((m) => m.model === selected)!;
  const persistence = e.holdout.metrics.find((m) => m.model === "last_value")!;
  const rows = e.holdout.predictions.filter((r) => r.horizon === horizon);
  const compared = e.holdout.metrics
    .find((m) => m.model === model)!
    .by_horizon.find((h) => h.horizon === horizon)!;
  return (
    <>
      <section className="note flu-source-note">
        <strong>Observed public data · United States.</strong> Weekly newly
        reported admissions with laboratory-confirmed influenza, sourced from
        CDC/NHSN via FluSight. This series is separate from the synthetic FHIR
        cohort. It measures admissions, not bed occupancy or unique patients.
      </section>
      <div className="flu-kpis">
        <article>
          <span>Latest pinned week</span>
          <strong>{date(data.history.at(-1)!.week)}</strong>
          <small>
            {number(data.history.at(-1)!.count)} reported admissions
          </small>
        </article>
        <article>
          <span>Selected using earlier seasons</span>
          <strong>{names[selected]}</strong>
          <small>2023/24 + 2024/25 validation</small>
        </article>
        <article>
          <span>Selected-model holdout MAE</span>
          <strong>{number(selectedScores.mae)}</strong>
          <small>Admissions · pooled 1–4-week horizons</small>
        </article>
        <article>
          <span>Persistence holdout MAE</span>
          <strong>{number(persistence.mae)}</strong>
          <small>Admissions · same targets and horizons</small>
        </article>
      </div>
      <section className="panel flu-panel" aria-labelledby="flu-holdout-title">
        <div className="panel-heading">
          <div>
            <h2 id="flu-holdout-title">Replay the held-out flu season</h2>
            <p>
              {date(data.protocol.holdout.start)}–
              {date(data.protocol.holdout.end)} · {e.holdout.targets} observed
              weeks · model choice was frozen before scoring this season.
            </p>
          </div>
        </div>
        <div className="flu-controls">
          <label>
            Forecast horizon
            <select
              aria-label="Flu forecast horizon"
              value={horizon}
              onChange={(event) => setHorizon(Number(event.target.value))}
            >
              {[1, 2, 3, 4].map((h) => (
                <option key={h} value={h}>
                  {h} week{h === 1 ? "" : "s"} after the origin week
                </option>
              ))}
            </select>
          </label>
          <label>
            Inspect a model
            <select
              aria-label="Flu comparison model"
              value={model}
              onChange={(event) => setModel(event.target.value as FluModel)}
            >
              {Object.entries(names).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                  {key === selected ? " · validation selection" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Prediction band
            <select
              aria-label="Flu prediction band"
              value={intervalLevel}
              onChange={(event) => setIntervalLevel(event.target.value)}
            >
              <option value="80">Nominal 80%</option>
              <option value="95">Nominal 95%</option>
              <option value="none">Hide band</option>
            </select>
          </label>
          <label className="flu-checkbox">
            <input
              type="checkbox"
              checked={baseline}
              onChange={(event) => setBaseline(event.target.checked)}
            />
            Show persistence baseline
          </label>
        </div>
        <Chart
          rows={rows.map((r) => ({
            week: r.week,
            actual: r.actual,
            prediction: r[model],
            baseline: r.last_value,
            ...(band ? intervalBounds(r[model], band.radius) : {}),
          }))}
          intervalLabel={
            band ? `Nominal ${band.level}% prediction band` : undefined
          }
          peakWindow={e.holdout.peak_diagnostics.peak_window}
          model={names[model]}
          baseline={baseline && model !== "last_value"}
          label={`${horizon}-week flu admission holdout: observed counts and ${names[model]}`}
        />
        <div className="flu-score-strip">
          <span>
            Mean absolute error{" "}
            <strong>{number(compared.mae)} admissions</strong>
          </span>
          <span>
            Weighted absolute error <strong>{percent(compared.wape)}</strong>
          </span>
          <span>
            Forecast cases <strong>{compared.n}</strong>
          </span>
        </div>
        <p className="flu-detail">
          Rolling forecasts use only observations before each forecast origin.
          Earlier observations from the holdout become available for later
          forecasts. This revised-data replay does not simulate historical
          reporting delays or data revisions.
        </p>
        <button
          type="button"
          className="text-link"
          aria-expanded={values}
          onClick={() => setValues(!values)}
        >
          {values
            ? "Hide weekly forecast values"
            : "Show weekly forecast values"}
        </button>
        {values && (
          <div
            className="table-scroll"
            role="region"
            aria-label="Weekly flu forecast values"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Week ending</th>
                  <th scope="col">Observed</th>
                  <th scope="col">{names[model]}</th>
                  <th scope="col">Absolute error</th>
                  {band && (
                    <>
                      <th scope="col">Lower bound</th>
                      <th scope="col">Upper bound</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.week}>
                    <td>{date(r.week)}</td>
                    <td>{number(r.actual)}</td>
                    <td>{number(r[model])}</td>
                    <td>{number(Math.abs(r.actual - r[model]))}</td>
                    {band && (
                      <>
                        <td>
                          {number(intervalBounds(r[model], band.radius).lower)}
                        </td>
                        <td>
                          {number(intervalBounds(r[model], band.radius).upper)}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {band && (
        <FluIntervals
          data={e.intervals}
          horizon={horizon}
          model={model}
          band={band}
          name={names[model]}
        />
      )}
      <FluPeakErrors
        data={e.holdout.peak_diagnostics}
        model={model}
        horizon={horizon}
        name={names[model]}
      />
      <section className="panel flu-panel" aria-labelledby="flu-models-title">
        <div className="panel-heading">
          <div>
            <h2 id="flu-models-title">Selection and holdout results</h2>
            <p>
              Mean absolute error in admissions, pooled equally across 1–4-week
              forecast cases. Lower is better. Weekly and horizon errors are
              correlated.
            </p>
          </div>
        </div>
        <div
          className="table-scroll"
          role="region"
          aria-label="Flu model comparison"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">Validation MAE</th>
                <th scope="col">Holdout MAE</th>
                <th scope="col">Holdout WAPE</th>
              </tr>
            </thead>
            <tbody>
              {e.validation.metrics.map((v) => {
                const held = e.holdout.metrics.find(
                  (h) => h.model === v.model,
                )!;
                return (
                  <tr
                    key={v.model}
                    className={v.model === selected ? "flu-selected" : ""}
                  >
                    <th scope="row">
                      {names[v.model]}
                      {v.model === selected && (
                        <small>Selected on validation</small>
                      )}
                    </th>
                    <td>{number(v.mae)}</td>
                    <td>{number(held.mae)}</td>
                    <td>{percent(held.wape)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="flu-detail">
          Persistence performed better than the validation winner on the
          holdout. The selected model remains unchanged; the holdout does not
          choose a replacement winner.
        </p>
      </section>
      {e.forecast ? (
        <section className="panel flu-panel">
          <div className="panel-heading">
            <div>
              <h2>Four-week research projection</h2>
              <p>
                Origin: last pinned observation,{" "}
                {date(data.history.at(-1)!.week)}. Point estimates have no
                estimated uncertainty intervals.
              </p>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Week ending</th>
                  <th scope="col">Projected admissions</th>
                </tr>
              </thead>
              <tbody>
                {e.forecast.map((r) => (
                  <tr key={r.week}>
                    <td>{date(r.week)}</td>
                    <td>{number(r.prediction)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="note">
          <strong>Future projection withheld.</strong> {e.publication.reason}{" "}
          The publication rule was fixed before holdout scoring.
        </section>
      )}
      <section className="panel flu-panel">
        <details>
          <summary>Explore the observed source history</summary>
          <p className="flu-detail">
            {data.history.length} consecutive national weeks. Missing
            state-level values ({data.source.quality.missing_state_values}) are
            not filled with zero; state series are not modeled here.
          </p>
          <Chart
            rows={data.history.map((r) => ({ week: r.week, actual: r.count }))}
            label="Observed weekly national influenza admissions, February 2022 through October 2026"
          />
        </details>
      </section>
      <section className="panel flu-panel">
        <details>
          <summary>Protocol, source, and reuse notice</summary>
          <div className="flu-method">
            <p>
              Protocol <code>{data.protocol.protocol}</code> selects the lowest
              pooled validation MAE across two earlier seasons. Each origin fits
              only past data. Seasonal autoregression uses log counts, recent
              lags, a 52-week lag, annual calendar terms, and fixed ridge
              regularization.
            </p>
            <p>{data.source.attribution}</p>
            <p>
              <External href={data.source.data_url}>Pinned source CSV</External>{" "}
              ·{" "}
              <External href={data.source.documentation_url}>
                NHSN reporting definitions
              </External>{" "}
              ·{" "}
              <External href={data.source.license_url}>
                Upstream repository MIT notice
              </External>
            </p>
            <p>
              Snapshot verified {date(data.source.verified_at)}. This is a
              pinned retrospective dataset, not a live reporting feed.
            </p>
            <ul>
              {data.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <details>
              <summary>View retained upstream license notice</summary>
              <pre>{data.source.license_notice}</pre>
            </details>
          </div>
        </details>
      </section>
    </>
  );
}
