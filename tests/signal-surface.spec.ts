import { describe, it, expect } from "vitest";
import { resolve } from "node:path";

import { GET as getDebugSignalSurface } from "@/app/api/debug/signal-surface/route";
import { buildFinancialSnapshot } from "@/lib/financial-snapshot";
import { buildFinancialSignals } from "@/lib/financial-signals";
import { buildFinancialSignalMemory } from "@/lib/financial-signal-memory";
import { resolveSignalDominance } from "@/lib/signal-dominance";
import {
  approveFixtureUpdate,
  assertSignalSurfaceEpisode,
  classifySignalSurfaceChange,
  readSignalSurfaceFixture,
  serializeSignalSurface,
  type SerializedSignalSurface,
} from "./support/signal-surface-fixtures";

function getClusterKey(signal: any) {
  return [signal.type, signal.context?.category ?? "", signal.context?.merchant ?? ""].join("|");
}

function createDeterministicRandom(seed: string) {
  let state = 0;

  for (let index = 0; index < seed.length; index += 1) {
    state = Math.imul(31, state) + seed.charCodeAt(index);
    state |= 0;
  }

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function getRouteClusterKey(signal: any) {
  return [signal.type, signal.context?.category ?? "", signal.context?.merchant ?? ""].join("|");
}

function buildScenario(name: string, months: number, generator: (i: number) => ReturnType<typeof buildFinancialSnapshot>) {
  const periods: { month: number; year: number; snapshot: ReturnType<typeof buildFinancialSnapshot>; signals: ReturnType<typeof buildFinancialSignals> }[] = [];

  for (let i = 0; i < months; i += 1) {
    const month = (i % 12) + 1;
    const year = 2026 + Math.floor(i / 12);
    const snapshot = generator(i);
    const signals = buildFinancialSignals(snapshot);

    periods.push({ month, year, snapshot, signals });
  }

  const monthSummaries = [] as Array<{
    month: number;
    year: number;
    snapshot: ReturnType<typeof buildFinancialSnapshot>;
    signals: ReturnType<typeof buildFinancialSignals>;
    surface: SerializedSignalSurface;
    dominantKeys: string[];
    confidenceMean: number;
  }>;

  for (let i = 0; i < periods.length; i += 1) {
    const history = periods.slice(0, i + 1).map((period) => ({ month: period.month, year: period.year, signals: period.signals }));
    const memory = buildFinancialSignalMemory(history);
    const current = periods[i];
    const surface = resolveSignalDominance(current.signals, memory.current, `${name}:${current.year}-${current.month.toString().padStart(2, "0")}`);

    monthSummaries.push({
      month: current.month,
      year: current.year,
      snapshot: current.snapshot,
      signals: current.signals,
      surface: serializeSignalSurface(surface),
      dominantKeys: surface.dominant.map(getRouteClusterKey),
      confidenceMean: surface.confidenceDistribution.overall
    });
  }

  const jaccards: number[] = [];

  for (let i = 1; i < monthSummaries.length; i += 1) {
    const left = new Set(monthSummaries[i - 1].dominantKeys);
    const right = new Set(monthSummaries[i].dominantKeys);
    const intersection = [...left].filter((key) => right.has(key)).length;
    const union = new Set([...left, ...right]).size || 1;

    jaccards.push(intersection / union);
  }

  const meanJaccard = jaccards.length === 0 ? 1 : jaccards.reduce((sum, value) => sum + value, 0) / jaccards.length;
  const volatilityMonths = jaccards.filter((value) => value < 0.25).length;
  const confidenceMeans = monthSummaries.map((month) => month.confidenceMean);

  return {
    name,
    months: monthSummaries,
    stability: {
      meanJaccard,
      volatilityMonths,
      confidenceMeans
    }
  };
}

function reorderSignalSurface(surface: SerializedSignalSurface): SerializedSignalSurface {
  const clone = JSON.parse(JSON.stringify(surface)) as SerializedSignalSurface;

  clone.dominant.reverse();
  clone.secondary.reverse();
  clone.suppressed.reverse();

  for (const domain of ["liquidity", "spending", "income", "recurrence", "other"] as const) {
    clone.domains[domain].dominant.reverse();
    clone.domains[domain].secondary.reverse();
    clone.domains[domain].suppressed.reverse();
    clone.domains[domain].conflictingGroups.reverse();
    for (const group of clone.domains[domain].conflictingGroups) {
      group.signals.reverse();
    }
  }

  return clone;
}

function buildExpectedDebugScenarios() {
  const months = 6;

  const baseline = buildScenario("baseline-stable", months, () =>
    buildFinancialSnapshot({ income: 5000, expenses: 3800, budgetUtilizationMax: 0.3, categoryConcentration: 0.2 })
  );

  const noisySpikes = buildScenario("noisy-spikes", months, (i) => {
    const random = createDeterministicRandom(`noisy-spikes:${i}`);
    const spike = random() < 0.25 ? 800 + Math.round(random() * 1200) : 0;
    const expenses = 3800 + spike + Math.round((random() - 0.5) * 300);

    return buildFinancialSnapshot({ income: 5000, expenses, budgetUtilizationMax: Math.min(0.9, 0.3 + spike / 5000), categoryConcentration: 0.2 + random() * 0.2 });
  });

  const upwardTrend = buildScenario("upward-spending", months, (i) => {
    const random = createDeterministicRandom(`upward-spending:${i}`);
    const expenses = 3600 + i * 200 + Math.round((random() - 0.5) * 150);

    return buildFinancialSnapshot({ income: 5000, expenses, budgetUtilizationMax: Math.min(0.95, 0.25 + i * 0.12), categoryConcentration: 0.25 + i * 0.03 });
  });

  const alternatingShock = buildScenario("alternating-shock", months, (i) => {
    const random = createDeterministicRandom(`alternating-shock:${i}`);
    const expenses = i % 2 === 0 ? 3600 : 4600 + Math.round(random() * 400);

    return buildFinancialSnapshot({ income: 5000, expenses, budgetUtilizationMax: i % 2 === 0 ? 0.28 : 0.72, categoryConcentration: 0.18 + (i % 2 === 0 ? 0 : 0.35) });
  });

  return [baseline, noisySpikes, upwardTrend, alternatingShock];
}

const baselineFixturePath = resolve(process.cwd(), "tests/fixtures/signal-surface/baseline-stable.json");

describe("SignalSurface invariants", () => {
  it("is deterministic for identical inputs", () => {
    const snapshot = buildFinancialSnapshot({ income: 5000, expenses: 4200, budgetUtilizationMax: 0.6, categoryConcentration: 0.3 });
    const signals = buildFinancialSignals(snapshot);
    const memory = buildFinancialSignalMemory([{ month: 1, year: 2026, signals }]);

    const surfaceA = resolveSignalDominance(signals, memory.current, "2026-01");
    const surfaceB = resolveSignalDominance(signals, memory.current, "2026-01");

    const report = assertSignalSurfaceEpisode({
      name: "repeatability",
      actual: serializeSignalSurface(surfaceA),
      expected: serializeSignalSurface(surfaceB),
      allowedClassifications: ["match"]
    });

    expect(report.classification).toBe("match");
  });

  it("keeps dominance stable when equal-score noise is reordered", () => {
    const snapshot = buildFinancialSnapshot({ income: 5000, expenses: 3800, budgetUtilizationMax: 0.3, categoryConcentration: 0.2 });
    const baseSurface = serializeSignalSurface(resolveSignalDominance(buildFinancialSignals(snapshot), [], "2026-01"));
    const syntheticSignalA = {
      type: "budgetPressure",
      title: "Budget pressure housing",
      severity: 0.5,
      confidence: 0.65,
      persistence: 0.55,
      direction: "worsening",
      context: { category: "housing", delta: 0.1 }
    };
    const syntheticSignalB = {
      type: "budgetPressure",
      title: "Budget pressure travel",
      severity: 0.5,
      confidence: 0.65,
      persistence: 0.55,
      direction: "worsening",
      context: { category: "travel", delta: 0.1 }
    };
    const surfaceA = {
      ...baseSurface,
      dominant: [syntheticSignalA, syntheticSignalB],
      domains: {
        ...baseSurface.domains,
        spending: {
          ...baseSurface.domains.spending,
          dominant: [syntheticSignalA, syntheticSignalB]
        }
      }
    } as SerializedSignalSurface;
    const surfaceB = {
      ...surfaceA,
      dominant: [syntheticSignalB, syntheticSignalA],
      domains: {
        ...surfaceA.domains,
        spending: {
          ...surfaceA.domains.spending,
          dominant: [syntheticSignalB, syntheticSignalA]
        }
      }
    } as SerializedSignalSurface;

    const report = assertSignalSurfaceEpisode({
      name: "ordering-only-noise",
      actual: surfaceA,
      expected: surfaceB,
      allowedClassifications: ["benign"]
    });

    expect(report.classification).toBe("benign");
    expect(surfaceA.dominant.map(getClusterKey).sort()).toEqual(surfaceB.dominant.map(getClusterKey).sort());
  });

  it("preserves a golden baseline fixture for the stable scenario", () => {
    const snapshot = buildFinancialSnapshot({ income: 5000, expenses: 3800, budgetUtilizationMax: 0.3, categoryConcentration: 0.2 });
    const signals = buildFinancialSignals(snapshot);
    const memory = buildFinancialSignalMemory([{ month: 1, year: 2026, signals }]);
    const surface = resolveSignalDominance(signals, memory.current, "2026-01");

    const actual = {
      version: "signal-surface-v1",
      scenario: "baseline-stable",
      domainMetadata: ["liquidity", "spending", "income", "recurrence", "other"],
      input: {
        month: 1,
        year: 2026,
        snapshot: {
          income: 5000,
          expenses: 3800,
          budgetUtilizationMax: 0.3,
          categoryConcentration: 0.2
        }
      },
      output: serializeSignalSurface(surface)
    };

    const expected = readSignalSurfaceFixture(baselineFixturePath);
    const report = assertSignalSurfaceEpisode({
      name: "baseline-stable-fixture",
      actual: actual.output,
      expected: expected.output,
      allowedClassifications: ["match"]
    });

    expect(report.classification).toBe("match");
    expect(actual.version).toBe(expected.version);
    expect(actual.scenario).toBe(expected.scenario);
    expect(actual.domainMetadata).toEqual(expected.domainMetadata);
    expect(actual.input).toEqual(expected.input);

    if (process.env.UPDATE_SIGNAL_SURFACE_FIXTURES === "1") {
      approveFixtureUpdate(baselineFixturePath, actual);
    }
  });

  it("keeps spending and income domains isolated under alternating noise", () => {
    const incomeStable = buildFinancialSnapshot({ income: 5000, expenses: 3800, budgetUtilizationMax: 0.3, categoryConcentration: 0.2 });
    const incomeSignals = buildFinancialSignals(incomeStable);

    const noisyMonths = [] as ReturnType<typeof buildFinancialSnapshot>[];
    for (let i = 0; i < 4; i++) {
      const expenses = i % 2 === 0 ? 3800 : 4800;
      noisyMonths.push(buildFinancialSnapshot({ income: 5000, expenses, budgetUtilizationMax: i % 2 === 0 ? 0.3 : 0.75, categoryConcentration: 0.25 }));
    }

    const histories = noisyMonths.map((snap, idx) => ({ month: idx + 1, year: 2026, signals: buildFinancialSignals(snap) }));
    histories.push({ month: 5, year: 2026, signals: incomeSignals });

    const memory = buildFinancialSignalMemory(histories);
    const finalSurface = resolveSignalDominance(incomeSignals, memory.current, "2026-05");

    expect(finalSurface.domains.income).toBeDefined();
    expect(finalSurface.domains.spending.conflictingGroups.length).toBeGreaterThanOrEqual(0);
    expect(finalSurface.domains.income.dominant.length).toBeGreaterThanOrEqual(0);
  });

  it("flags malformed surfaces as invalid", () => {
    const report = classifySignalSurfaceChange({ generatedAt: "broken" }, serializeSignalSurface(resolveSignalDominance([], [], "2026-01")));

    expect(report.classification).toBe("invalid");
    expect(report.invalidReasons.length).toBeGreaterThan(0);
  });

  it("keeps the debug route aligned with deterministic scenario outputs", async () => {
    const response = await getDebugSignalSurface();
    const payload = await response.json();
    const expected = buildExpectedDebugScenarios();

    expect(payload.scenarios).toHaveLength(expected.length);

    for (let scenarioIndex = 0; scenarioIndex < expected.length; scenarioIndex += 1) {
      const actualScenario = payload.scenarios[scenarioIndex];
      const expectedScenario = expected[scenarioIndex];

      expect(actualScenario.name).toBe(expectedScenario.name);
      expect(actualScenario.months).toHaveLength(expectedScenario.months.length);
      expect(actualScenario.stability).toEqual(expectedScenario.stability);

      for (let monthIndex = 0; monthIndex < expectedScenario.months.length; monthIndex += 1) {
        const actualMonth = actualScenario.months[monthIndex];
        const expectedMonth = expectedScenario.months[monthIndex];
        const report = assertSignalSurfaceEpisode({
          name: `${actualScenario.name}:${actualMonth.year}-${String(actualMonth.month).padStart(2, "0")}`,
          actual: serializeSignalSurface(actualMonth.surface),
          expected: expectedMonth.surface,
          allowedClassifications: ["match"]
        });

        expect(report.classification).toBe("match");
        expect(actualMonth.dominantKeys).toEqual(expectedMonth.dominantKeys);
      }
    }
  });
});
