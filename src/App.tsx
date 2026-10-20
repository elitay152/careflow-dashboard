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
  GitBranch,
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

const current = snapshot.current;
const archive = snapshot.archive;
const source = "https://github.com/elitay152/Careflow";
const supported = new Set([
  "Patient",
  "Encounter",
  "Condition",
  "MedicationRequest",
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
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));

const nav = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    eyebrow: "THE BIG PICTURE",
    title: "Synthetic healthcare.",
    accent: "Real engineering.",
    description:
      "A small healthcare data platform with a clear path from raw FHIR to trustworthy analytics.",
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
    eyebrow: "FROM RECORDS TO INSIGHT",
    title: "Numbers with context.",
    accent: "Definitions included.",
    description:
      "Explore the current demo warehouse through aggregate utilization, conditions, and medication requests.",
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
    eyebrow: "THE NEXT EXPERIMENT",
    title: "Forecasts start",
    accent: "with a fair test.",
    description:
      "A transparent experiment plan for simulated encounter counts. Results will appear only after held-out evaluation.",
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
  const resources = Object.values(archive.resources).reduce(
    (sum, value) => sum + value,
    0,
  );
  const domains = [
    {
      label: "Encounters",
      value: archive.counts.encounters,
      color: "var(--teal)",
    },
    {
      label: "Medication requests",
      value: archive.counts.medications,
      color: "var(--mint)",
    },
    {
      label: "Conditions",
      value: archive.counts.conditions,
      color: "var(--blue)",
    },
    { label: "Patients", value: archive.counts.patients, color: "var(--gold)" },
  ];
  return (
    <>
      <div className="evidence-banner">
        <div>
          <Icon icon={Database} />
          <span>Validated Synthea cohort</span>
          <span className="divider" />
          <span>{archive.label}</span>
        </div>
        <span>Archived evidence · {utc(archive.recorded_on, false)}</span>
      </div>
      <div className="metrics-grid">
        <Metric
          label="Simulated patients"
          value={number(archive.counts.patients)}
          note="Fictional people. No real patient data."
          icon={Users}
        />
        <Metric
          label="Supported records loaded"
          value={number(archive.accepted)}
          note={`From ${number(resources)} source resources`}
          icon={Layers}
          tone="blue"
        />
        <Metric
          label="Data quality checks"
          value={`${archive.dbt_tests_passed} / ${archive.dbt_tests_passed}`}
          note="All checks passed in the archived run"
          icon={ShieldCheck}
        />
        <Metric
          label="Quarantined records"
          value={number(archive.counts.quarantine)}
          note="After medication-reference handling fix"
          icon={CheckCircle2}
          tone="gold"
        />
      </div>
      <div className="overview-grid">
        <Panel
          title="Four domains. Reconciled to source."
          subtitle="Loaded rows in the validated Synthea cohort"
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
            {number(archive.ignored)} other resources counted outside the
            persisted subset.
          </div>
        </Panel>
        <Panel
          className="trust-panel"
          title="Trust is in the details"
          subtitle="What the validation actually checked"
        >
          <div className="trust-mark">
            <ShieldCheck size={46} strokeWidth={1.3} />
            <div>
              <strong>Source → warehouse</strong>
              <span>Independently reconciled</span>
            </div>
          </div>
          <ul className="checklist">
            <li>
              <Icon icon={Check} />
              All supported resource IDs accounted for
            </li>
            <li>
              <Icon icon={Check} />
              Zero orphan patient references
            </li>
            <li>
              <Icon icon={Check} />
              Duplicate-safe, unchanged reruns
            </li>
            <li>
              <Icon icon={Check} />
              10 models + 32 dbt quality checks
            </li>
          </ul>
          <External href={archive.evidence_url}>
            Read the machine-readable evidence
          </External>
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
          <Icon icon={GitBranch} size={24} />
        </div>
        <div>
          <h3>Two datasets. Clearly separated.</h3>
          <p>
            The 108-patient validation is archived evidence. Interactive
            analytics use the current {current.counts.patients}-patient demo
            export.
          </p>
        </div>
        <a className="button secondary" href="#analytics">
          Open demo analytics <Icon icon={ArrowRight} size={16} />
        </a>
      </div>
    </>
  );
}

