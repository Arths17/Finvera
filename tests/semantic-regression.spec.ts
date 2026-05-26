import { describe, expect, it } from "vitest";

import { buildFinancialSnapshot } from "@/lib/financial-snapshot";
import { buildFinancialSignals } from "@/lib/financial-signals";
import { buildFinancialSignalMemory } from "@/lib/financial-signal-memory";
import { resolveSignalDominance } from "@/lib/signal-dominance";
import { annotateFinancialSignals, buildMeaningEvolutionReport, getSignalDefinition } from "@/lib/signal-meaning";
import { compareSignalSurfaces, serializeSignalSurface } from "./support/signal-surface-fixtures";

describe("Semantic regression episodes", () => {
  it("preserves historical interpretation when meaning layers evolve", () => {
    const snapshot = buildFinancialSnapshot({ income: 5000, expenses: 4300, budgetUtilizationMax: 0.85, categoryConcentration: 0.5, topCategory: "housing" });
    const signals = buildFinancialSignals(snapshot);

    const v1Signals = annotateFinancialSignals(signals, "v1");
    const v2Signals = annotateFinancialSignals(signals, "v2");

    expect(v1Signals.map((signal) => signal.type)).toEqual(v2Signals.map((signal) => signal.type));
    expect(v1Signals.map((signal) => signal.title)).toEqual(v2Signals.map((signal) => signal.title));

    const v1Meaning = v1Signals.map((signal) => signal.meaning?.description);
    const v2Meaning = v2Signals.map((signal) => signal.meaning?.description);

    expect(v1Meaning).not.toEqual(v2Meaning);
    expect(v2Signals.every((signal) => signal.meaningVersion === "v2")).toBe(true);
  });

  it("keeps SignalSurface stable when meaning annotations are layered on top", () => {
    const snapshot = buildFinancialSnapshot({ income: 5000, expenses: 3800, budgetUtilizationMax: 0.3, categoryConcentration: 0.2 });
    const signals = buildFinancialSignals(snapshot);
    const memory = buildFinancialSignalMemory([{ month: 1, year: 2026, signals }]);

    const rawSurface = serializeSignalSurface(resolveSignalDominance(signals, memory.current, "2026-01"));
    const annotatedSurface = serializeSignalSurface(resolveSignalDominance(annotateFinancialSignals(signals, "v2") as any, memory.current as any, "2026-01"));
    const comparison = compareSignalSurfaces(rawSurface, annotatedSurface);

    expect(comparison.classification).toBe("match");
    expect(comparison.equal).toBe(true);
  });

  it("reports controlled meaning drift with compatibility metadata", () => {
    const report = buildMeaningEvolutionReport(["budgetPressure", "spendingAcceleration"], "v1", "v2");

    expect(report).toHaveLength(2);
    expect(report[0]).toMatchObject({
      signalType: "budgetPressure",
      fromVersion: "v1",
      toVersion: "v2",
      compatibility: "partially compatible",
      impactScope: "signal-level"
    });
    expect(report[1]).toMatchObject({
      signalType: "spendingAcceleration",
      fromVersion: "v1",
      toVersion: "v2",
      compatibility: "partially compatible",
      impactScope: "domain-level"
    });
    expect(report[0].summary).toContain("v1");
    expect(report[0].summary).toContain("v2");
  });

  it("exposes versioned signal definitions without overwriting old meaning", () => {
    const legacy = getSignalDefinition("savingsMomentum", "v1");
    const current = getSignalDefinition("savingsMomentum", "v2");

    expect(legacy.version).toBe("v1");
    expect(current.version).toBe("v2");
    expect(legacy.canonicalLabel).toBe(current.canonicalLabel);
    expect(legacy.description).not.toBe(current.description);
    expect(legacy.aliases).toContain("positive savings rate");
    expect(current.aliases).toContain("resilient savings");
  });
});