import { useEffect, useRef, useState } from "react";
import { Expand, Info, RotateCcw, X } from "lucide-react";

type Dimension =
  | "age_band"
  | "gender"
  | "clinical_profile"
  | "utilization_band";
type Cell = Record<Dimension, string> & {
  patient_count: number;
  seen_patients: number;
  encounter_count: number;
  active_request_count: number;
};
type Segments = {
  start_month: string;
  end_month_exclusive: string;
  age_as_of: string;
  cells: Cell[];
};
const labels: Record<Dimension, Record<string, string>> = {
  age_band: {
    "0_17": "Under 18",
    "18_34": "18–34",
    "35_49": "35–49",
    "50_64": "50–64",
    "65_79": "65–79",
    "80_plus": "80+",
    unknown: "Unknown",
  },
  gender: {
    female: "Female",
    male: "Male",
    other: "Other",
    unknown: "Unknown",
  },
  clinical_profile: {
    diabetes_and_hypertension: "Type 2 diabetes + hypertension",
    diabetes_without_hypertension: "Type 2 diabetes recorded",
    hypertension_without_diabetes: "Hypertension recorded",
    other_selected_chronic: "Other selected chronic concepts",
    no_selected_chronic: "No selected chronic record",
  },
  utilization_band: {
    none: "No encounters",
    one: "1 encounter",
    two_to_five: "2–5 encounters",
    six_plus: "6+ encounters",
  },
};
const dimensionNames: Record<Dimension, string> = {
  age_band: "Age band",
  gender: "Recorded gender",
  clinical_profile: "Clinical profile",
  utilization_band: "Encounter frequency",
};
const initial: Record<Dimension, string> = {
  age_band: "all",
  gender: "all",
  clinical_profile: "all",
  utilization_band: "all",
};
const dimensions = Object.keys(labels) as Dimension[];
const number = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
const date = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));

