import type { FinancialSignal } from "@/lib/financial-signals";
import { scoreFinancialSignal } from "@/lib/financial-signals";
import type { FinancialSignalMemory } from "@/lib/financial-signal-memory";

export type SignalPolarity = "positive" | "negative" | "neutral";

export type SignalDomain = "liquidity" | "spending" | "income" | "recurrence" | "other";

export type SignalConflictGroup = {
  domain: SignalDomain;
  reason: string;
  dominantSignal: FinancialSignal;
  signals: FinancialSignal[];
};

export type DomainSurface = {
  dominant: FinancialSignal[];
  secondary: FinancialSignal[];
  suppressed: FinancialSignal[];
  conflictingGroups: SignalConflictGroup[];
};

export type SignalSurface = {
  // metadata about the surface generation
  generatedAt: string;
  domains: Record<SignalDomain, DomainSurface>;
  // compatibility top-level aggregates
  dominant: FinancialSignal[];
  secondary: FinancialSignal[];
  suppressed: FinancialSignal[];
  // simple confidence distribution to help UIs and tests
  confidenceDistribution: {
    overall: number; // mean dominance score across considered signals
    byDomain: Partial<Record<SignalDomain, number>>;
  };
};

type ScoredSignal = {
  signal: FinancialSignal;
  key: string;
  domain: SignalDomain;
  polarity: SignalPolarity;
  baseScore: number;
  supportScore: number;
  dominanceScore: number;
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(value, min));
}

function compareStrings(left: string, right: string) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareScoredSignals(left: ScoredSignal, right: ScoredSignal) {
  return (
    right.dominanceScore - left.dominanceScore ||
    right.baseScore - left.baseScore ||
    right.supportScore - left.supportScore ||
    right.signal.severity - left.signal.severity ||
    right.signal.confidence - left.signal.confidence ||
    right.signal.persistence - left.signal.persistence ||
    compareStrings(left.key, right.key) ||
    compareStrings(left.signal.title, right.signal.title) ||
    compareStrings(left.signal.type, right.signal.type)
  );
}

function compareSignals(left: FinancialSignal, right: FinancialSignal) {
  return (
    scoreFinancialSignal(right) - scoreFinancialSignal(left) ||
    right.severity - left.severity ||
    right.confidence - left.confidence ||
    right.persistence - left.persistence ||
    compareStrings(getClusterKey(left), getClusterKey(right)) ||
    compareStrings(left.title, right.title) ||
    compareStrings(left.type, right.type)
  );
}

function getSignalDomain(signal: FinancialSignal): SignalDomain {
  if (signal.type === "cashFlowRisk" || signal.type === "savingsMomentum") {
    return "liquidity";
  }

  if (signal.type === "budgetPressure" || signal.type === "categoryDominance" || signal.type === "spendingAcceleration") {
    return "spending";
  }

  if (signal.type === "incomeInstability") {
    return "income";
  }

  if (signal.type === "recurringExpense") {
    return "recurrence";
  }

  return "other";
}

function getSignalPolarity(signal: FinancialSignal): SignalPolarity {
  if (signal.type === "cashFlowRisk" || signal.type === "budgetPressure" || signal.type === "categoryDominance" || signal.type === "spendingAcceleration" || signal.type === "incomeInstability") {
    return "negative";
  }

  if (signal.type === "savingsMomentum") {
    return signal.direction === "improving" ? "positive" : "neutral";
  }

  return "neutral";
}

function getSignalEntityKey(signal: FinancialSignal) {
  return signal.context?.category ?? signal.context?.merchant ?? signal.title;
}

function getClusterKey(signal: FinancialSignal) {
  return `${getSignalDomain(signal)}:${getSignalEntityKey(signal)}`;
}

function getSupportScore(signal: FinancialSignal, memory?: FinancialSignalMemory) {
  if (!memory) {
    return 0;
  }

  const lifecycleBonus =
    memory.lifecycle === "persistent" ? 0.18 : memory.lifecycle === "active" ? 0.12 : memory.lifecycle === "resolving" ? 0.04 : 0.02;

  const persistenceScore = clamp(memory.consecutivePeriods / 4);
  const momentumScore = clamp(Math.abs(memory.momentum) / 0.2) * 0.08;

  return persistenceScore * 0.22 + lifecycleBonus + momentumScore + clamp(signal.persistence) * 0.08;
}

function getDominanceScore(signal: FinancialSignal, memory?: FinancialSignalMemory) {
  const baseScore = scoreFinancialSignal(signal);
  const supportScore = getSupportScore(signal, memory);

  return clamp(baseScore * 0.72 + supportScore, 0, 1);
}

