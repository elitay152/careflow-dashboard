import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  Download,
  FileJson,
  FlaskConical,
  Code2 as Github,
  HeartPulse,
  Info,
  Layers,
  LayoutDashboard,
  Menu,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import snapshot from "../public/data/careflow.json";
import CohortExplorer from "./CohortExplorer";
import RegionalDemand from "./RegionalDemand";
import RiskOverview, { type RiskSummary } from "./RiskOverview";

const current = snapshot.current;
const archive = snapshot.archive;
const source = "https://github.com/elitay152/Careflow";
const supported = new Set([
  "Patient",
  "Encounter",
  "Condition",
  "MedicationRequest",
  "Organization",
  "Observation",
]);
const number = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
const utc = (value: string | null, time = true) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        ...(time
          ? { hour: "2-digit" as const, minute: "2-digit" as const }
          : {}),
        timeZone: "UTC",
      }).format(new Date(value)) + (time ? " UTC" : "")
    : "Not recorded";
const month = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));

const duration = (minutes: number | null) => {
  if (minutes === null) return "Unavailable";
  const days = minutes >= 1440;
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(minutes / (days ? 1440 : 60))} ${days ? "days" : "h"}`;
};
const medianDuration = (minutes: number | null) =>
  minutes === null ? "Unavailable" : `${number(minutes)} min`;

const nav = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    eyebrow: "A DATA ENGINEERING PORTFOLIO",
    title: "Careflow.",
    accent: "Built to show my work.",
    description:
      "A custom portfolio project built with agentic development, using synthetic healthcare data to demonstrate an ETL pipeline and example metrics.",
  },
  {
    id: "cohort",
    label: "Simulated cohort",
    icon: Users,
    eyebrow: "KNOW THE SOURCE",
    title: "A fictional population.",
    accent: "A measurable foundation.",
    description:
      "Explore what the validated Synthea cohort contains, and exactly which resources the platform supports.",
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    eyebrow: "ANALYTICS",
    title: "Inside the cohort",
    accent: "",
    description:
      "Explore visits, encounter durations, conditions, and prescriptions across the synthetic dataset.",
  },
  {
    id: "agent",
    label: "Analytics agent",
    icon: Bot,
    eyebrow: "GROUNDED BY DESIGN",
    title: "Ask the numbers.",
    accent: "Keep the evidence.",
    description:
      "See how the baseline assistant answers a supported question with a metric definition and source citation.",
  },
  {
    id: "forecasting",
    label: "Forecasting",
    icon: FlaskConical,
    eyebrow: "EXPERIMENTAL FORECASTING",
    title: "Monthly encounter forecasts",
    accent: "",
    description:
      "Explore monthly finished encounters by facility, care setting, or provider ZIP area. This forecasts visits, not unique patients; one patient can have multiple encounters.",
  },
  {
    id: "risk",
    label: "Inpatient risk study",
    icon: HeartPulse,
    eyebrow: "PATIENT-LEVEL MODEL STUDY",
    title: "Inpatient episodes within 90 days",
    accent: "",
    description:
      "A synthetic-data experiment predicting a new inpatient episode from earlier patient history. Readiness, baselines, and evaluation are shown together.",
  },
  {
    id: "health",
    label: "Pipeline health",
    icon: Activity,
    eyebrow: "SHOW THE WORK",
    title: "Evidence over",
    accent: "green status lights.",
    description:
      "Inspect recorded pipeline outcomes, source watermarks, and export timestamps. This is a snapshot, not live telemetry.",
  },
] as const;
type Page = (typeof nav)[number]["id"];
const getPage = (): Page =>
  nav.some((item) => item.id === location.hash.slice(1))
    ? (location.hash.slice(1) as Page)
    : "overview";

function Icon({
  icon: Component,
  size = 18,
  ...props
}: {
  icon: LucideIcon;
  size?: number;
  className?: string;
}) {
  return (
    <Component size={size} strokeWidth={1.7} aria-hidden="true" {...props} />
  );
}
function Badge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: "green" | "neutral" | "amber";
}) {
  return (
    <span className={`badge ${tone}`}>
      <span className="badge-dot" />
      {children}
    </span>
  );
}
function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="panel-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
function Metric({
  label,
  value,
  note,
  icon,
  tone = "green",
}: {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
  tone?: string;
}) {
  return (
    <article className="metric">
      <div className="metric-label">
        {label}
        <span className={`metric-icon ${tone}`}>
          <Icon icon={icon} />
        </span>
      </div>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}
function Note({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "amber";
}) {
  return (
    <div className={`note ${tone}`}>
      <Icon icon={Info} size={17} />
      <div>{children}</div>
    </div>
  );
}
function External({
  href,
  children,
  className = "text-link",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <Icon icon={ArrowUpRight} size={15} />
    </a>
  );
}

function Overview() {
  const loaded =
    current.counts.patients +
    current.counts.encounters +
    current.counts.conditions +
    current.counts.medications +
    current.counts.observations +
    (snapshot.demand?.facility_count ?? 0);
  const quality = current.quality;
  const domains = [
    {
      label: "Encounters",
      value: current.counts.encounters,
      color: "var(--teal)",
    },
    {
      label: "Medication requests",
      value: current.counts.medications,
      color: "var(--mint)",
    },
    {
      label: "Conditions",
      value: current.counts.conditions,
      color: "var(--blue)",
    },
    { label: "Patients", value: current.counts.patients, color: "var(--gold)" },
    {
      label: "Selected observations",
      value: current.counts.observations,
      color: "#b78259",
    },
    {
      label: "Provider organizations",
      value: snapshot.demand?.facility_count ?? 0,
      color: "#9480a0",
    },
  ].sort((a, b) => b.value - a.value);
  return (
    <>
      <section className="author-intro" aria-labelledby="author-heading">
        <div className="author-role">
          FORMER NURSE
          <br />
          DATA ENGINEER
        </div>
        <div>
          <h2 id="author-heading">Hi, I’m Eli Taylor.</h2>
          <p>
            I’m a former nurse turned data engineer. My work spans healthcare
            data pipelines, reporting automation, and data quality using Python,
            SQL, Snowflake, Databricks, and dbt.
          </p>
          <p>
            I’m also pursuing a Doctor of Information Technology with an AI
            concentration. Careflow brings my healthcare background and
            engineering experience together in a project I can share openly.
          </p>
          <p>
            This is a custom portfolio project built with an agentic development
            workflow. I use synthetic data to demonstrate the pipeline end to
            end, from FHIR records and PostgreSQL to dbt quality checks and the
            analytics you can explore here.
          </p>
          <a
            className="text-link"
            href={source}
            target="_blank"
            rel="noopener noreferrer"
          >
            Explore the project on GitHub <Icon icon={ArrowUpRight} size={15} />
          </a>
        </div>
      </section>
      <div className="evidence-banner">
        <div>
          <Icon icon={Database} />
          <span>Validated Synthea cohort</span>
          <span className="divider" />
          <span>{current.label}</span>
        </div>
        <span>Exported · {utc(snapshot.exported_at)}</span>
      </div>
      <div className="metrics-grid">
        <Metric
          label="Simulated patients"
          value={number(current.counts.patients)}
          note="Fictional people. No real patient data."
          icon={Users}
        />
        <Metric
          label="Supported records loaded"
          value={number(loaded)}
          note="Across six persisted FHIR resource types"
          icon={Layers}
          tone="blue"
        />
        <Metric
          label="Data quality checks"
          value={
            quality.status === "unverified"
              ? "—"
              : `${quality.checks_passed} / ${quality.checks_total}`
          }
          note="From the current warehouse build"
          icon={ShieldCheck}
        />
        <Metric
          label="Quarantined records"
          value={number(current.counts.quarantine)}
          note="Rejected records retained for inspection"
          icon={CheckCircle2}
          tone="gold"
        />
      </div>
      <div className="overview-grid">
        <Panel
          title="Healthcare data domains"
          subtitle="Loaded rows in the current PostgreSQL cohort"
          action={
            <a href="#cohort" className="text-link">
              Explore cohort <Icon icon={ArrowUpRight} size={15} />
            </a>
          }
        >
          <div className="domain-chart">
            {domains.map((item) => (
              <div className="domain-row" key={item.label}>
                <div>
                  <span>{item.label}</span>
                  <strong>{number(item.value)}</strong>
                </div>
                <div className="bar-track">
                  <div
                    style={{
                      width: `${(item.value / Math.max(...domains.map((d) => d.value))) * 100}%`,
                      background: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="panel-foot">
            <span className="mini-dot" />
            Six supported resource types are persisted, including selected
            Observations and provider organizations.
          </div>
        </Panel>
        <Panel
          className="trust-panel"
          title="Trust is in the details"
          subtitle="Evidence attached to this aggregate snapshot"
        >
          <div className="trust-mark">
            <ShieldCheck size={46} strokeWidth={1.3} />
            <div>
              <strong>Source → warehouse</strong>
              <span>Recorded build evidence</span>
            </div>
          </div>
          <ul className="checklist">
            <li>
              <Icon icon={Check} />
              Aggregate-only public export
            </li>
            <li>
              <Icon icon={Check} />
              Source and build timestamps included
            </li>
            <li>
              <Icon icon={Check} />
              No database credentials in the browser
            </li>
            <li>
              <Icon icon={Check} />
              {quality.models_passed ?? "—"} models +{" "}
              {quality.checks_passed ?? "—"} passed dbt checks
            </li>
          </ul>
          <a
            className="text-link"
            href={`${import.meta.env.BASE_URL}data/careflow.json`}
            download
          >
            Download current aggregate evidence
          </a>
        </Panel>
      </div>
      <Panel
        title="From source to something you can explain"
        subtitle="A complete pipeline, with a boundary at every step"
        action={
          <a href="#health" className="text-link">
            Pipeline evidence <Icon icon={ArrowUpRight} size={15} />
          </a>
        }
      >
        <div className="pipeline-flow">
          {[
            {
              icon: FileJson,
              step: "01",
              label: "Ingest",
              text: "Synthetic FHIR R4 bundles",
              tags: "Validation · quarantine",
            },
            {
              icon: Database,
              step: "02",
              label: "Load",
              text: "Transactional PostgreSQL",
              tags: "Provenance · safe reruns",
            },
            {
              icon: Workflow,
              step: "03",
              label: "Transform",
              text: "dbt models + Dagster jobs",
              tags: "Tests · orchestration",
            },
            {
              icon: Sparkles,
              step: "04",
              label: "Explore",
              text: "Analytics + grounded assistant",
              tags: "Aggregates · citations",
            },
          ].map((item, index) => (
            <div className="flow-item" key={item.step}>
              <div className="flow-top">
                <span className="flow-icon">
                  <Icon icon={item.icon} size={22} />
                </span>
                <span>{item.step}</span>
                {index < 3 && <Icon icon={ArrowRight} className="flow-arrow" />}
              </div>
              <h3>{item.label}</h3>
              <p>{item.text}</p>
              <small>{item.tags}</small>
            </div>
          ))}
        </div>
      </Panel>
      <div className="cohort-callout">
        <div className="callout-icon">
          <Icon icon={BarChart3} size={24} />
        </div>
        <div>
          <h3>Explore this cohort</h3>
          <p>
            The analytics page shows encounter trends, duration statistics,
            conditions, and medication requests for{" "}
            {number(current.counts.patients)} synthetic patients.
          </p>
        </div>
        <a className="button secondary" href="#analytics">
          Open current analytics <Icon icon={ArrowRight} size={16} />
        </a>
      </div>
    </>
  );
}

function Cohort() {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("all");
  const resources = Object.entries({
    Patient: current.counts.patients,
    Encounter: current.counts.encounters,
    Condition: current.counts.conditions,
    MedicationRequest: current.counts.medications,
    Observation: current.counts.observations,
    Organization: snapshot.demand?.facility_count ?? 0,
  }).sort((a, b) => b[1] - a[1]);
  const filtered = resources.filter(
    ([name]) =>
      name.toLowerCase().includes(query.toLowerCase()) &&
      (scope === "all" || supported.has(name)),
  );
  return (
    <>
      <Note>
        <strong>Current synthetic cohort.</strong> {current.label}. These are
        loaded PostgreSQL rows exported {utc(snapshot.exported_at)}, not a live
        population.
      </Note>
      <Panel
        title="Where the data comes from"
        subtitle="Simulated patient histories generated with Synthea"
      >
        <div className="cohort-source">
          <p>
            Synthea is an open-source patient simulator that generates fictional
            people and their medical histories, including healthcare visits,
            diagnoses, and prescriptions. It exports those histories as FHIR
            JSON bundles, a standard format for exchanging healthcare data.
          </p>
          <p>
            Careflow validates the supported records, loads them into
            PostgreSQL, and transforms them with dbt for the metrics on this
            site. Selected Observations cover BMI, HbA1c, kidney measurements,
            and blood pressure; other Observation concepts are outside the
            ingestion subset. The Synthea records are simulated, not anonymized
            records from real patients.
          </p>
          <External href="https://synthetichealth.github.io/synthea/">
            About Synthea
          </External>
        </div>
      </Panel>
      <div className="metrics-grid three">
        <Metric
          label="Synthetic patients"
          value={number(current.counts.patients)}
          note="No real-world patient information"
          icon={Users}
        />
        <Metric
          label="Supported records loaded"
          value={number(resources.reduce((sum, [, value]) => sum + value, 0))}
          note={`Across ${current.counts.loads} loaded JSON bundles`}
          icon={FileJson}
          tone="blue"
        />
        <Metric
          label="Recorded quarantines"
          value={number(current.counts.quarantine)}
          note="Rejected input records retained separately"
          icon={CheckCircle2}
        />
      </div>
      <Panel
        title="What's in the cohort?"
        subtitle="Resource-level inventory, not individual patient records"
        action={
          <a
            className="text-link"
            href={`${import.meta.env.BASE_URL}data/careflow.json`}
            download
          >
            Aggregate evidence
          </a>
        }
      >
        <div className="table-toolbar">
          <label className="search-field">
            <Icon icon={Search} size={17} />
            <input
              aria-label="Search resource types"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a resource type…"
            />
          </label>
          <div className="segmented" aria-label="Resource scope">
            <button
              aria-pressed={scope === "all"}
              onClick={() => setScope("all")}
            >
              All loaded types
            </button>
            <button
              aria-pressed={scope === "supported"}
              onClick={() => setScope("supported")}
            >
              Persisted subset
            </button>
          </div>
        </div>
        <div
          className="table-scroll"
          role="region"
          aria-label="Resource inventory"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th scope="col">FHIR resource</th>
                <th scope="col" className="numeric">
                  Loaded rows
                </th>
                <th scope="col">How Careflow handles it</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(([name, value]) => (
                <tr key={name}>
                  <td>
                    <span
                      className={`resource-dot ${supported.has(name) ? "supported" : ""}`}
                    />
                    {name}
                  </td>
                  <td className="numeric">{number(value)}</td>
                  <td>
                    <span
                      className={`table-tag ${supported.has(name) ? "persisted" : ""}`}
                    >
                      {supported.has(name)
                        ? "Persisted"
                        : name === "Medication"
                          ? "Reference lookup only"
                          : "Counted, not persisted"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="empty-message">
              No resource types match your search.
            </p>
          )}
        </div>
        <div className="panel-foot">
          {filtered.length} of {resources.length} resource types · Subset
          compatibility testing, not full FHIR conformance.
        </div>
      </Panel>
    </>
  );
}

type Measure =
  | "encounter_count"
  | "unique_patients"
  | "average_duration_minutes"
  | "median_duration_minutes";
function Analytics() {
  const [measure, setMeasure] = useState<Measure>("encounter_count");
  const [showTable, setShowTable] = useState(false);
  const [range, setRange] = useState("60");
  const [granularity, setGranularity] = useState("monthly");
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartStyle, setChartStyle] = useState("line");
  const [conditionView, setConditionView] = useState("clinical");
  const [conditionSearch, setConditionSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const groups: Record<string, string> = {
    clinical: "Clinical conditions & findings",
    chronic: "Selected chronic-condition subset",
    social_context: "Social context",
    history: "Medical history",
    care_context: "Care context",
    unclassified: "Unclassified",
    all: "All recorded concepts",
  };
  const [showAllConditions, setShowAllConditions] = useState(false);
  const filteredConditions = current.conditions.filter(
    (row) =>
      (conditionView === "all" ||
        (conditionView === "chronic"
          ? row.chronic_subset
          : row.group === conditionView)) &&
      `${row.condition_name} ${row.code}`
        .toLowerCase()
        .includes(conditionSearch.toLowerCase()),
  );
  const conditions = showAllConditions
    ? filteredConditions
    : filteredConditions.slice(0, 10);
  const allRows =
    granularity === "annual"
      ? current.annual_utilization
      : current.monthly_utilization;
  const rows =
    range === "all"
      ? allRows
      : allRows.slice(-Number(range) / (granularity === "annual" ? 12 : 1));
  const summary = current.utilization_summary;
  const periodLabel = (value: string) =>
    granularity === "annual" ? value.slice(0, 4) : month(value);
  const max = Math.max(1, ...rows.map((row) => row[measure] ?? 0));
  const chartWidth = 850,
    chartHeight = 225,
    left = 45,
    plotHeight = 155;
  const monthIndex = (date: string) =>
    Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
  const firstMonth = rows.length ? monthIndex(rows[0].encounter_month) : 0;
  const step = granularity === "annual" ? 12 : 1;
  const span = rows.length
    ? monthIndex(rows[rows.length - 1].encounter_month) - firstMonth + step
    : step;
  const xAt = (date: string) =>
    left + ((monthIndex(date) - firstMonth + step / 2) * 775) / span;
  const isDuration = measure.endsWith("duration_minutes");
  const durationDivisor =
    measure === "median_duration_minutes"
      ? 1
      : isDuration && max >= 2880
        ? 1440
        : 60;
  const durationUnit =
    durationDivisor === 1 ? "min" : durationDivisor === 1440 ? "days" : "h";
  const axisValue = (value: number) =>
    isDuration ? number(value / durationDivisor) : number(Math.round(value));
  const measureValue = (value: number | null) =>
    value === null
      ? "Unavailable"
      : measure === "median_duration_minutes"
        ? medianDuration(value)
        : isDuration
          ? duration(value)
          : number(value);
  const barWidth = Math.min(60, (720 / (span / step)) * 0.65);
  const latest = rows[rows.length - 1];
  const selected =
    rows.find((row) => row.encounter_month === selectedMonth) ?? latest;
  const selectedIndex = selected ? rows.indexOf(selected) : 0;
  const segments: string[] = [];
  rows.forEach((row, index) => {
    if (row[measure] === null) return;
    const previous = rows[index - 1];
    const point = `${xAt(row.encounter_month)},${175 - ((row[measure] ?? 0) / max) * plotHeight}`;
    if (
      !previous ||
      previous[measure] === null ||
      monthIndex(row.encounter_month) - monthIndex(previous.encounter_month) !==
        step
    )
      segments.push(`M${point}`);
    else segments[segments.length - 1] += ` L${point}`;
  });
  const colors = [
    "#347a67",
    "#8daebc",
    "#d5b673",
    "#a9b99e",
    "#938ba5",
    "#b88e79",
  ];
  const medicationTotal = current.medication_status.reduce(
    (sum, row) => sum + row.request_count,
    0,
  );
  let medicationOffset = 0;
  useEffect(() => {
    const container = chartRef.current;
    const svg = container?.querySelector("svg");
    if (!container || !svg || !selected) return;
    const position =
      (xAt(selected.encounter_month) / chartWidth) *
      svg.getBoundingClientRect().width;
    container.scrollTo({ left: position - container.clientWidth / 2 });
  }, [range, granularity, selected?.encounter_month]);
  return (
    <>
      <Note>
        <strong>Current cohort export:</strong> {current.label},{" "}
        {current.counts.patients} patients. Exported {utc(snapshot.exported_at)}
        . These charts do not describe the archived Synthea cohort.
      </Note>
      <div className="metrics-grid three analytics-summary">
        <Metric
          label="Patients seen · latest 12 months"
          value={summary ? number(summary.unique_patients) : "—"}
          note={
            summary
              ? `${number((summary.cohort_share ?? 0) * 100)}% of the loaded cohort; includes deceased patients`
              : "No encounter window"
          }
          icon={Users}
        />
        <Metric
          label="Encounters per seen patient"
          value={
            summary?.encounters_per_seen_patient == null
              ? "—"
              : number(summary.encounters_per_seen_patient)
          }
          note="Finished encounters ÷ distinct patients seen in that window"
          icon={Activity}
          tone="blue"
        />
        <Metric
          label="Median encounter duration"
          value={
            summary?.median_duration_minutes == null
              ? "—"
              : `${number(summary.median_duration_minutes)} min`
          }
          note={
            summary
              ? `Mean ${duration(summary.average_duration_minutes)} · ${number(summary.measured_duration_count)} timed encounters`
              : "No measured durations"
          }
          icon={Clock3}
          tone="gold"
        />
      </div>
      {summary && (
        <p className="metric-definition">
          KPI window: {month(summary.start_month)}–
          {month(current.monthly_utilization.at(-1)!.encounter_month)}. These
          cards stay fixed when the chart range changes. Elapsed encounter time
          is not hospital length of stay.
        </p>
      )}
      <CohortExplorer
        data={current.segments}
        totalPatients={current.counts.patients}
      />
      <Panel
        title="Encounter activity over time"
        subtitle={
          granularity === "annual"
            ? "Calendar-year counts and distinct patients; not historical population rates"
            : "Finished encounters grouped by UTC start month"
        }
        action={
          <label className="select-field">
            <span className="sr-only">Time range</span>
            <select
              value={range}
              onChange={(event) => setRange(event.target.value)}
            >
              <option value="12">
                {granularity === "annual"
                  ? "Latest year"
                  : "Last 12 recorded months"}
              </option>
              <option value="60">
                {granularity === "annual"
                  ? "Last 5 recorded years"
                  : "Last 60 recorded months"}
              </option>
              <option value="120">
                {granularity === "annual"
                  ? "Last 10 recorded years"
                  : "Last 120 recorded months"}
              </option>
              <option value="all">
                {granularity === "annual"
                  ? "All recorded years"
                  : "All recorded months"}
              </option>
            </select>
          </label>
        }
      >
        <div className="chart-toolbar">
          <div className="segmented" aria-label="Time grouping">
            {["monthly", "annual"].map((value) => (
              <button
                key={value}
                aria-pressed={granularity === value}
                onClick={() => {
                  setGranularity(value);
                  setSelectedMonth(null);
                }}
              >
                {value === "monthly" ? "Monthly" : "Annual"}
              </button>
            ))}
          </div>
          <span className="chart-unit">
            {isDuration ? `Duration axis: ${durationUnit}` : "Count"} · annual
            patients are counted distinctly
          </span>
        </div>
        <div className="chart-toolbar">
          <div className="segmented" aria-label="Utilization metric">
            {(
              [
                ["encounter_count", "Encounters"],
                ["unique_patients", "Distinct patients"],
                ["average_duration_minutes", "Mean duration"],
                ["median_duration_minutes", "Median duration"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setMeasure(value)}
                aria-pressed={measure === value}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="segmented" aria-label="Chart style">
            {["line", "bars"].map((style) => (
              <button
                key={style}
                aria-pressed={chartStyle === style}
                onClick={() => setChartStyle(style)}
              >
                {style === "line" ? "Trend" : "Bars"}
              </button>
            ))}
          </div>
        </div>
        <div
          className="utilization-chart"
          ref={chartRef}
          role="region"
          aria-label="Utilization chart"
          tabIndex={0}
        >
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            role="img"
            aria-label={`${measure.replaceAll("_minutes", "").replaceAll("_", " ")} across ${rows.length} recorded ${granularity === "annual" ? "years" : "months"}`}
          >
            {[0, 1, 2, 3].map((tick) => (
              <g key={tick}>
                <line
                  x1={left}
                  x2="825"
                  y1={20 + (tick * plotHeight) / 3}
                  y2={20 + (tick * plotHeight) / 3}
                  stroke="#e7eeea"
                  strokeDasharray="4 5"
                />
                <text
                  x="30"
                  y={24 + (tick * plotHeight) / 3}
                  textAnchor="end"
                  className="axis-label"
                >
                  {axisValue((max * (3 - tick)) / 3)}
                </text>
              </g>
            ))}
            {chartStyle === "line" &&
              segments.map((path, index) => (
                <path
                  key={index}
                  d={path}
                  fill="none"
                  stroke="#347a67"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
              ))}
            {rows.map((row, index) => {
              const value = row[measure];
              const x = xAt(row.encounter_month);
              return (
                <g key={row.encounter_month}>
                  {chartStyle === "bars" ? (
                    <rect
                      x={x - barWidth / 2}
                      y={175 - ((value ?? 0) / max) * plotHeight}
                      width={barWidth}
                      height={((value ?? 0) / max) * plotHeight}
                      fill={row === selected ? "#203f35" : "#347a67"}
                      rx="5"
                    >
                      <title>
                        {periodLabel(row.encounter_month)}:{" "}
                        {measureValue(value)}
                      </title>
                    </rect>
                  ) : (
                    value !== null && (
                      <circle
                        cx={x}
                        cy={175 - (value / max) * plotHeight}
                        r={row === selected ? 5 : 2.5}
                        fill={row === selected ? "#203f35" : "#347a67"}
                      >
                        <title>
                          {periodLabel(row.encounter_month)}:{" "}
                          {measureValue(value)}
                        </title>
                      </circle>
                    )
                  )}
                  {(index % Math.max(1, Math.ceil(rows.length / 6)) === 0 ||
                    index === rows.length - 1) && (
                    <text
                      x={x}
                      y="202"
                      textAnchor="middle"
                      className="axis-label"
                    >
                      {periodLabel(row.encounter_month)}
                    </text>
                  )}
                  {rows.length < 8 && (
                    <text
                      x={x}
                      y={165 - ((value ?? 0) / max) * plotHeight}
                      textAnchor="middle"
                      className="value-label"
                    >
                      {measureValue(value)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
        {selected && (
          <div className="month-inspector">
            <div>
              <span>
                Explore an observed{" "}
                {granularity === "annual" ? "year" : "month"}
              </span>
              <strong>{periodLabel(selected.encounter_month)}</strong>
              <p>
                {number(selected.encounter_count)} encounters ·{" "}
                {number(selected.unique_patients)} distinct patients
              </p>
              <p>
                Mean {duration(selected.average_duration_minutes)} · median{" "}
                {medianDuration(selected.median_duration_minutes)}
              </p>
            </div>
            <label>
              <span className="sr-only">
                Explore {granularity === "annual" ? "year" : "month"}
              </span>
              <input
                type="range"
                min="0"
                max={Math.max(0, rows.length - 1)}
                value={selectedIndex}
                aria-valuetext={periodLabel(selected.encounter_month)}
                onChange={(event) =>
                  setSelectedMonth(
                    rows[Number(event.target.value)].encounter_month,
                  )
                }
              />
            </label>
          </div>
        )}
        <div className="panel-foot split">
          <span>
            {rows.length} recorded{" "}
            {granularity === "annual" ? "years" : "months"}. Missing periods are
            not filled with zero; distinct patient counts must not be summed.
          </span>
          <button
            className="text-link"
            onClick={() => setShowTable(!showTable)}
            aria-expanded={showTable}
          >
            {showTable ? "Hide" : "View"} exact values{" "}
            <Icon icon={ArrowDown} size={14} />
          </button>
        </div>
        {showTable && (
          <div
            className="table-scroll"
            role="region"
            aria-label="Exact utilization values"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>{granularity === "annual" ? "Year" : "Month"} (UTC)</th>
                  <th>Finished encounters</th>
                  <th>Distinct patients</th>
                  <th>Mean duration</th>
                  <th>Median duration</th>
                  <th>Timed encounters</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.encounter_month}>
                    <td>{row.encounter_month}</td>
                    <td>{number(row.encounter_count)}</td>
                    <td>{number(row.unique_patients)}</td>
                    <td>{duration(row.average_duration_minutes)}</td>
                    <td>{medianDuration(row.median_duration_minutes)}</td>
                    <td>{number(row.measured_duration_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <div className="overview-grid">
        <Panel
          title={groups[conditionView]}
          subtitle="Distinct affected patients ÷ all loaded patients"
        >
          {conditionView === "chronic" && (
            <Note>
              <strong>
                {number(current.chronic_summary.affected_patients)} of{" "}
                {number(current.chronic_summary.total_patients)} loaded patients
              </strong>{" "}
              have at least one active, confirmed concept in the explicit{" "}
              {current.chronic_summary.mapped_codes}-code subset. This is a
              distinct union, not a sum of the bars. It is not an exhaustive or
              validated chronic-disease registry.
            </Note>
          )}
          <div className="condition-controls">
            <label>
              Concept group
              <select
                aria-label="Condition view"
                value={conditionView}
                onChange={(event) => {
                  setConditionView(event.target.value);
                  setShowAllConditions(false);
                }}
              >
                {Object.entries(groups).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Find a concept
              <input
                type="search"
                aria-label="Search conditions"
                value={conditionSearch}
                placeholder="Name or SNOMED code"
                onChange={(event) => {
                  setConditionSearch(event.target.value);
                  setShowAllConditions(false);
                }}
              />
            </label>
          </div>
          <div className="condition-list">
            {conditions.map((row) => (
              <div
                className="condition"
                data-group={row.group}
                key={`${row.code_system}-${row.code}`}
              >
                <div>
                  <strong>{row.condition_name}</strong>
                  <span>{number(row.prevalence_fraction * 100)}%</span>
                </div>
                <div className="bar-track">
                  <div style={{ width: `${row.prevalence_fraction * 100}%` }} />
                </div>
                <small>
                  {row.affected_patients} of {row.total_patients} loaded
                  patients · {row.group} · {row.code}
                </small>
              </div>
            ))}
          </div>
          {conditions.length === 0 && (
            <p className="empty-message">
              No recorded concepts match this view.
            </p>
          )}
          <div className="panel-foot">
            Showing {conditions.length} of {filteredConditions.length} coded
            groups. Condition groups can overlap; counts must not be added.
          </div>
          {filteredConditions.length > 10 && (
            <button
              className="button secondary"
              onClick={() => setShowAllConditions(!showAllConditions)}
            >
              {showAllConditions
                ? "Show top 10 conditions"
                : `Show all ${filteredConditions.length} conditions`}
            </button>
          )}
        </Panel>
        <Panel
          title="Medication requests"
          subtitle="Share of prescription requests by recorded status"
        >
          <div className="medication-donut">
            <svg
              viewBox="0 0 240 240"
              role="img"
              aria-label={`${number(medicationTotal)} medication requests by status`}
            >
              <circle
                cx="120"
                cy="120"
                r="88"
                fill="none"
                stroke="#e7eeea"
                strokeWidth="26"
              />
              {current.medication_status.map((row, index) => {
                const share = medicationTotal
                  ? row.request_count / medicationTotal
                  : 0;
                const offset = medicationOffset;
                medicationOffset += share * 100;
                return (
                  <circle
                    key={row.status}
                    cx="120"
                    cy="120"
                    r="88"
                    fill="none"
                    stroke={colors[index % colors.length]}
                    strokeWidth="26"
                    pathLength="100"
                    strokeDasharray={`${share * 100} ${100 - share * 100}`}
                    strokeDashoffset={-offset}
                    transform="rotate(-90 120 120)"
                  >
                    <title>
                      {row.status}: {number(row.request_count)}
                    </title>
                  </circle>
                );
              })}
              <text x="120" y="119" textAnchor="middle" className="donut-total">
                {number(medicationTotal)}
              </text>
              <text x="120" y="141" textAnchor="middle" className="axis-label">
                requests
              </text>
            </svg>
          </div>
          <div className="medication-list">
            {current.medication_status.map((row, index) => (
              <div key={row.status}>
                <span>
                  <span
                    className="resource-dot"
                    style={{ background: colors[index % colors.length] }}
                  />
                  {row.status}
                </span>
                <strong>
                  {number(row.request_count)}{" "}
                  <small>
                    (
                    {number(
                      medicationTotal
                        ? (row.request_count / medicationTotal) * 100
                        : 0,
                    )}
                    %)
                  </small>
                </strong>
              </div>
            ))}
          </div>
          <div className="small-explainer">
            <Icon icon={Info} />
            <p>
              A request does not establish dispensing, administration, or
              adherence.
            </p>
          </div>
        </Panel>
      </div>
      <Note>
        FHIR Condition resources also include social context, history, and care
        situations. Groups use a curated code mapping for this synthetic
        dataset, not a clinical ontology. Unknown codes remain unclassified.
        Clinical findings include acute and chronic records; this is not a
        chronic-disease registry. No records are discarded when changing views.
      </Note>
    </>
  );
}

function Agent() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<
    (typeof snapshot.assistant.examples)[number] | null
  >(null);
  const [message, setMessage] = useState("");
  const responseRef = useRef<HTMLDivElement>(null);
  const [responseNumber, setResponseNumber] = useState(0);
  useEffect(() => {
    if (responseNumber > 0) responseRef.current?.focus();
  }, [responseNumber]);
  const normalize = (text: string) =>
    text
      .trim()
      .toLowerCase()
      .replace(/[?.!]+$/, "")
      .replace(/\s+/g, " ");
  function ask(value: string) {
    setResponseNumber((number) => number + 1);
    setQuestion(value);
    const match = snapshot.assistant.examples.find(
      (item) => normalize(item.question) === normalize(value),
    );
    setAnswer(match ?? null);
    setMessage(
      match
        ? ""
        : "This public demo replays the three exported examples below. Run Careflow privately to ask other supported questions.",
    );
  }
  return (
    <>
      <div className="agent-layout">
        <section className="agent-panel">
          <div className="agent-top">
            <span className="agent-icon">
              <Icon icon={Bot} size={24} />
            </span>
            <div>
              <h2>Careflow assistant</h2>
              <p>Fixed metrics. Read-only queries. Source citations.</p>
            </div>
            <Badge>Baseline replay</Badge>
          </div>
          <div className="agent-intro">
            <span className="sparkle-orbit">
              <Icon icon={Sparkles} size={30} />
            </span>
            <h3>
              A question is better
              <br />
              with a source behind it.
            </h3>
            <p>
              Choose an example to explore a real response exported from the
              current cohort warehouse.
            </p>
          </div>
          <div className="example-questions">
            {snapshot.assistant.examples.map((item) => (
              <button
                key={item.question}
                aria-pressed={answer?.question === item.question}
                onClick={() => ask(item.question)}
              >
                {item.question}
                <Icon icon={ArrowUpRight} size={16} />
              </button>
            ))}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              ask(question);
            }}
            className="ask-form"
          >
            <label htmlFor="question" className="sr-only">
              Analytics question
            </label>
            <input
              id="question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={1000}
              required
              placeholder="Try an exported example…"
            />
            <button aria-label="Ask baseline example" type="submit">
              <Icon icon={Send} size={18} />
            </button>
          </form>
          <div
            aria-live="polite"
            ref={responseRef}
            tabIndex={-1}
            className="agent-response"
          >
            {message && <Note>{message}</Note>}
            {answer && (
              <Panel
                className="answer-panel"
                title="An answer with a paper trail"
                subtitle={`Replayed from the ${utc(snapshot.exported_at)} export`}
                action={<Badge>Baseline · no model</Badge>}
              >
                <p className="answer-text">{answer.answer}</p>
                <div className="answer-sources">
                  {answer.citations.map((citation) => (
                    <article key={citation.metric_id}>
                      <span className="source-label">
                        <Icon icon={FileJson} size={15} /> SOURCE DEFINITION
                      </span>
                      <h3>{citation.title}</h3>
                      <p>{citation.definition}</p>
                      <code>{citation.relation}</code>
                      <ul>
                        {citation.limitations.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              </Panel>
            )}
          </div>
          <p className="agent-disclosure">
            Exported responses · no live API · no model calls ·{" "}
            {current.counts.patients}-patient cohort
          </p>
        </section>
        <aside className="agent-boundaries">
          <span className="eyebrow">THE BOUNDARIES</span>
          <h3>Useful by being specific.</h3>
          <p>
            The assistant supports a bounded metric catalog. It does not
            diagnose, recommend treatment, or look up individual patients.
          </p>
          <ul className="checklist">
            <li>
              <Icon icon={ShieldCheck} />
              Aggregate-only database reader
            </li>
            <li>
              <Icon icon={Database} />
              Parameterized, fixed SQL templates
            </li>
            <li>
              <Icon icon={FileJson} />
              Metric definitions in each answer
            </li>
          </ul>
          <External href={`${source}/blob/main/docs/assistant.md`}>
            How the assistant works
          </External>
          <div className="live-mode-note">
            <strong>Live mode stays private</strong>
            <p>
              OpenAI planning is optional in Careflow. This website has no
              provider key or live agent connection.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

type ForecastModel =
  | "seasonal_naive"
  | "seasonal_mean"
  | "seasonal_trend"
  | "damped_trend"
  | "poisson_seasonal";
type ForecastMetrics = {
  model: ForecastModel;
  mae: number;
  rmse: number;
  wape: number | null;
};
type ForecastSnapshot = {
  status: string;
  reason: string;
  predictions: { encounter_month: string; value: number }[] | null;
  held_out_metrics: ForecastMetrics[] | null;
  evaluation: {
    evaluated_at: string;
    protocol: string;
    input_sha256: string;
    training_start: string;
    training_end: string;
    test_start: string;
    test_end: string;
    training_months: number;
    model_window_months: number;
    selected_model: ForecastModel;
    selected_beats_baseline: boolean;
    folds: {
      training_end: string;
      test_start: string;
      test_end: string;
      predictions: ({ actual: number } & Record<ForecastModel, number>)[];
    }[];
    validation_metrics: ForecastMetrics[];
    test_predictions: {
      encounter_month: string;
      actual: number;
      seasonal_naive: number;
      seasonal_mean: number;
      seasonal_trend: number;
      damped_trend: number;
      poisson_seasonal: number;
    }[];
  } | null;
};
function Forecasting() {
  const [view, setView] = useState("regional");
  return (
    <>
      <div className="segmented demand-view" aria-label="Forecast view">
        <button
          className={view === "regional" ? "active" : ""}
          aria-pressed={view === "regional"}
          onClick={() => setView("regional")}
        >
          Facilities & ZIP areas
        </button>
        <button
          className={view === "cohort" ? "active" : ""}
          aria-pressed={view === "cohort"}
          onClick={() => setView("cohort")}
        >
          Whole cohort benchmark
        </button>
      </div>
      {view === "regional" ? (
        <RegionalDemand data={snapshot.demand} />
      ) : (
        <CohortForecasting />
      )}
    </>
  );
}

function CohortForecasting() {
  const [showValues, setShowValues] = useState(false);
  const forecast = snapshot.forecast as ForecastSnapshot;
  const e = forecast.evaluation;
  const names: Record<ForecastModel, string> = {
    seasonal_naive: "Seasonal naive",
    seasonal_mean: "Seasonal mean",
    seasonal_trend: "Seasonal trend",
    damped_trend: "Damped trend",
    poisson_seasonal: "Poisson seasonal",
  };
  if (!e || !forecast.held_out_metrics)
    return (
      <Note>
        <strong>Not evaluated.</strong> {forecast.reason}
      </Note>
    );
  const metrics = forecast.held_out_metrics;
  const baseline = metrics[0];
  const selected = metrics.find((row) => row.model === e.selected_model)!;
  const rows = e.test_predictions;
  const max = Math.max(
    1,
    ...rows.flatMap((row) => [
      row.actual,
      row.seasonal_naive,
      row[e.selected_model],
    ]),
  );
  const x = (i: number) => 50 + (i * 730) / 11;
  const y = (value: number) => 200 - (value / max) * 160;
  const series: {
    field: "actual" | ForecastModel;
    label: string;
    color: string;
    dashed: boolean;
  }[] = [
    { field: "actual", label: "Observed", color: "#347a67", dashed: false },
    {
      field: "seasonal_naive",
      label: "Seasonal naive",
      color: "#798a95",
      dashed: true,
    },
    {
      field: e.selected_model,
      label: names[e.selected_model],
      color: "#a07030",
      dashed: true,
    },
  ].filter(
    (row, index, array) =>
      array.findIndex((r) => r.field === row.field) === index,
  ) as typeof series;
  return (
    <>
      <Note>
        <strong>Development benchmark on synthetic data.</strong>{" "}
        {month(e.test_start)}–{month(e.test_end)} has already been inspected.
        Models are ranked on three earlier validation windows; this final year
        is a development comparison, not an untouched test. These simulated
        encounter counts do not represent real healthcare demand.
      </Note>
      <div className="metrics-grid three analytics-summary">
        <Metric
          label="Seasonal naive · benchmark MAE"
          value={number(baseline.mae)}
          note="Mean absolute error in encounters per month"
          icon={BarChart3}
        />
        <Metric
          label={`${names[e.selected_model]} · benchmark MAE`}
          value={number(selected.mae)}
          note="Model selected using earlier validation folds"
          icon={FlaskConical}
          tone="gold"
        />
        <Metric
          label="Selected model · benchmark WAPE"
          value={
            selected.wape === null ? "—" : `${number(selected.wape * 100)}%`
          }
          note="Absolute errors ÷ observed encounter total; lower is better"
          icon={Activity}
          tone="blue"
        />
      </div>
      <Panel
        title={
          e.selected_beats_baseline
            ? "Selected model clears the baseline"
            : "The baseline is at least as good on the benchmark"
        }
        subtitle={forecast.reason}
      >
        <p className="kpi-caption">
          Chart values are finished encounters per month. Dashed lines are model
          estimates; the solid line shows recorded counts.
        </p>
        <div className="forecast-legend">
          {series.map((s) => (
            <span key={s.field}>
              <i style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
        <div
          className="utilization-chart"
          role="region"
          aria-label="Benchmark comparison chart"
          tabIndex={0}
        >
          <svg
            viewBox="0 0 850 250"
            role="img"
            aria-label="Benchmark encounters: observed versus model estimates"
          >
            {[0, 1, 2, 3].map((tick) => (
              <g key={tick}>
                <line
                  x1="50"
                  x2="790"
                  y1={40 + (tick * 160) / 3}
                  y2={40 + (tick * 160) / 3}
                  stroke="#e7eeea"
                  strokeDasharray="4 5"
                />
                <text
                  x="38"
                  y={44 + (tick * 160) / 3}
                  textAnchor="end"
                  className="axis-label"
                >
                  {number(Math.round((max * (3 - tick)) / 3))}
                </text>
              </g>
            ))}
            {series.map((s) => (
              <path
                key={s.field}
                d={rows
                  .map((row, i) => `${i ? "L" : "M"}${x(i)},${y(row[s.field])}`)
                  .join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth="2.5"
                strokeDasharray={s.dashed ? "6 4" : undefined}
              />
            ))}
            {rows.map((row, i) => (
              <g key={row.encounter_month}>
                <circle cx={x(i)} cy={y(row.actual)} r="3" fill="#347a67">
                  <title>
                    {month(row.encounter_month)}: {row.actual} observed
                    encounters
                  </title>
                </circle>
                {i % 2 === 0 && (
                  <text
                    x={x(i)}
                    y="228"
                    textAnchor="middle"
                    className="axis-label"
                  >
                    {month(row.encounter_month)}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>
        <div className="panel-foot split">
          <span>
            Estimates use only data before the comparison year. No uncertainty
            intervals were estimated.
          </span>
          <button
            className="text-link"
            onClick={() => setShowValues(!showValues)}
            aria-expanded={showValues}
          >
            {showValues ? "Hide" : "View"} benchmark values
          </button>
        </div>
        {showValues && (
          <div
            className="table-scroll"
            role="region"
            aria-label="Benchmark monthly values"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Observed</th>
                  <th>Seasonal naive</th>
                  <th>{names[e.selected_model]}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.encounter_month}>
                    <td>{row.encounter_month}</td>
                    <td>{number(row.actual)}</td>
                    <td>{number(row.seasonal_naive)}</td>
                    <td>{number(row[e.selected_model])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel
        title="Performance across historical windows"
        subtitle="Twelve months per window; each fit uses only earlier data. Lower MAE is better."
      >
        <div
          className="table-scroll"
          role="region"
          aria-label="Historical validation windows"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th>Model</th>
                {e.folds.map((fold) => (
                  <th key={fold.test_start}>
                    {month(fold.test_start)}–{month(fold.test_end)}
                  </th>
                ))}
                <th>Mean MAE</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => (
                <tr key={metric.model}>
                  <td>{names[metric.model]}</td>
                  {e.folds.map((fold) => (
                    <td key={fold.test_start}>
                      {number(
                        fold.predictions.reduce(
                          (sum, row) =>
                            sum + Math.abs(row.actual - row[metric.model]),
                          0,
                        ) / 12,
                      )}
                    </td>
                  ))}
                  <td>
                    {number(
                      e.validation_metrics.find(
                        (row) => row.model === metric.model,
                      )!.mae,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="forecast-result-grid">
        <Panel
          title="Five models, the same benchmark"
          subtitle="Ranking uses earlier validation MAE; the final year is already known"
        >
          <div
            className="table-scroll"
            role="region"
            aria-label="Model comparison metrics"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Validation MAE</th>
                  <th>Benchmark MAE</th>
                  <th>Benchmark RMSE</th>
                  <th>Benchmark WAPE</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((row) => (
                  <tr key={row.model}>
                    <td>
                      {names[row.model]}
                      {row.model === e.selected_model ? " (selected)" : ""}
                    </td>
                    <td>
                      {number(
                        e.validation_metrics.find((v) => v.model === row.model)!
                          .mae,
                      )}
                    </td>
                    <td>{number(row.mae)}</td>
                    <td>{number(row.rmse)}</td>
                    <td>
                      {row.wape === null ? "—" : `${number(row.wape * 100)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel
          title="Reproducible evaluation"
          subtitle="Rolling-origin protocol v2"
        >
          <ul className="evaluation-notes">
            <li>
              Training: {month(e.training_start)}–{month(e.training_end)} (
              {e.training_months} months available).
            </li>
            <li>
              Three 12-month validation folds precede the test year. Each model
              uses at most the latest {e.model_window_months} training months.
            </li>
            <li>
              Seasonal naive repeats last year's month; seasonal mean averages
              matching months across five years; seasonal trend fits a linear
              trend with month effects. Damped trend shrinks future slope
              increments by a fixed 0.8 per month. Poisson seasonal fits month
              effects and a log-linear count trend, bounded to ±2 log units per
              year.
            </li>
            <li>
              Only the latest 120 consecutive observed months are used. Missing
              months cause evaluation to be withheld.
            </li>
            <li>
              This is a revised experiment after inspecting the final year.
              Future forecasts remain withheld regardless of its scores until
              independent evaluation is available.
            </li>
            <li>
              Evaluated {utc(e.evaluated_at)}. This retrospective cohort has
              changing historical coverage and includes deceased patients.
              Simulated patterns need not generalize.
            </li>
          </ul>
          <p className="forecast-hash">
            Aggregate input SHA-256 <code>{e.input_sha256}</code>
          </p>
        </Panel>
      </div>
      {forecast.predictions ? (
        <Panel
          title="Simulation horizon after the dataset cutoff"
          subtitle="Conditional research forecast; not a forecast of current real-world demand"
        >
          <div
            className="table-scroll"
            role="region"
            aria-label="Future simulated counts"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Expected encounters</th>
                </tr>
              </thead>
              <tbody>
                {forecast.predictions.map((row) => (
                  <tr key={row.encounter_month}>
                    <td>{row.encounter_month}</td>
                    <td>{number(row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : (
        <Note tone="amber">
          <strong>Future predictions withheld.</strong> This development
          benchmark helps compare models, but cannot establish independent
          forecast accuracy. No future curve is published.
        </Note>
      )}
    </>
  );
}

function Health() {
  const quality = current.quality;
  const state = quality.status === "passed";
  const stages = [
    {
      name: "Source ingestion",
      icon: FileJson,
      result: `${current.counts.loads} recorded load checkpoint${current.counts.loads === 1 ? "" : "s"}`,
      detail: "Last recorded source load",
      date: current.source_loaded_at,
    },
    {
      name: "Warehouse build",
      icon: Database,
      result:
        quality.models_passed === null
          ? "No build evidence supplied"
          : `${quality.models_passed} models succeeded`,
      detail: "Matching dbt artifact timestamp",
      date: quality.completed_at,
    },
    {
      name: "Quality checks",
      icon: ShieldCheck,
      result:
        quality.checks_total === null
          ? "Not verified"
          : `${quality.checks_passed} of ${quality.checks_total} checks passed`,
      detail: "Same dbt invocation",
      date: quality.completed_at,
    },
    {
      name: "Public snapshot",
      icon: FileJson,
      result: "Aggregate export created",
      detail: "Export generation time",
      date: snapshot.exported_at,
    },
  ];
  return (
    <>
      <div className="evidence-banner">
        <div>
          <Icon icon={Clock3} />
          <strong>Recorded evidence</strong>
          <span className="divider" />
          <span>{current.label}</span>
        </div>
        <Badge tone={state ? "green" : "amber"}>
          {state ? "dbt checks passed" : quality.status}
        </Badge>
      </div>
      <div className="metrics-grid three">
        <Metric
          label="Models built"
          value={
            quality.models_passed === null ? "—" : String(quality.models_passed)
          }
          note="From matching dbt build artifacts"
          icon={Database}
        />
        <Metric
          label="Quality checks passed"
          value={
            quality.checks_passed === null
              ? "—"
              : `${quality.checks_passed} / ${quality.checks_total}`
          }
          note="Recorded results, not a live health check"
          icon={ShieldCheck}
        />
        <Metric
          label="Current quarantines"
          value={String(current.counts.quarantine)}
          note="Rejected records in the current source schema"
          icon={FileJson}
          tone="gold"
        />
      </div>
      <Panel
        title="The last recorded pipeline evidence"
        subtitle="Source and build timestamps are deliberately separate"
        action={
          <a
            href={`${import.meta.env.BASE_URL}data/careflow.json`}
            className="text-link"
            download
          >
            Download evidence <Icon icon={Download} size={15} />
          </a>
        }
      >
        <div className="stage-list">
          {stages.map((stage, i) => (
            <div className="stage" key={stage.name}>
              <span className="stage-number">0{i + 1}</span>
              <span className="stage-icon">
                <Icon icon={stage.icon} size={21} />
              </span>
              <div>
                <h3>{stage.name}</h3>
                <p>{stage.result}</p>
              </div>
              <div className="stage-date">
                <strong>{utc(stage.date)}</strong>
                <span>{stage.detail}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="invocation">
          <span>dbt invocation</span>
          <code>{quality.invocation_id ?? "Not supplied"}</code>
        </div>
      </Panel>
      {current.counts.quarantine > 0 && (
        <Note tone="amber">
          <strong>Quarantined input needs review.</strong> Inspect the rejection
          reasons in Careflow before interpreting this cohort.
        </Note>
      )}
      <div className="overview-grid">
        <Panel
          title="What this page does not claim"
          subtitle="A snapshot has a scope"
        >
          <ul className="scope-list">
            <li>
              <Icon icon={Clock3} />
              <div>
                <strong>No live uptime claim</strong>
                <p>
                  Reloading the page does not rerun the pipeline or refresh
                  these timestamps.
                </p>
              </div>
            </li>
            <li>
              <Icon icon={Bot} />
              <div>
                <strong>No model-connectivity claim</strong>
                <p>
                  Baseline replay does not call a model. Hosted live evaluations
                  remain unverified.
                </p>
              </div>
            </li>
            <li>
              <Icon icon={Workflow} />
              <div>
                <strong>No active schedule claim</strong>
                <p>
                  Dagster scheduling is opt-in. This website does not observe a
                  running daemon.
                </p>
              </div>
            </li>
          </ul>
        </Panel>
        <Panel
          title="Separate archived evidence"
          subtitle="108-patient Synthea validation"
        >
          <div className="archive-summary">
            <strong>
              {archive.dbt_tests_passed}
              <span> / {archive.dbt_tests_passed}</span>
            </strong>
            <p>dbt quality checks passed in the archived run</p>
            <span>
              {archive.counts.quarantine} quarantines · {archive.input_files}{" "}
              source bundles
            </span>
          </div>
          <External href={archive.evidence_url}>
            Inspect archived results
          </External>
        </Panel>
      </div>
    </>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>(getPage);
  const [menuOpen, setMenuOpen] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const selected = nav.find((item) => item.id === page)!;
  useEffect(() => {
    const update = () => {
      setPage(getPage());
      setMenuOpen(false);
    };
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("hashchange", update);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("keydown", close);
    };
  }, []);
  useEffect(() => {
    document.title = `${selected.label} · Careflow`;
    titleRef.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [page, selected.label]);
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <button
          className="sidebar-close"
          aria-label="Close sidebar"
          onClick={() => setMenuOpen(false)}
        >
          <Icon icon={X} size={20} />
        </button>
        <a className="brand" href="#overview" aria-label="Careflow overview">
          <span className="brand-icon">
            <Icon icon={HeartPulse} size={25} />
          </span>
          careflow<span className="brand-period">.</span>
        </a>
        <span className="sidebar-caption">HEALTHCARE DATA PLATFORM</span>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={() => setMenuOpen(false)}
              aria-current={page === item.id ? "page" : undefined}
            >
              <Icon icon={item.icon} size={19} />
              <span>{item.label}</span>
              {item.id === "forecasting" && (
                <span className="nav-lab">LAB</span>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="synthetic-seal">
            <Icon icon={ShieldCheck} size={19} />
            <div>
              <strong>100% synthetic data</strong>
              <span>Built to learn. Safe to explore.</span>
            </div>
          </div>
          <External href={source} className="sidebar-github">
            <Icon icon={Github} size={17} />
            View the project
          </External>
          <small>A data engineering & AI portfolio</small>
        </div>
      </aside>
      {menuOpen && (
        <button
          className="menu-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="mobile-menu"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            >
              <Icon icon={menuOpen ? X : Menu} size={22} />
            </button>
            <span>Workspace</span>
            <Icon icon={ChevronRight} size={14} />
            <strong>{selected.label}</strong>
          </div>
          <div className="topbar-right">
            <span className="static-status">
              <span />
              Exported snapshot
            </span>
            <External href={source} className="github-button">
              <Icon icon={Github} size={16} />
              GitHub
            </External>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <span className="eyebrow">{selected.eyebrow}</span>
              <h1 ref={titleRef} tabIndex={-1}>
                {selected.title}
                {selected.accent && (
                  <>
                    <br />
                    <span>{selected.accent}</span>
                  </>
                )}
              </h1>
              <p>{selected.description}</p>
            </div>
            <div className="heading-aside">
              <span className="heading-orbit">
                <Icon
                  icon={page === "overview" ? HeartPulse : selected.icon}
                  size={35}
                />
              </span>
              <span>FHIR → SQL → AI</span>
              <small>Synthetic data. Documented boundaries.</small>
            </div>
          </div>
          {page === "overview" ? (
            <Overview />
          ) : page === "cohort" ? (
            <Cohort />
          ) : page === "analytics" ? (
            <Analytics />
          ) : page === "agent" ? (
            <Agent />
          ) : page === "forecasting" ? (
            <Forecasting />
          ) : page === "risk" ? (
            <RiskOverview data={snapshot.risk as RiskSummary | null} />
          ) : (
            <Health />
          )}
          <footer className="page-footer">
            <span>
              <HeartPulse size={15} aria-hidden="true" />
              Synthetic healthcare, real engineering.
            </span>
            <span>
              Portfolio research · Not clinical evidence
              <External
                href={`${source}/blob/audit/security-review/docs/security-audit.md`}
              >
                Security & scope
              </External>
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
