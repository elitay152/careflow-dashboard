import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";

// Display fixtures only. These do not evaluate a model or become public data.
const cache = new URL("../node_modules/.cache/", import.meta.url);
await mkdir(cache, { recursive: true });
const directory = await mkdtemp(new URL("careflow-finding-", cache));
after(() => rm(directory, { recursive: true, force: true }));
const path = new URL("../src/ReadmissionFinding.tsx", import.meta.url);
const result = await transformWithOxc(
  await readFile(path, "utf8"),
  path.pathname,
);
const compiled = join(directory, "finding.mjs");
await writeFile(compiled, result.code);
const { default: Finding } = await import(pathToFileURL(compiled).href);
const render = (props) => renderToStaticMarkup(createElement(Finding, props));

test("review-capacity finding presents supplied counts, denominators, and test scope", () => {
  const html = render({
    model: "Gradient boosting",
    split: "test",
    budget: {
      capacity: 0.2,
      reviewed: 2935,
      captured: 662,
      precision: 0.226,
      recall: 0.391,
    },
  });
  for (const text of [
    "20%",
    "39.1%",
    "2,935",
    "662",
    "22.6%",
    "Gradient boosting",
    "Patient-held-out test",
    "of test encounters",
    "of recorded readmissions",
    "does not establish",
  ])
    assert.ok(html.includes(text), text);
});

test("finding follows other model/split results without retaining the showcased performance", () => {
  const html = render({
    model: "Training prevalence",
    split: "validation",
    budget: {
      capacity: 0.2,
      reviewed: 180,
      captured: 20,
      precision: 20 / 180,
      recall: 0.2,
    },
  });
  for (const text of [
    "Validation",
    "Training prevalence",
    "180",
    "11.1%",
    "of validation encounters",
  ])
    assert.ok(html.includes(text), text);
  for (const stale of ["39.1%", "2,935", "662", "22.6%", "Gradient boosting"])
    assert.ok(!html.includes(stale), stale);
});
