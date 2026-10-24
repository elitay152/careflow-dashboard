import { ArrowRight } from "lucide-react";

export type ReviewBudget = {
  capacity: number;
  reviewed: number;
  captured: number;
  precision: number;
  recall: number;
};
const number = (value: number) => new Intl.NumberFormat("en-US").format(value);
const percent = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);

export default function ReadmissionFinding({
  budget,
  model,
  split,
}: {
  budget: ReviewBudget;
  model: string;
  split: "validation" | "test";
}) {
  return (
    <section
      className="readmission-finding"
      aria-labelledby="readmission-finding-title"
      aria-live="polite"
      aria-atomic="true"
    >
      <header>
        <p className="readmission-finding-scope">
          {model} · {split === "test" ? "Patient-held-out test" : "Validation"}
        </p>
        <h2 id="readmission-finding-title">Review capacity at a glance</h2>
      </header>
      <div className="readmission-finding-flow">
        <div>
          <span>Review budget</span>
          <strong>{percent(budget.capacity)}</strong>
          <span>of {split} encounters</span>
        </div>
        <ArrowRight size={30} aria-hidden="true" />
        <div>
          <span>Capture</span>
          <strong>{percent(budget.recall)}</strong>
          <span>of recorded readmissions</span>
        </div>
      </div>
      <p className="readmission-finding-counts">
        <strong>{number(budget.reviewed)}</strong> encounters reviewed ·{" "}
        <strong>{number(budget.captured)}</strong> readmissions identified ·{" "}
        <strong>{percent(budget.precision)}</strong> precision
      </p>
      <p className="readmission-finding-limit">
        This summarizes retrospective ranking at the selected model and split.
        It does not establish that reviewing these encounters would prevent
        readmissions.
      </p>
    </section>
  );
}
