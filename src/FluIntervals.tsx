import type { FluModel } from "./FluForecast";

type IntervalMetrics = {
  n: number;
  coverage: number | null;
  mean_width: number | null;
  below: number;
  above: number;
  mean_interval_score: number | null;
};
export type IntervalBand = {
  level: number;
  radius: number;
  metrics: IntervalMetrics;
  by_phase: (IntervalMetrics & { phase: "before" | "peak" | "after" })[];
};
export type IntervalEvidence = {
  protocol: {
    calibration_start: string;
    calibration_end: string;
    evaluation_role: string;
    guarantee: string;
  };
  protocol_sha256: string;
  by_horizon: {
    horizon: number;
    calibration_n: number;
    quantile_ranks: { level: number; rank: number }[];
    models: { model: FluModel; bands: IntervalBand[] }[];
  }[];
};
export const intervalBounds = (point: number, radius: number) => ({
  lower: Math.max(0, Math.floor(point - radius)),
  upper: Math.ceil(point + radius),
});
const number = (n: number | null) =>
  n === null
    ? "—"
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
const percent = (n: number | null) =>
  n === null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "percent",
        maximumFractionDigits: 1,
      }).format(n);
const labels = {
  before: "Before peak window",
  peak: "Around the peak",
  after: "After peak window",
};

export default function FluIntervals({
  data,
  horizon,
  model,
  band,
  name,
}: {
  data: IntervalEvidence;
  horizon: number;
  model: FluModel;
  band: IntervalBand;
  name: string;
}) {
  const h = data.by_horizon.find((h) => h.horizon === horizon)!;
  const persistence = h.models
    .find((m) => m.model === "last_value")!
    .bands.find((b) => b.level === band.level)!;
  const m = band.metrics;
  return (
    <section className="panel flu-panel" aria-labelledby="flu-interval-title">
      <div className="panel-heading">
        <div>
          <h2 id="flu-interval-title">How often did the range hold?</h2>
          <p>
            {name} · {horizon}-week horizon · nominal {band.level}% prediction
            band
          </p>
        </div>
      </div>
      <p className="flu-detail">
        The observed count fell inside this range in{" "}
        <strong>
          {m.n - m.below - m.above} of {m.n} weeks ({percent(m.coverage)})
        </strong>
        , against a nominal target of {band.level}%. “Nominal” is the
        calibration level, not a guarantee for a particular week.
      </p>
      <div className="flu-score-strip">
        <span>
          Observed coverage<strong>{percent(m.coverage)}</strong>
        </span>
        <span>
          Average band width<strong>{number(m.mean_width)} admissions</strong>
        </span>
        <span>
          Weeks outside the range
          <strong>
            {m.below + m.above} of {m.n}
          </strong>
        </span>
      </div>
      <p className="flu-detail">
        Observed admissions were below the lower bound in {m.below} weeks and
        above the upper bound in {m.above} weeks. Wider bands can cover more
        observations; coverage should be read alongside width.
      </p>
      <div
        className="table-scroll"
        role="region"
        aria-label="Flu interval coverage by peak period"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">Weeks</th>
              <th scope="col">Observed coverage</th>
              <th scope="col">Average width</th>
            </tr>
          </thead>
          <tbody>
            {band.by_phase.map((p) => (
              <tr key={p.phase}>
                <th scope="row">{labels[p.phase]}</th>
                <td>{p.n}</td>
                <td>{percent(p.coverage)}</td>
                <td>{number(p.mean_width)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {model !== "last_value" && (
        <p className="flu-detail">
          At this horizon and nominal level, persistence covers{" "}
          {percent(persistence.metrics.coverage)} of weeks with an average width
          of {number(persistence.metrics.mean_width)} admissions. This
          comparison does not select a replacement model.
        </p>
      )}
      <details className="flu-detail">
        <summary>How the bands are calibrated</summary>
        <p>
          Each model and horizon uses {h.calibration_n} earlier weekly absolute
          prediction errors, ending June 7, 2025. The radius is the error at
          rank {h.quantile_ranks.find((r) => r.level === band.level)!.rank} of
          the sorted errors ({number(band.radius)} admissions). Radii stay fixed
          throughout the holdout. Lower bounds are clipped at zero and both
          bounds are rounded outward to whole admissions.
        </p>
        <p>
          Mean interval score: <strong>{number(m.mean_interval_score)}</strong>.
          Lower is better at the same nominal level and on the same target
          weeks; the score penalizes both width and missed observations.
        </p>
        <p>
          This interval experiment was specified after the point-forecast
          holdout had been inspected. Earlier seasons also contributed to model
          selection. Temporal dependence, changing seasons, and revised
          reporting prevent a guaranteed coverage claim. These are retrospective
          uncertainty diagnostics, not a fresh independent test or clinical
          planning ranges. Point forecasts, model selection, and the
          future-projection gate remain unchanged.
        </p>
      </details>
    </section>
  );
}
