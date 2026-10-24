import { useState } from "react";
import ReadmissionFinding, { type ReviewBudget } from "./ReadmissionFinding";
import { ArrowUpRight } from "lucide-react";

type Calibration = {
  lower: number;
  upper: number;
  n: number;
  positives: number;
  mean_probability: number | null;
  observed_rate: number | null;
};
type Metrics = {
  n: number;
  positives: number;
  prevalence: number;
  average_precision: number;
  roc_auc: number;
  brier: number;
  calibration: Calibration[];
  review: ReviewBudget[];
};
export type ReadmissionEvidence = {
  status: "not_run" | "completed";
  generated_at: string | null;
  reason?: string;
  protocol: {
    prediction_time: string;
    numeric_features: string[];
    categorical_features: string[];
    evaluation_role: string;
  };
  source?: {
    page_url: string;
    license_url: string;
    attribution: string;
    csv_sha256: string;
    source_pinned: boolean;
  };
  quality?: {
    source_rows: number;
    source_patients: number;
    eligible_encounters: number;
    eligible_patients: number;
    excluded_encounters: number;
  };
  evaluation?: {
    selected_model: string;
    splits: {
      split: string;
      encounters: number;
      patients: number;
      positives: number;
    }[];
    models: { model: string; validation: Metrics; test: Metrics }[];
  };
  limitations?: string[];
};
const names: Record<string, string> = {
  prevalence: "Training prevalence",
  prior_inpatient: "Prior inpatient visits",
  logistic: "Logistic regression",
  boosting: "Gradient boosting",
};
const number = (v: number, digits = 0) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(v);
const pct = (v: number | null) =>
  v === null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "percent",
        maximumFractionDigits: 1,
      }).format(v);
