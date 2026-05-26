import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type { FinancialSignal } from "@/lib/financial-signals";
import type { SignalConflictGroup, SignalDomain, SignalSurface } from "@/lib/signal-dominance";

type SerializedSignal = {
  type: FinancialSignal["type"];
  title: string;
  severity: number;
  confidence: number;
  persistence: number;
  recencyWeight?: number;
  direction?: FinancialSignal["direction"];
  context?: FinancialSignal["context"];
  lifecycle?: string;
  firstSeenAt?: { month: number; year: number };
  lastSeenAt?: { month: number; year: number };
  consecutivePeriods?: number;
  momentum?: number;
};

type SerializedDomainSurface = {
  dominant: SerializedSignal[];
  secondary: SerializedSignal[];
  suppressed: SerializedSignal[];
  conflictingGroups: Array<{
    domain: SignalDomain;
    reason: string;
    dominantSignal: SerializedSignal;
    signals: SerializedSignal[];
  }>;
};

export type SerializedSignalSurface = {
  generatedAt: string;
  domains: Record<SignalDomain, SerializedDomainSurface>;
  dominant: SerializedSignal[];
  secondary: SerializedSignal[];
  suppressed: SerializedSignal[];
  confidenceDistribution: {
    overall: number;
    byDomain: Partial<Record<SignalDomain, number>>;
  };
};

export type SignalSurfaceChangeClassification = "match" | "benign" | "structural" | "semantic" | "invalid";

export type SignalSurfaceChangeReport = {
  classification: SignalSurfaceChangeClassification;
  summary: string;
  domainChanges: Array<{
    domain: SignalDomain;
    kind: Exclude<SignalSurfaceChangeClassification, "match">;
    detail: string;
  }>;
  invalidReasons: string[];
};

export type SignalSurfaceEpisode = {
  name: string;
  actual: unknown;
  expected: unknown;
  allowedClassifications: SignalSurfaceChangeClassification[];
};

export function roundTo(value: number, digits = 6) {
  return Number(value.toFixed(digits));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, sortValue((value as Record<string, unknown>)[key])])
    );
  }

  return value;
}

function stableJson(value: unknown) {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    const normalized = value.map(canonicalJson);

    return [...normalized].sort((left, right) => compareStrings(stableJson(left), stableJson(right)));
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, canonicalJson((value as Record<string, unknown>)[key])])
    );
  }

  return value;
}

function compareStrings(left: string, right: string) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateSerializedSignal(value: unknown): value is SerializedSignal {
  return (
    isPlainObject(value) &&
    typeof value.type === "string" &&
    typeof value.title === "string" &&
    typeof value.severity === "number" &&
    typeof value.confidence === "number" &&
    typeof value.persistence === "number"
  );
}

function validateSerializedSignalSurface(value: unknown): value is SerializedSignalSurface {
  if (!isPlainObject(value)) return false;
  if (typeof value.generatedAt !== "string") return false;
  if (!isPlainObject(value.domains)) return false;
  if (!Array.isArray(value.dominant) || !Array.isArray(value.secondary) || !Array.isArray(value.suppressed)) return false;
  if (!isPlainObject(value.confidenceDistribution)) return false;

  return ["liquidity", "spending", "income", "recurrence", "other"].every((domain) => {
    const domainSurface = value.domains[domain];

    return (
      isPlainObject(domainSurface) &&
      Array.isArray(domainSurface.dominant) &&
      Array.isArray(domainSurface.secondary) &&
      Array.isArray(domainSurface.suppressed) &&
      Array.isArray(domainSurface.conflictingGroups) &&
      domainSurface.dominant.every(validateSerializedSignal) &&
      domainSurface.secondary.every(validateSerializedSignal) &&
      domainSurface.suppressed.every(validateSerializedSignal)
    );
  });
}

function getSignalSignature(signal: SerializedSignal) {
  return stableJson(canonicalJson(signal));
}

function getDomainSignature(surface: SerializedDomainSurface) {
  return stableJson(surface);
}

function getSurfaceSignature(surface: SerializedSignalSurface) {
  return stableJson(surface);
}

function summarizeDomainChange(domain: SignalDomain, left: SerializedDomainSurface, right: SerializedDomainSurface) {
  const countsChanged =
    left.dominant.length !== right.dominant.length ||
    left.secondary.length !== right.secondary.length ||
    left.suppressed.length !== right.suppressed.length ||
    left.conflictingGroups.length !== right.conflictingGroups.length;

  if (countsChanged) {
    return {
      domain,
      kind: "structural" as const,
      detail: `dominant ${left.dominant.length} -> ${right.dominant.length}, secondary ${left.secondary.length} -> ${right.secondary.length}, suppressed ${left.suppressed.length} -> ${right.suppressed.length}, conflicts ${left.conflictingGroups.length} -> ${right.conflictingGroups.length}`
    };
  }

  if (getDomainSignature(left) !== getDomainSignature(right)) {
    const leftDominant = left.dominant[0];
    const rightDominant = right.dominant[0];

    return {
      domain,
      kind: "semantic" as const,
      detail: `${leftDominant ? getSignalSignature(leftDominant) : "none"} -> ${rightDominant ? getSignalSignature(rightDominant) : "none"}`
    };
  }

  return {
    domain,
    kind: "benign" as const,
    detail: "ordering-only"
  };
}