export default function CohortExplorer({
  data,
  totalPatients,
}: {
  data: Segments | null;
  totalPatients: number;
}) {
  const [filters, setFilters] = useState(initial);
  const [view, setView] = useState<"definitions" | "results" | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (view && element && !element.open) element.showModal();
    else if (!view && element?.open) element.close();
  }, [view]);
  if (!data) return null;
  const matches = (cell: Cell, except?: Dimension) =>
    dimensions.every(
      (key) =>
        key === except || filters[key] === "all" || cell[key] === filters[key],
    );
  const selected = data.cells.filter((cell) => matches(cell));
  const sum = (
    key:
      | "patient_count"
      | "seen_patients"
      | "encounter_count"
      | "active_request_count",
  ) => selected.reduce((s, r) => s + r[key], 0);
  const patients = sum("patient_count"),
    seen = sum("seen_patients"),
    encounters = sum("encounter_count"),
    requests = sum("active_request_count");
  const choose = (key: Dimension, value: string) =>
    setFilters((current) => ({
      ...current,
      [key]: current[key] === value ? "all" : value,
    }));
  const isFiltered = dimensions.some((key) => filters[key] !== "all");
  return (
    <section
      className="panel segment-explorer"
      aria-labelledby="explorer-heading"
    >
      <div className="panel-heading">
        <div>
          <h2 id="explorer-heading">Explore patient segments</h2>
          <p>
            Combine filters to explore this synthetic cohort; compare its
            distributions below.
          </p>
        </div>
        <div className="explorer-actions">
          <button
            className="button secondary"
            onClick={() => setView("definitions")}
          >
            <Info size={15} aria-hidden="true" />
            Definitions
          </button>
          <button
            className="button secondary"
            onClick={() => setView("results")}
          >
            <Expand size={15} aria-hidden="true" />
            Expand results
          </button>
        </div>
      </div>
      <div className="explorer-content">
        <p className="explorer-filter-note">
          Filters update this explorer only. The trend and condition charts show
          the full cohort.
        </p>
        <div className="segment-filters">
          {dimensions.map((key) => (
            <label key={key}>
              {dimensionNames[key]}
              <select
                aria-label={`Filter ${dimensionNames[key].toLowerCase()}`}
                value={filters[key]}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
              >
                <option value="all">All</option>
                {Object.entries(labels[key]).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="segment-selection">
          <p role="status">
            {number(patients)} of {number(totalPatients)} patients selected (
            {number(totalPatients ? (patients / totalPatients) * 100 : 0)}%).
          </p>
          <button
            className="text-link"
            disabled={!isFiltered}
            onClick={() => setFilters(initial)}
          >
            <RotateCcw size={13} aria-hidden="true" />
            Reset filters
          </button>
        </div>
        <div className="segment-kpis">
          <div>
            <span>Patients selected</span>
            <strong>{number(patients)}</strong>
          </div>
          <div>
            <span>Patients with encounters</span>
            <strong>{number(seen)}</strong>
          </div>
          <div>
            <span>Encounters per seen patient</span>
            <strong>{seen ? number(encounters / seen) : "—"}</strong>
          </div>
          <div>
            <span>Recorded active prescriptions</span>
            <strong>{number(requests)}</strong>
          </div>
        </div>
        {!patients && (
          <p className="segment-empty">
            No patients match these filters. Try a different combination or
            reset the filters.
          </p>
        )}
        <details className="segment-distributions">
          <summary>
            Compare segment distributions
            <span>Age, gender, clinical profile, and encounter frequency</span>
          </summary>
          <div className="segment-charts">
            {dimensions.map((key) => {
              const eligible = data.cells.filter((cell) => matches(cell, key));
              const bars = Object.entries(labels[key]).map(
                ([value, label]) => ({
                  value,
                  label,
                  count: eligible
                    .filter((cell) => cell[key] === value)
                    .reduce((sum, cell) => sum + cell.patient_count, 0),
                }),
              );
              const max = Math.max(1, ...bars.map((bar) => bar.count));
              return (
                <section
                  key={key}
                  data-dimension={key}
                  aria-label={`${dimensionNames[key]} distribution`}
                >
                  <h3>
                    {key === "age_band"
                      ? "Age at simulation cutoff"
                      : dimensionNames[key]}
                  </h3>
                  <p>
                    Counts reflect the other filters. Click again to clear a
                    selection.
                  </p>
                  {bars.map((bar) => (
                    <button
                      className="segment-bar"
                      key={bar.value}
                      data-segment={bar.value}
                      aria-label={`${dimensionNames[key]}: ${bar.label}, ${bar.count} patients`}
                      aria-pressed={filters[key] === bar.value}
                      onClick={() => choose(key, bar.value)}
                    >
                      <span>
                        <span>{bar.label}</span>
                        <strong>{number(bar.count)}</strong>
                      </span>
                      <span className="segment-track">
                        <span
                          style={{ width: `${(bar.count / max) * 100}%` }}
                        />
                      </span>
                    </button>
                  ))}
                </section>
              );
            })}
          </div>
        </details>
        <p className="explorer-scope">
          Age is calculated at {date(data.age_as_of)} for all loaded patients,
          including deceased patients. Visit counts use the same latest-12-month
          KPI window; active prescriptions and clinical profiles use recorded
          snapshot statuses.
        </p>
      </div>
      <dialog
        ref={dialog}
        className="explorer-dialog"
        aria-labelledby="explorer-dialog-title"
        onClose={() => setView(null)}
      >
        <div className="explorer-dialog-heading">
          <h2 id="explorer-dialog-title">
            {view === "definitions"
              ? "What these filters mean"
              : "Selected aggregate segments"}
          </h2>
          <button
            className="dialog-close"
            aria-label="Close explorer popout"
            onClick={() => dialog.current?.close()}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {view === "definitions" ? (
          <div className="explorer-definitions">
            <p>
              <strong>Age and gender.</strong> Age bands use birth dates at the
              simulation cutoff, not today's date or age at death. The cohort
              includes deceased patients. Gender is the administrative value
              recorded in FHIR, not an inferred identity.
            </p>
            <p>
              <strong>Clinical profiles.</strong> Groups are mutually exclusive
              and use active/recurrent/relapsed, confirmed SNOMED records. Type
              2 diabetes uses code 44054006 and essential hypertension 59621000.
              The first three groups separate patients with both recorded
              concepts from those with only one of these two. Other qualifying
              concepts use the project's 19-code chronic subset.
            </p>
            <p>
              <strong>Missing diagnoses.</strong> “No selected chronic record”
              means no qualifying code in that subset; it does not establish
              that a patient is healthy. Clinical profiles are a recorded
              snapshot, not historical diagnoses as of each visit.
            </p>
            <p>
              <strong>Encounters.</strong> Finished encounters from{" "}
              {date(data.start_month)} to {date(data.age_as_of)} inclusive.
              Patients without encounters remain in the cohort. Encounters per
              seen patient divides the selected encounter total by selected
              patients with encounters.
            </p>
            <p>
              <strong>Prescriptions.</strong> Requests currently recorded as
              active, without a date filter. Counts do not establish dispensing,
              administration, or adherence.
            </p>
            <p>
              <strong>Charts and privacy.</strong> Each bar reflects the other
              filters so you can change a selection. Results contain aggregate
              cells only, without patient identifiers, exact ages, or individual
              records. This is synthetic data, not a de-identification system
              for real records. Filtered medians are not computed by averaging
              group medians.
            </p>
          </div>
        ) : view === "results" ? (
          <>
            <p>
              {number(patients)} patients across {selected.length} matching
              aggregate cells. Each patient belongs to exactly one cell.
            </p>
            <p className="selected-filter-label">
              {dimensions
                .map(
                  (key) =>
                    `${dimensionNames[key]}: ${filters[key] === "all" ? "All" : labels[key][filters[key]]}`,
                )
                .join(" · ")}
            </p>
            <div
              className="table-scroll"
              role="region"
              aria-label="Aggregate segment results"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Age band</th>
                    <th>Recorded gender</th>
                    <th>Clinical profile</th>
                    <th>Encounter frequency</th>
                    <th>Patients</th>
                    <th>Seen</th>
                    <th>Encounters</th>
                    <th>Active requests</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.map((cell) => (
                    <tr key={dimensions.map((key) => cell[key]).join("|")}>
                      {dimensions.map((key) => (
                        <td key={key}>{labels[key][cell[key]]}</td>
                      ))}
                      <td>{number(cell.patient_count)}</td>
                      <td>{number(cell.seen_patients)}</td>
                      <td>{number(cell.encounter_count)}</td>
                      <td>{number(cell.active_request_count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!selected.length && (
              <p>No aggregate segments match this selection.</p>
            )}
          </>
        ) : null}
      </dialog>
    </section>
  );
}
