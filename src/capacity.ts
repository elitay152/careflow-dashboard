export type CapacityAssumptions = {
  sessions: number;
  hours: number;
  visitMinutes: number;
  bookablePercent: number;
  demandChange: number;
};
export const defaultCapacity: CapacityAssumptions = {
  sessions: 4,
  hours: 4,
  visitMinutes: 30,
  bookablePercent: 80,
  demandChange: 0,
};
export const capacityLimits: Record<
  keyof CapacityAssumptions,
  readonly [number, number]
> = {
  sessions: [0, 100],
  hours: [1, 12],
  visitMinutes: [5, 120],
  bookablePercent: [0, 100],
  demandChange: [-100, 200],
};

export function planCapacity(
  counts: readonly number[],
  assumptions: CapacityAssumptions,
) {
  for (const key of Object.keys(
    capacityLimits,
  ) as (keyof CapacityAssumptions)[]) {
    const value = assumptions[key],
      [min, max] = capacityLimits[key];
    if (!Number.isInteger(value) || value < min || value > max)
      throw new Error("Invalid capacity assumptions");
  }
  if (!counts.length || counts.some((n) => !Number.isSafeInteger(n) || n < 0))
    throw new Error("Invalid recorded counts");
  // Slots cannot be shared across separate sessions; round down per session.
  const slotsPerSession = Math.floor(
    (assumptions.hours * 60 * assumptions.bookablePercent) /
      (100 * assumptions.visitMinutes),
  );
  const capacity = assumptions.sessions * slotsPerSession;
  const months = counts.map((recorded) => {
    const scenario = Math.ceil(
      (recorded * (100 + assumptions.demandChange)) / 100,
    );
    return {
      recorded,
      scenario,
      capacity,
      shortfall: Math.max(0, scenario - capacity),
      spare: Math.max(0, capacity - scenario),
    };
  });
  const peak = Math.max(...months.map((m) => m.scenario));
  return {
    slotsPerSession,
    capacity,
    months,
    peak,
    totalShortfall: months.reduce((s, m) => s + m.shortfall, 0),
    monthsOverCapacity: months.filter((m) => m.shortfall > 0).length,
    peakSessions: slotsPerSession
      ? Math.ceil(peak / slotsPerSession)
      : peak
        ? null
        : 0,
    scheduledHours: assumptions.sessions * assumptions.hours,
  };
}

type History = {
  key: string;
  label: string;
  counts: number[];
  annual_count: number;
  eligible: boolean;
  scope: string;
  care_setting: string;
};
export function capacityExamples(groups: readonly History[]) {
  const candidates = groups.filter(
    (g) =>
      g.scope === "facility" &&
      g.care_setting === "ambulatory" &&
      g.eligible &&
      g.counts.slice(-24, -12).reduce((s, n) => s + n, 0) >= 120,
  );
  const growth = (g: History) =>
    g.annual_count / g.counts.slice(-24, -12).reduce((s, n) => s + n, 0) - 1;
  const stability = (g: History) => {
    const values = g.counts.slice(-12),
      average = values.reduce((s, n) => s + n, 0) / values.length;
    return (
      Math.sqrt(
        values.reduce((s, n) => s + (n - average) ** 2, 0) / values.length,
      ) /
        average +
      Math.abs(growth(g))
    );
  };
  const steady = [...candidates].sort(
    (a, b) => stability(a) - stability(b) || a.label.localeCompare(b.label),
  )[0];
  const increasing = candidates
    .filter((g) => growth(g) >= 0.25)
    .sort((a, b) => growth(b) - growth(a) || a.label.localeCompare(b.label))[0];
  const declining = candidates
    .filter((g) => growth(g) <= -0.25)
    .sort((a, b) => growth(a) - growth(b) || a.label.localeCompare(b.label))[0];
  return [
    { title: "Steady volume", group: steady },
    { title: "Recent increase", group: increasing },
    { title: "Recent decline", group: declining },
  ].filter((e) => e.group);
}
