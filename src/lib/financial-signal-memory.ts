import type { FinancialSignal } from "@/lib/financial-signals";

export type FinancialSignalLifecycle = "emerging" | "active" | "persistent" | "resolving" | "resolved";

export type DatedFinancialSignals = {
  month: number;
  year: number;
  signals: FinancialSignal[];
};

export type FinancialSignalMemory = FinancialSignal & {
  lifecycle: FinancialSignalLifecycle;
  firstSeenAt: {
    month: number;
    year: number;
  };
  lastSeenAt: {
    month: number;
    year: number;
  };
  consecutivePeriods: number;
  momentum: number;
};

export type ResolvedFinancialSignal = {
  type: FinancialSignal["type"];
  title: string;
  lastSeenAt: {
    month: number;
    year: number;
  };
  inactivePeriods: number;
  lifecycle: Exclude<FinancialSignalLifecycle, "emerging" | "active" | "persistent">;
};

function toPeriodValue(month: number, year: number) {
  return year * 12 + (month - 1);
}

function getSignalKey(signal: FinancialSignal) {
  return [signal.type, signal.context?.category ?? "", signal.context?.merchant ?? ""].join("|");
}

function getSignalScore(signal: FinancialSignal) {
  return signal.severity * 0.4 + signal.confidence * 0.25 + signal.persistence * 0.2 + (signal.recencyWeight ?? 1) * 0.15;
}

function getSignalLabel(signal: FinancialSignal) {
  return signal.context?.category ?? signal.context?.merchant ?? signal.title;
}

export function buildFinancialSignalMemory(history: DatedFinancialSignals[]): {
  current: FinancialSignalMemory[];
  resolved: ResolvedFinancialSignal[];
} {
  const orderedHistory = [...history].sort((left, right) => toPeriodValue(left.month, left.year) - toPeriodValue(right.month, right.year));
  const currentPeriod = orderedHistory[orderedHistory.length - 1];

  if (!currentPeriod) {
    return { current: [], resolved: [] };
  }

  const currentValue = toPeriodValue(currentPeriod.month, currentPeriod.year);
  const occurrencesByKey = new Map<string, DatedFinancialSignals[]>();

  for (const period of orderedHistory) {
    for (const signal of period.signals) {
      const key = getSignalKey(signal);
      const occurrences = occurrencesByKey.get(key) ?? [];

      occurrences.push(period);
      occurrencesByKey.set(key, occurrences);
    }
  }

  const currentSignals = currentPeriod.signals.map((signal) => {
    const key = getSignalKey(signal);
    const occurrences = occurrencesByKey.get(key) ?? [];
    const historicalOccurrences = occurrences.filter((period) => period !== currentPeriod);
    const firstSeenAt = historicalOccurrences[0] ?? currentPeriod;
    const previousOccurrence = historicalOccurrences[historicalOccurrences.length - 1];

    let consecutivePeriods = 1;
    for (let index = orderedHistory.length - 2; index >= 0; index -= 1) {
      const period = orderedHistory[index];
      const hasSignal = (period.signals ?? []).some((candidate) => getSignalKey(candidate) === key);

      if (!hasSignal) {
        break;
      }

      consecutivePeriods += 1;
    }

    const momentum = previousOccurrence
      ? getSignalScore(signal) - getSignalScore(previousOccurrence.signals.find((candidate) => getSignalKey(candidate) === key) ?? signal)
      : 0;

    const lifecycle: FinancialSignalLifecycle =
      consecutivePeriods >= 4 ? "persistent" : consecutivePeriods >= 2 ? "active" : "emerging";

    return {
      ...signal,
      lifecycle,
      firstSeenAt: {
        month: firstSeenAt.month,
        year: firstSeenAt.year
      },
      lastSeenAt: {
        month: currentPeriod.month,
        year: currentPeriod.year
      },
      consecutivePeriods,
      momentum
    };
  });

  const currentKeys = new Set(currentPeriod.signals.map(getSignalKey));
  const resolvedByKey = new Map<string, ResolvedFinancialSignal>();

  for (const period of orderedHistory.slice(0, -1)) {
    for (const signal of period.signals) {
      const key = getSignalKey(signal);

      if (currentKeys.has(key)) {
        continue;
      }

      const monthsInactive = Math.max(1, currentValue - toPeriodValue(period.month, period.year));
      const existing = resolvedByKey.get(key);

      if (existing && existing.inactivePeriods <= monthsInactive) {
        continue;
      }

      resolvedByKey.set(key, {
        type: signal.type,
        title: getSignalLabel(signal),
        lastSeenAt: {
          month: period.month,
          year: period.year
        },
        inactivePeriods: monthsInactive,
        lifecycle: monthsInactive > 1 ? "resolved" : "resolving"
      });
    }
  }

  const resolved = [...resolvedByKey.values()];

  return {
    current: currentSignals,
    resolved
  };
}