function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      className="text-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <ArrowUpRight size={14} aria-hidden="true" />
    </a>
  );
}
export default function ReadmissionStudy({
  data,
}: {
  data: ReadmissionEvidence;
}) {
  const [model, setModel] = useState(
    data.evaluation?.selected_model ?? "logistic",
  );
  const [split, setSplit] = useState<"validation" | "test">("test");
  if (data.status === "not_run")
    return (
      <section
        className="panel readmission-panel"
        aria-labelledby="readmission-pending"
      >
        <div className="panel-heading">
          <div>
            <h2 id="readmission-pending">Awaiting the first UCI benchmark</h2>
            <p>No real-data model results have been published yet.</p>
          </div>
        </div>
        <p>
          At discharge, can we identify encounters with a recorded readmission
          in less than 30 days? The deployment workflow fetches UCI dataset 296,
          verifies the source and license link, and evaluates fixed models on
          patient-separated data.
        </p>
        <p>
          Results appear only after that workflow succeeds. An unsuccessful
          fetch or evaluation blocks the new deployment; it does not turn
          synthetic results into UCI results.
        </p>
        <div className="readmission-links">
          <Link href="https://archive.ics.uci.edu/dataset/296/diabetes+130-us+hospitals+for+years+1999-2008">
            UCI dataset
          </Link>
          <Link href="https://github.com/elitay152/careflow-dashboard/actions">
            Deployment runs
          </Link>
        </div>
        <details>
          <summary>Planned evaluation</summary>
          <p>
            {data.protocol.prediction_time}. Models: training prevalence, prior
            inpatient visits, logistic regression, and gradient boosting.
            Selection uses validation average precision. The test is grouped by
            patient, with no chronological or independent-hospital claim.
          </p>
          <p>
            This is a new observed-data study, separate from the synthetic
            90-day inpatient experiment available above.
          </p>
        </details>
      </section>
    );
  const e = data.evaluation!,
    q = data.quality!,
    source = data.source!;
  const metrics = e.models.find((m) => m.model === model)![split];
  const baseline = e.models[0][split];
  const reviewed = e.splits.find((s) => s.split === split)!;
  return (
    <div className="readmission-study">
      <section className="note">
        <strong>Observed public data · UCI hospital encounters.</strong>{" "}
        Patients with diabetes, 1999–2008. This is discharge-time readmission
        risk, separate from the synthetic FHIR cohort. The label records
        readmission in less than 30 days; it does not establish preventability.
      </section>
      <div className="readmission-kpis">
        <article>
          <span>Eligible encounters</span>
          <strong>{number(q.eligible_encounters)}</strong>
          <small>{number(q.eligible_patients)} patients · all ages</small>
        </article>
        <article>
          <span>
            {split === "test" ? "Test" : "Validation"} readmission rate
          </span>
          <strong>{pct(metrics.prevalence)}</strong>
          <small>
            {number(metrics.positives)} of {number(metrics.n)} encounters
          </small>
        </article>
        <article>
          <span>Selected using validation only</span>
          <strong>{names[e.selected_model]}</strong>
          <small>Highest average precision among four fixed candidates</small>
        </article>
      </div>
      <div className="readmission-controls readmission-study-controls">
        <label>
          Evaluation split
          <select
            aria-label="Readmission evaluation split"
            value={split}
            onChange={(event) =>
              setSplit(event.target.value as "validation" | "test")
            }
          >
            <option value="test">Patient-held-out test</option>
            <option value="validation">Validation</option>
          </select>
        </label>
        <label>
          Inspect a model
          <select
            aria-label="Readmission model"
            value={model}
            onChange={(event) => setModel(event.target.value)}
          >
            {e.models.map((m) => (
              <option key={m.model} value={m.model}>
                {names[m.model]}
                {m.model === e.selected_model ? " · validation selection" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ReadmissionFinding
        budget={metrics.review.find((r) => r.capacity === 0.2)!}
        model={names[model]}
        split={split}
      />
      <section
        className="panel readmission-panel"
        aria-labelledby="readmission-models-title"
      >
        <div className="panel-heading">
          <div>
            <h2 id="readmission-models-title">What does the model add?</h2>
            <p>
              Average precision measures ranking for the minority outcome; Brier
              score measures probability error. Higher AP and lower Brier are
              better.
            </p>
          </div>
        </div>

        <p>
          The {split} split contains {number(reviewed.encounters)} encounters
          from {number(reviewed.patients)} patients. Each patient belongs to
          exactly one split. The ranking baseline for average precision is this
          split’s positive rate: {pct(baseline.average_precision)}.
        </p>
        <div
          className="table-scroll"
          role="region"
          aria-label="Readmission model comparison"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">Validation AP</th>
                <th scope="col">
                  {split === "test" ? "Test" : "Validation"} AP
                </th>
                <th scope="col">AUROC</th>
                <th scope="col">Brier</th>
              </tr>
            </thead>
            <tbody>
              {e.models.map((m) => (
                <tr
                  key={m.model}
                  className={
                    m.model === e.selected_model ? "readmission-selected" : ""
                  }
                >
                  <th scope="row">
                    {names[m.model]}
                    {m.model === e.selected_model && (
                      <small>Validation selection</small>
                    )}
                  </th>
                  <td>{number(m.validation.average_precision, 3)}</td>
                  <td>{number(m[split].average_precision, 3)}</td>
                  <td>{number(m[split].roc_auc, 3)}</td>
                  <td>{number(m[split].brier, 3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Changing the comparison does not select or refit a new winner. No
          model is assumed useful merely because the dataset contains real
          encounters.
        </p>
      </section>
      <section
        className="panel readmission-panel"
        aria-labelledby="readmission-review-title"
      >
        <div className="panel-heading">
          <div>
            <h2 id="readmission-review-title">If review capacity is limited</h2>
            <p>
              {names[model]} · {split} encounters ranked by predicted risk
            </p>
          </div>
        </div>
        <div
          className="table-scroll"
          role="region"
          aria-label="Readmission review capacity"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Capacity</th>
                <th scope="col">Reviewed</th>
                <th scope="col">Readmissions captured</th>
                <th scope="col">Precision</th>
                <th scope="col">Recall</th>
              </tr>
            </thead>
            <tbody>
              {metrics.review.map((r) => (
                <tr key={r.capacity}>
                  <th scope="row">Highest-risk {pct(r.capacity)}</th>
                  <td>{number(r.reviewed)}</td>
                  <td>{number(r.captured)}</td>
                  <td>{pct(r.precision)}</td>
                  <td>{pct(r.recall)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          These are retrospective ranking budgets, not thresholds validated for
          clinical use. Ties use a fixed identifier hash independent of
          outcomes. Capturing a readmission does not mean it could have been
          prevented.
        </p>
      </section>
      <section
        className="panel readmission-panel"
        aria-labelledby="readmission-calibration-title"
      >
        <div className="panel-heading">
          <div>
            <h2 id="readmission-calibration-title">
              Do predicted probabilities match outcomes?
            </h2>
            <p>
              {names[model]} · fixed 10-percentage-point bins · empty bins
              remain empty
            </p>
          </div>
        </div>
        <svg
          className="readmission-calibration-chart"
          viewBox="0 0 400 270"
          role="img"
          aria-label={`${names[model]} calibration: observed readmission rates against mean predicted risk`}
        >
          <title>
            Fixed 0–100% axes. Dots are populated probability bins; the diagonal
            is the perfect-calibration reference.
          </title>
          {[0, 0.5, 1].map((v) => (
            <g key={v}>
              <line
                x1="62"
                x2="372"
                y1={216 - v * 180}
                y2={216 - v * 180}
                stroke="#e1e8e0"
              />
              <text x="52" y={221 - v * 180} textAnchor="end">
                {pct(v)}
              </text>
              <text
                x={62 + v * 310}
                y="240"
                textAnchor={v === 0 ? "start" : v === 1 ? "end" : "middle"}
              >
                {pct(v)}
              </text>
            </g>
          ))}
          <text x="62" y="20">
            Observed readmission rate
          </text>
          <text x="372" y="264" textAnchor="end">
            Mean predicted risk
          </text>
          <line
            x1="62"
            y1="216"
            x2="372"
            y2="36"
            stroke="#7b8b82"
            strokeDasharray="5 5"
          />
          {metrics.calibration
            .filter((b) => b.n > 0)
            .map((b) => (
              <circle
                key={b.lower}
                cx={62 + b.mean_probability! * 310}
                cy={216 - b.observed_rate! * 180}
                r="5"
                fill="#205a4b"
              >
                <title>
                  {number(b.n)} encounters; mean prediction{" "}
                  {pct(b.mean_probability)}, observed {pct(b.observed_rate)}
                </title>
              </circle>
            ))}
        </svg>
        <p>
          Dots summarize populated bins. The dashed diagonal represents perfect
          calibration, not a fitted result. Exact counts and rates are in the
          table.
        </p>
        <div
          className="table-scroll"
          role="region"
          aria-label="Readmission calibration values"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Predicted-risk bin</th>
                <th scope="col">Encounters</th>
                <th scope="col">Mean predicted risk</th>
                <th scope="col">Observed rate</th>
              </tr>
            </thead>
            <tbody>
              {metrics.calibration.map((b) => (
                <tr key={b.lower}>
                  <th scope="row">
                    {pct(b.lower)}–{pct(b.upper)}
                  </th>
                  <td>{number(b.n)}</td>
                  <td>{pct(b.mean_probability)}</td>
                  <td>{pct(b.observed_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Calibration here is measured, not corrected on the test set. Repeated
          encounters within patients make observations correlated; no confidence
          intervals are claimed.
        </p>
      </section>
      <section className="panel readmission-panel">
        <details>
          <summary>Cohort, features, and evaluation boundaries</summary>
          <p>
            {number(q.source_rows)} source encounters from{" "}
            {number(q.source_patients)} patients;{" "}
            {number(q.excluded_encounters)} encounters excluded for death or
            hospice discharge. No patient appears in more than one split.
          </p>
          <div
            className="table-scroll"
            role="region"
            aria-label="Readmission cohort splits"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Split</th>
                  <th scope="col">Encounters</th>
                  <th scope="col">Patients</th>
                  <th scope="col">Positive encounters</th>
                </tr>
              </thead>
              <tbody>
                {e.splits.map((s) => (
                  <tr key={s.split}>
                    <th scope="row">{s.split}</th>
                    <td>{number(s.encounters)}</td>
                    <td>{number(s.patients)}</td>
                    <td>{number(s.positives)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            {data.protocol.prediction_time}. Features include prior utilization,
            index-stay duration, test/procedure/medication counts, age bands,
            recorded gender, admission/discharge categories, selected treatments
            and lab-result categories, and coarse ICD-9 diagnosis groups.
          </p>
          <p>
            Identifiers and outcome labels are excluded from predictors. Race,
            payer, weight, and medical specialty are not used. Imputation,
            scaling, and category encoding fit on training data only. These
            features are not a validated socioeconomic or severity assessment.
          </p>
          <ul>
            {data.limitations!.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </details>
      </section>
      <section className="panel readmission-panel">
        <details>
          <summary>Source and reproducibility</summary>
          <p>{source.attribution}</p>
          <div className="readmission-links">
            <Link href={source.page_url}>UCI source</Link>
            <Link href={source.license_url}>CC BY 4.0</Link>
            <Link href="https://github.com/elitay152/Careflow/blob/main/docs/readmission.md">
              Protocol and reproduction
            </Link>
          </div>
          <p>
            Evaluated{" "}
            {new Date(data.generated_at!).toLocaleString("en-US", {
              timeZone: "UTC",
            })}{" "}
            UTC. Source{" "}
            {source.source_pinned
              ? "matched the configured SHA-256 pin"
              : "checksum was recorded without a preconfigured byte pin"}
            .
          </p>
          <p className="readmission-fingerprint">
            CSV SHA-256: {source.csv_sha256}
          </p>
          <p>
            No individual encounter rows, patient IDs, individual probabilities,
            or fitted model files are exported.
          </p>
        </details>
      </section>
    </div>
  );
}