function buildInvalidReport(reasons: string[]): SignalSurfaceChangeReport {
  return {
    classification: "invalid",
    summary: "SignalSurface comparison failed because one side is malformed.",
    domainChanges: [],
    invalidReasons: reasons
  };
}

function buildStructuralOrSemanticReport(left: SerializedSignalSurface, right: SerializedSignalSurface): SignalSurfaceChangeReport {
  const domainChanges = ["liquidity", "spending", "income", "recurrence", "other"].map((domain) =>
    summarizeDomainChange(domain, left.domains[domain], right.domains[domain])
  );

  const structuralChanges = domainChanges.filter((change) => change.kind === "structural");
  const semanticChanges = domainChanges.filter((change) => change.kind === "semantic");

  if (structuralChanges.length > 0) {
    return {
      classification: "structural",
      summary: `${structuralChanges.length} domain(s) changed shape.`,
      domainChanges,
      invalidReasons: []
    };
  }

  return {
    classification: "semantic",
    summary: semanticChanges.length > 0 ? `${semanticChanges.length} domain(s) changed dominant interpretation.` : "Signal values changed without a structural shift.",
    domainChanges,
    invalidReasons: []
  };
}

export function classifySignalSurfaceChange(left: unknown, right: unknown): SignalSurfaceChangeReport {
  if (!validateSerializedSignalSurface(left)) {
    return buildInvalidReport(["left side is not a valid serialized SignalSurface."]);
  }

  if (!validateSerializedSignalSurface(right)) {
    return buildInvalidReport(["right side is not a valid serialized SignalSurface."]);
  }

  const leftRaw = getSurfaceSignature(left);
  const rightRaw = getSurfaceSignature(right);

  if (leftRaw === rightRaw) {
    return {
      classification: "match",
      summary: "SignalSurface matches exactly.",
      domainChanges: [],
      invalidReasons: []
    };
  }

  if (stableJson(canonicalJson(left)) === stableJson(canonicalJson(right))) {
    return {
      classification: "benign",
      summary: "SignalSurface content is unchanged; only ordering shifted.",
      domainChanges: [
        {
          domain: "liquidity",
          kind: "benign",
          detail: "ordering-only"
        },
        {
          domain: "spending",
          kind: "benign",
          detail: "ordering-only"
        },
        {
          domain: "income",
          kind: "benign",
          detail: "ordering-only"
        },
        {
          domain: "recurrence",
          kind: "benign",
          detail: "ordering-only"
        },
        {
          domain: "other",
          kind: "benign",
          detail: "ordering-only"
        }
      ],
      invalidReasons: []
    };
  }

  return buildStructuralOrSemanticReport(left, right);
}

export function formatSignalSurfaceChangeReport(name: string, report: SignalSurfaceChangeReport, allowedClassifications: SignalSurfaceChangeClassification[]) {
  const lines = [
    `Episode: ${name}`,
    `Classification: ${report.classification}`,
    `Allowed: ${allowedClassifications.join(", ")}`,
    `Summary: ${report.summary}`
  ];

  if (report.invalidReasons.length > 0) {
    lines.push(`Invalid reasons: ${report.invalidReasons.join("; ")}`);
  }

  for (const change of report.domainChanges) {
    lines.push(`${change.domain}: ${change.kind} - ${change.detail}`);
  }

  return lines.join("\n");
}

export function assertSignalSurfaceEpisode(episode: SignalSurfaceEpisode) {
  const report = classifySignalSurfaceChange(episode.actual, episode.expected);

  if (!episode.allowedClassifications.includes(report.classification)) {
    throw new Error(formatSignalSurfaceChangeReport(episode.name, report, episode.allowedClassifications));
  }

  return report;
}