function Cohort() {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("all");
  const resources = Object.entries(archive.resources).sort(
    (a, b) => b[1] - a[1],
  );
  const filtered = resources.filter(
    ([name]) =>
      name.toLowerCase().includes(query.toLowerCase()) &&
      (scope === "all" || supported.has(name)),
  );
  return (
    <>
      <Note>
        <strong>Archived validation, not a live population.</strong> Synthea
        3.3.0, seed 42. These counts come from the documented{" "}
        {utc(archive.recorded_on, false)} run.
      </Note>
      <div className="metrics-grid three">
        <Metric
          label="Synthetic patients"
          value={number(archive.counts.patients)}
          note="No real-world patient information"
          icon={Users}
        />
        <Metric
          label="Source resources"
          value={number(resources.reduce((sum, [, value]) => sum + value, 0))}
          note={`Across ${archive.input_files} JSON bundles`}
          icon={FileJson}
          tone="blue"
        />
        <Metric
          label="Supported and accepted"
          value={number(archive.accepted)}
          note="Four persisted FHIR resource types"
          icon={CheckCircle2}
        />
      </div>
      <Panel
        title="What's in the cohort?"
        subtitle="Resource-level inventory, not individual patient records"
        action={
          <External href={archive.evidence_url}>Source evidence</External>
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
              All types
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
                  Source records
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
                        ? "Persisted & reconciled"
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
      <Note>
        Resource totals are not interchangeable. A MedicationRequest is a
        request, not evidence that medication was dispensed. Patient histories
        can contain many encounters and conditions.
      </Note>
    </>
  );
}

type Measure =
  "encounter_count" | "unique_patients" | "average_duration_minutes";
function Analytics() {
  const [measure, setMeasure] = useState<Measure>("encounter_count");
  const [showTable, setShowTable] = useState(false);
  const [range, setRange] = useState("12");
  const allRows = current.monthly_utilization;
  const rows = range === "all" ? allRows : allRows.slice(-Number(range));
  const max = Math.max(1, ...rows.map((row) => row[measure] ?? 0));
  const chartWidth = 850,
    chartHeight = 225,
    left = 45,
    plotHeight = 155;
  const barWidth = Math.min(85, (720 / Math.max(rows.length, 1)) * 0.55);
  return (
    <>
      <Note>
        <strong>Current demo export:</strong> {current.label},{" "}
        {current.counts.patients} patients. Exported {utc(snapshot.exported_at)}
        . These charts do not describe the archived Synthea cohort.
      </Note>
      <Panel
        title="Monthly utilization"
        subtitle="Finished encounters grouped by UTC start month"
        action={
          <label className="select-field">
            <span className="sr-only">Time range</span>
            <select
              value={range}
              onChange={(event) => setRange(event.target.value)}
            >
              <option value="6">Last 6 recorded months</option>
              <option value="12">Last 12 recorded months</option>
              <option value="all">All recorded months</option>
            </select>
          </label>
        }
      >
        <div className="chart-toolbar">
          <div className="segmented" aria-label="Utilization metric">
            {(
              [
                ["encounter_count", "Encounters"],
                ["unique_patients", "Distinct patients"],
                ["average_duration_minutes", "Mean duration"],
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
          <span className="chart-unit">
            {measure === "average_duration_minutes" ? "Minutes" : "Count"}
          </span>
        </div>
        <div className="utilization-chart">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            role="img"
            aria-label={`${measure.replaceAll("_", " ")} across ${rows.length} recorded months`}
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
                  {number((max * (3 - tick)) / 3)}
                </text>
              </g>
            ))}
            {rows.map((row, index) => {
              const value = row[measure];
              const x = left + ((index + 0.5) * 775) / rows.length;
              return (
                <g key={row.encounter_month}>
                  <rect
                    x={x - barWidth / 2}
                    y={175 - ((value ?? 0) / max) * plotHeight}
                    width={barWidth}
                    height={((value ?? 0) / max) * plotHeight}
                    fill="#347a67"
                    rx="5"
                  >
                    <title>
                      {month(row.encounter_month)}:{" "}
                      {value === null ? "Unavailable" : number(value)}
                    </title>
                  </rect>
                  {rows.length < 25 && (
                    <text
                      x={x}
                      y="202"
                      textAnchor="middle"
                      className="axis-label"
                    >
                      {month(row.encounter_month)}
                    </text>
                  )}
                  {rows.length < 8 && (
                    <text
                      x={x}
                      y={165 - ((value ?? 0) / max) * plotHeight}
                      textAnchor="middle"
                      className="value-label"
                    >
                      {value === null ? "N/A" : number(value)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
        <div className="panel-foot split">
          <span>
            {rows.length} recorded month{rows.length !== 1 ? "s" : ""}. Missing
            months are not filled with zero.
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
                  <th>Month (UTC)</th>
                  <th>Finished encounters</th>
                  <th>Distinct patients</th>
                  <th>Mean minutes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.encounter_month}>
                    <td>{row.encounter_month}</td>
                    <td>{number(row.encounter_count)}</td>
                    <td>{number(row.unique_patients)}</td>
                    <td>
                      {row.average_duration_minutes === null
                        ? "Unavailable"
                        : number(row.average_duration_minutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <div className="overview-grid">
        <Panel
          title="Recorded condition prevalence"
          subtitle="Distinct affected patients ÷ all loaded patients"
        >
          <div className="condition-list">
            {current.conditions.map((row) => (
              <div className="condition" key={`${row.code_system}-${row.code}`}>
                <div>
                  <strong>{row.condition_name}</strong>
                  <span>{number(row.prevalence_fraction * 100)}%</span>
                </div>
                <div className="bar-track">
                  <div style={{ width: `${row.prevalence_fraction * 100}%` }} />
                </div>
                <small>
                  {row.affected_patients} of {row.total_patients} loaded
                  patients · {row.code}
                </small>
              </div>
            ))}
          </div>
          <div className="panel-foot">
            Current recorded snapshot. Condition groups can overlap; counts must
            not be added.
          </div>
        </Panel>
        <Panel
          title="Medication requests"
          subtitle="All statuses in the current warehouse"
        >
          <div className="medication-list">
            {current.medication_status.map((row) => (
              <div key={row.status}>
                <span>
                  <span className="resource-dot supported" />
                  {row.status}
                </span>
                <strong>{number(row.request_count)}</strong>
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
    </>
  );
}

function Agent() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<
    (typeof snapshot.assistant.examples)[number] | null
  >(null);
  const [message, setMessage] = useState("");
  const normalize = (text: string) =>
    text
      .trim()
      .toLowerCase()
      .replace(/[?.!]+$/, "")
      .replace(/\s+/g, " ");
  function ask(value: string) {
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
              current demo warehouse.
            </p>
          </div>
          <div className="example-questions">
            {snapshot.assistant.examples.map((item) => (
              <button key={item.question} onClick={() => ask(item.question)}>
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
          <p className="agent-disclosure">
            Exported responses · no live API · no model calls ·{" "}
            {current.counts.patients}-patient demo
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
      <div aria-live="polite">
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
    </>
  );
}

function Forecasting() {
  return (
    <>
      <Note tone="amber">
        <strong>Experiment not evaluated.</strong> No forecast, confidence band,
        or accuracy score has been published.
      </Note>
      <div className="forecast-layout">
        <Panel className="forecast-empty">
          <div className="empty-chart-grid" aria-hidden="true">
            <span>
              <Icon icon={FlaskConical} size={34} />
            </span>
          </div>
          <Badge tone="neutral">Research plan</Badge>
          <h2>No forecast published yet.</h2>
          <p>
            The target is monthly finished encounter counts in simulated data. A
            held-out result must come before a forecast line.
          </p>
          <div className="forecast-scores">
            <div>
              <span>Held-out MAE</span>
              <strong>—</strong>
              <small>Not evaluated</small>
            </div>
            <div>
              <span>Held-out WAPE</span>
              <strong>—</strong>
              <small>Not evaluated</small>
            </div>
          </div>
        </Panel>
        <Panel
          title="A test worth running"
          subtitle="Proposed evaluation protocol"
        >
          <ol className="experiment-steps">
            <li>
              <span>01</span>
              <div>
                <h3>Check the data first</h3>
                <p>
                  Confirm cohort size, time coverage, and whether absent months
                  mean zero or missing.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Hold out the future</h3>
                <p>
                  Reserve the last time window. Fit and tune only on earlier
                  observations.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Earn the complexity</h3>
                <p>
                  Compare against last-value and, if history permits, seasonal
                  naive baselines.
                </p>
              </div>
            </li>
            <li>
              <span>04</span>
              <div>
                <h3>Publish the evidence</h3>
                <p>
                  Report MAE, WAPE where defined, the exact split, and
                  limitations of simulated data.
                </p>
              </div>
            </li>
          </ol>
        </Panel>
      </div>
      <div className="cohort-callout">
        <span className="callout-icon">
          <Icon icon={Users} size={24} />
        </span>
        <div>
          <h3>A larger cohort is a separate milestone.</h3>
          <p>
            Expansion toward 1,000 Synthea patients starts with storage and
            runtime checks. No larger cohort is claimed here.
          </p>
        </div>
        <a className="text-link" href="#cohort">
          View validated cohort <Icon icon={ArrowRight} size={16} />
        </a>
      </div>
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
          <span>Current hand-authored demo</span>
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
          note="Demo contains intentional invalid input"
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
          <strong>Quarantine is visible, not hidden.</strong> The extended demo
          intentionally includes an invalid birth date. Inspect Careflow before
          interpreting any additional rejections.
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
                <br />
                <span>{selected.accent}</span>
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