export function resolveSignalDominance(
  signals: FinancialSignal[],
  history: FinancialSignalMemory[] = [],
  generatedAt = "signal-surface"
): SignalSurface {
  const memoryByKey = new Map(history.map((signal) => [getClusterKey(signal), signal]));
  const scoredSignals: ScoredSignal[] = signals.map((signal) => {
    const key = getClusterKey(signal);
    const memory = memoryByKey.get(key);

    return {
      signal,
      key,
      domain: getSignalDomain(signal),
      polarity: getSignalPolarity(signal),
      baseScore: scoreFinancialSignal(signal),
      supportScore: getSupportScore(signal, memory),
      dominanceScore: getDominanceScore(signal, memory)
    };
  });

  const orderedSignals = [...scoredSignals].sort(compareScoredSignals);

  const domainGroups = new Map<SignalDomain, ScoredSignal[]>();

  for (const entry of orderedSignals) {
    const domain = domainGroups.get(entry.domain) ?? [];
    domain.push(entry);
    domainGroups.set(entry.domain, domain);
  }

  function buildDomainSurface(entries: ScoredSignal[]): DomainSurface {
    const clusterGroups = new Map<string, ScoredSignal[]>();

    for (const entry of entries) {
      const cluster = clusterGroups.get(entry.key) ?? [];
      cluster.push(entry);
      clusterGroups.set(entry.key, cluster);
    }

    const dominant: FinancialSignal[] = [];
    const secondary: FinancialSignal[] = [];
    const suppressed: FinancialSignal[] = [];

    const clusterEntries = [...clusterGroups.entries()].sort(([leftKey, leftCluster], [rightKey, rightCluster]) => {
      const leftWinner = [...leftCluster].sort(compareScoredSignals)[0];
      const rightWinner = [...rightCluster].sort(compareScoredSignals)[0];

      if (leftWinner && rightWinner) {
        return compareScoredSignals(leftWinner, rightWinner) || compareStrings(leftKey, rightKey);
      }

      if (leftWinner) return -1;
      if (rightWinner) return 1;

      return compareStrings(leftKey, rightKey);
    });

    for (const [, cluster] of clusterEntries) {
      const orderedCluster = [...cluster].sort(compareScoredSignals);
      const [winner, ...rest] = orderedCluster;

      if (!winner) continue;

      const dominanceThreshold = winner.dominanceScore >= 0.55 || dominant.length < 3;

      if (dominanceThreshold) {
        dominant.push(winner.signal);
      } else {
        secondary.push(winner.signal);
      }

      for (const contender of rest) suppressed.push(contender.signal);
    }

    const dominantKeys = new Set(dominant.map(getClusterKey));
    const secondaryCandidates = entries
      .filter((entry) => !dominantKeys.has(entry.key) && !suppressed.includes(entry.signal))
      .sort(compareScoredSignals);

    for (const candidate of secondaryCandidates) {
      if (candidate.dominanceScore >= 0.4) secondary.push(candidate.signal);
      else suppressed.push(candidate.signal);
    }

    const conflictingGroups: SignalConflictGroup[] = [];

    const polarities = new Set(entries.map((entry) => entry.polarity));
    if (polarities.size >= 2) {
      const ordered = [...entries].sort(compareScoredSignals);

      conflictingGroups.push({
        domain: entries[0].domain,
        reason: `Competing signals are pulling in different directions inside the ${entries[0].domain} domain.`,
        dominantSignal: ordered[0].signal,
        signals: ordered.map((entry) => entry.signal)
      });
    }

    const uniqueByCluster = (items: FinancialSignal[]) => {
      const seen = new Set<string>();

      return items.filter((signal) => {
        const key = getClusterKey(signal);

        if (seen.has(key)) return false;

        seen.add(key);
        return true;
      });
    };

    return {
      dominant: uniqueByCluster(dominant).sort(compareSignals),
      secondary: uniqueByCluster(secondary).sort(compareSignals),
      suppressed: uniqueByCluster(suppressed).sort(compareSignals),
      conflictingGroups
    };
  }

  // Build per-domain surfaces
  const domains: Record<SignalDomain, DomainSurface> = {
    liquidity: buildDomainSurface(domainGroups.get("liquidity") ?? []),
    spending: buildDomainSurface(domainGroups.get("spending") ?? []),
    income: buildDomainSurface(domainGroups.get("income") ?? []),
    recurrence: buildDomainSurface(domainGroups.get("recurrence") ?? []),
    other: buildDomainSurface(domainGroups.get("other") ?? [])
  };

  // Aggregate top-level lists across domains (preserve cluster-uniqueness)
  const allDominant = Object.values(domains).flatMap((d) => d.dominant);
  const allSecondary = Object.values(domains).flatMap((d) => d.secondary);
  const allSuppressed = Object.values(domains).flatMap((d) => d.suppressed);

  const uniqueByClusterGlobal = (items: FinancialSignal[]) => {
    const seen = new Set<string>();

    return items.filter((signal) => {
      const key = getClusterKey(signal);

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });
  };

  // Confidence distribution: mean dominance score overall and per domain
  const overallMean = scoredSignals.length === 0 ? 0 : scoredSignals.reduce((s, e) => s + e.dominanceScore, 0) / scoredSignals.length;
  const byDomain: Partial<Record<SignalDomain, number>> = {};

  for (const domain of ["liquidity", "spending", "income", "recurrence", "other"] as SignalDomain[]) {
    const entries = domainGroups.get(domain) ?? [];
    byDomain[domain] = entries.length === 0 ? 0 : entries.reduce((s, e) => s + e.dominanceScore, 0) / entries.length;
  }

  return {
    generatedAt,
    domains,
    dominant: uniqueByClusterGlobal(allDominant).sort(compareSignals),
    secondary: uniqueByClusterGlobal(allSecondary).sort(compareSignals),
    suppressed: uniqueByClusterGlobal(allSuppressed).sort(compareSignals),
    confidenceDistribution: {
      overall: overallMean,
      byDomain
    }
  };
}