function buildLineDiff(left: string, right: string) {
  const leftLines = left.trimEnd().split("\n");
  const rightLines = right.trimEnd().split("\n");
  const maxLines = Math.max(leftLines.length, rightLines.length);

  for (let index = 0; index < maxLines; index += 1) {
    if (leftLines[index] !== rightLines[index]) {
      const contextStart = Math.max(0, index - 2);
      const contextEnd = Math.min(maxLines, index + 3);
      const diffLines = [
        "SignalSurface fixture mismatch detected.",
        `First difference at line ${index + 1}:`,
        ...leftLines.slice(contextStart, contextEnd).map((line, lineIndex) => {
          const absoluteLine = contextStart + lineIndex;
          return absoluteLine === index ? `- ${line}` : `  ${line}`;
        }),
        ...rightLines.slice(contextStart, contextEnd).map((line, lineIndex) => {
          const absoluteLine = contextStart + lineIndex;
          return absoluteLine === index ? `+ ${line}` : `  ${line}`;
        })
      ];

      return diffLines.join("\n");
    }
  }

  return "SignalSurface fixture mismatch detected.";
}

function serializeSignal(signal: FinancialSignal & Record<string, any>): SerializedSignal {
  const serialized: SerializedSignal = {
    type: signal.type,
    title: signal.title,
    severity: roundTo(signal.severity),
    confidence: roundTo(signal.confidence),
    persistence: roundTo(signal.persistence),
  };

  if (signal.recencyWeight !== undefined) {
    serialized.recencyWeight = roundTo(signal.recencyWeight);
  }

  if (signal.direction !== undefined) {
    serialized.direction = signal.direction;
  }

  if (signal.context !== undefined) {
    serialized.context = {
      ...signal.context,
      ...(signal.context.delta === undefined ? {} : { delta: roundTo(signal.context.delta) })
    };
  }

  if (signal.lifecycle !== undefined) {
    serialized.lifecycle = signal.lifecycle;
  }

  if (signal.firstSeenAt !== undefined) {
    serialized.firstSeenAt = signal.firstSeenAt;
  }

  if (signal.lastSeenAt !== undefined) {
    serialized.lastSeenAt = signal.lastSeenAt;
  }

  if (signal.consecutivePeriods !== undefined) {
    serialized.consecutivePeriods = signal.consecutivePeriods;
  }

  if (signal.momentum !== undefined) {
    serialized.momentum = roundTo(signal.momentum);
  }

  return serialized;
}

function serializeDomainSurface(surface: SignalSurface["domains"][SignalDomain]): SerializedDomainSurface {
  return {
    dominant: surface.dominant.map(serializeSignal),
    secondary: surface.secondary.map(serializeSignal),
    suppressed: surface.suppressed.map(serializeSignal),
    conflictingGroups: surface.conflictingGroups.map((group: SignalConflictGroup) => ({
      domain: group.domain,
      reason: group.reason,
      dominantSignal: serializeSignal(group.dominantSignal),
      signals: group.signals.map(serializeSignal)
    }))
  };
}

export function serializeSignalSurface(surface: SignalSurface): SerializedSignalSurface {
  return {
    generatedAt: surface.generatedAt,
    domains: {
      liquidity: serializeDomainSurface(surface.domains.liquidity),
      spending: serializeDomainSurface(surface.domains.spending),
      income: serializeDomainSurface(surface.domains.income),
      recurrence: serializeDomainSurface(surface.domains.recurrence),
      other: serializeDomainSurface(surface.domains.other)
    },
    dominant: surface.dominant.map(serializeSignal),
    secondary: surface.secondary.map(serializeSignal),
    suppressed: surface.suppressed.map(serializeSignal),
    confidenceDistribution: {
      overall: roundTo(surface.confidenceDistribution.overall),
      byDomain: Object.fromEntries(
        Object.entries(surface.confidenceDistribution.byDomain).map(([domain, value]) => [domain, roundTo(value as number)])
      ) as Partial<Record<SignalDomain, number>>
    }
  };
}

export function diffSignalSurface(left: unknown, right: unknown) {
  return buildLineDiff(stableJson(left), stableJson(right));
}

export function compareSignalSurfaces(left: unknown, right: unknown) {
  const report = classifySignalSurfaceChange(left, right);

  return {
    equal: report.classification === "match" || report.classification === "benign",
    classification: report.classification,
    diff: report.classification === "match" ? "" : formatSignalSurfaceChangeReport("SignalSurface comparison", report, [report.classification])
  };
}

export function compareSignalSurfacesStrict(left: unknown, right: unknown) {
  const comparison = compareSignalSurfaces(left, right);

  if (!comparison.equal) {
    throw new Error(comparison.diff);
  }
}

export function approveFixtureUpdate(fixturePath: string, nextFixture: unknown) {
  if (process.env.UPDATE_SIGNAL_SURFACE_FIXTURES !== "1") {
    throw new Error("Fixture updates are locked. Set UPDATE_SIGNAL_SURFACE_FIXTURES=1 to approve this change.");
  }

  mkdirSync(dirname(fixturePath), { recursive: true });
  writeFileSync(fixturePath, stableJson(nextFixture), "utf8");
}

export function readSignalSurfaceFixture(fixturePath: string) {
  return JSON.parse(readFileSync(fixturePath, "utf8"));
}