import { test } from "node:test";
import assert from "node:assert/strict";
import {
  planCapacity,
  defaultCapacity,
  capacityExamples,
} from "../src/capacity.ts";

test("historical replay preserves monthly shortfalls despite annual spare capacity", () => {
  const counts = [15, 13, 12, 13, 13, 12, 18, 22, 15, 30, 33, 32];
  const result = planCapacity(counts, defaultCapacity);
  assert.equal(result.capacity, 24);
  assert.equal(result.slotsPerSession, 6);
  assert.equal(result.totalShortfall, 23);
  assert.equal(result.monthsOverCapacity, 3);
  assert.equal(result.peakSessions, 6);
  assert.ok(result.capacity * 12 > counts.reduce((s, n) => s + n, 0));
  assert.deepEqual(
    result.months.map((m) => m.recorded),
    counts,
  );
});
test("whole appointment slots are rounded separately within each session", () => {
  const result = planCapacity([3], {
    ...defaultCapacity,
    hours: 1,
    visitMinutes: 40,
    sessions: 2,
    bookablePercent: 100,
  });
  assert.equal(result.capacity, 2);
  assert.equal(result.totalShortfall, 1);
});
test("zero sessions and zero usable slots never produce an infinite staffing estimate", () => {
  const closed = planCapacity([2, 0], { ...defaultCapacity, sessions: 0 });
  assert.equal(closed.capacity, 0);
  assert.equal(closed.totalShortfall, 2);
  const zero = planCapacity([2], { ...defaultCapacity, bookablePercent: 0 });
  assert.equal(zero.peakSessions, null);
  assert.equal(
    planCapacity([0], { ...defaultCapacity, bookablePercent: 0 }).peakSessions,
    0,
  );
});
test("demand change rounds up whole visits and can reduce demand to zero", () => {
  assert.equal(
    planCapacity([17], { ...defaultCapacity, demandChange: 50 }).months[0]
      .scenario,
    26,
  );
  assert.equal(
    planCapacity([17], { ...defaultCapacity, demandChange: -100 }).months[0]
      .scenario,
    0,
  );
});
test("invalid inputs are rejected instead of producing NaN or negative capacity", () => {
  for (const input of [
    { sessions: -1 },
    { sessions: 0.5 },
    { hours: NaN },
    { visitMinutes: 0 },
    { demandChange: 201 },
  ])
    assert.throws(() => planCapacity([1], { ...defaultCapacity, ...input }));
  for (const counts of [[], [-1], [1.5], [Infinity]])
    assert.throws(() => planCapacity(counts, defaultCapacity));
});
test("guided examples exclude sparse histories and do not assume every pattern exists", () => {
  const group = (key, prior, current) => ({
    key,
    label: key,
    scope: "facility",
    care_setting: "ambulatory",
    counts: [...Array(12).fill(prior), ...Array(12).fill(current)],
    annual_count: current * 12,
    eligible: true,
  });
  const examples = capacityExamples([
    group("steady", 15, 15),
    group("rise", 10, 20),
    group("fall", 20, 10),
    { ...group("sparse", 100, 1000), eligible: false },
  ]);
  assert.deepEqual(
    examples.map((e) => e.group.key),
    ["steady", "rise", "fall"],
  );
  assert.deepEqual(capacityExamples([]), []);
});
