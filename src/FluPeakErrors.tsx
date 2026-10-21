import type { FluModel } from "./FluForecast";

type Phase = {
  phase: "before" | "peak" | "after";
  n: number;
  mae: number | null;
  bias: number | null;
  error_share: number | null;
};
export type PeakDiagnostics = {
  method: string;
  observed_peak: { week: string; count: number };
  peak_window: { start: string; end: string };
  by_horizon: {
    horizon: number;
    models: {
      model: FluModel;
      phases: Phase[];
      peak: {
        week: string;
        count: number;
        lag_weeks: number;
        count_error: number;
      };
    }[];
  }[];
};
const number = (n: number | null) =>
  n === null
    ? "—"
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
const signed = (n: number | null) =>
  n === null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 0,
        signDisplay: "exceptZero",
      }).format(n);
const date = (week: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(week));
const labels = {
  before: "Before peak window",
  peak: "Around the peak",
  after: "After peak window",
};

export default function FluPeakErrors({
  data,
  model,
  horizon,
  name,
}: {
  data: PeakDiagnostics;
  model: FluModel;
  horizon: number;
  name: string;
}) {
  const models = data.by_horizon.find((h) => h.horizon === horizon)!.models;
  const selected = models.find((m) => m.model === model)!;
  const baseline = models.find((m) => m.model === "last_value")!;
  const lag = selected.peak.lag_weeks;
  return (
    <section className="panel flu-panel" aria-labelledby="flu-peak-title">
      <div className="panel-heading">
        <div>
          <h2 id="flu-peak-title">Where did the forecast miss?</h2>
          <p>
            {name} · {horizon}-week horizon · follows the model and horizon
            controls above.
          </p>
        </div>
      </div>
      <p className="flu-detail">
        The observed peak was{" "}
        <strong>
          {number(data.observed_peak.count)} admissions on{" "}
          {date(data.observed_peak.week)}
        </strong>
        . “Around the peak” includes the two weeks on each side:{" "}
        {date(data.peak_window.start)}–{date(data.peak_window.end)}.
      </p>
      <div
        className="table-scroll"
        role="region"
        aria-label="Flu errors by peak period"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">Weeks</th>
              <th scope="col">Model MAE</th>
              <th scope="col">Persistence MAE</th>
              <th scope="col">Mean signed error</th>
              <th scope="col">Share of model error</th>
            </tr>
          </thead>
          <tbody>
            {selected.phases.map((phase, i) => (
              <tr key={phase.phase}>
                <th scope="row">{labels[phase.phase]}</th>
                <td>{phase.n}</td>
                <td>{number(phase.mae)}</td>
                <td>{number(baseline.phases[i].mae)}</td>
                <td>{signed(phase.bias)}</td>
                <td>
                  <span className="flu-error-share">
                    {phase.error_share === null
                      ? "—"
                      : new Intl.NumberFormat("en-US", {
                          style: "percent",
                          maximumFractionDigits: 1,
                        }).format(phase.error_share)}
                    <span className="flu-error-track" aria-hidden="true">
                      <span
                        style={{ width: `${(phase.error_share ?? 0) * 100}%` }}
                      />
                    </span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="flu-detail">
        MAE is average absolute error in admissions per week. Positive signed
        error means overprediction; negative means underprediction. Error share
        is the period’s absolute error divided by the model’s full-season
        absolute error at this horizon. Periods have different numbers of weeks,
        so share alone is not a measure of difficulty.
      </p>
      <div className="flu-score-strip">
        <span>
          Predicted curve peak<strong>{date(selected.peak.week)}</strong>
        </span>
        <span>
          Timing against observed peak
          <strong>
            {lag === 0
              ? "Same week"
              : `${Math.abs(lag)} week${Math.abs(lag) === 1 ? "" : "s"} ${lag > 0 ? "later" : "earlier"}`}
          </strong>
        </span>
        <span>
          Peak height error
          <strong>{signed(selected.peak.count_error)} admissions</strong>
        </span>
      </div>
      <details className="flu-detail">
        <summary>How to read peak timing</summary>
        <p>
          Peak timing compares the highest points of the observed series and the
          rolling prediction curve; the predictions come from successive
          forecast origins, not one season-long forecast. Ties use the earliest
          week. This retrospective breakdown was added after inspecting the
          holdout. Its five-week window is descriptive, not a tuned model
          setting or a new independent test. It shows where errors occur, not
          their cause; the frozen model choice, scores, and publication gate
          stay unchanged.
        </p>
      </details>
    </section>
  );
}
