import type { FinancialSignal, FinancialSignalType } from "@/lib/financial-signals";

export type SignalDefinitionVersion = "v1" | "v2";

export type SignalCompatibilityStatus = "compatible" | "partially compatible" | "breaking";

export type SignalMeaningAnnotation = {
  version: SignalDefinitionVersion;
  canonicalLabel: string;
  description: string;
  aliases: string[];
  compatibility: SignalCompatibilityStatus;
  impactScope: "signal-level" | "domain-level" | "system-level";
};

export type SignalMeaningDrift = {
  signalType: FinancialSignalType;
  fromVersion: SignalDefinitionVersion;
  toVersion: SignalDefinitionVersion;
  compatibility: SignalCompatibilityStatus;
  impactScope: SignalMeaningAnnotation["impactScope"];
  summary: string;
};

type SignalMeaningDefinition = Omit<SignalMeaningAnnotation, "version">;

const signalMeaningRegistry: Record<SignalDefinitionVersion, Record<FinancialSignalType, SignalMeaningDefinition>> = {
  v1: {
    cashFlowRisk: {
      canonicalLabel: "cashFlowRisk",
      description: "Income is not covering expenses, so the account balance is under pressure.",
      aliases: ["negative cashflow"],
      compatibility: "compatible",
      impactScope: "signal-level"
    },
    budgetPressure: {
      canonicalLabel: "budgetPressure",
      description: "Budget usage is approaching or exceeding its planned ceiling.",
      aliases: ["overspend risk"],
      compatibility: "compatible",
      impactScope: "signal-level"
    },
    categoryDominance: {
      canonicalLabel: "categoryDominance",
      description: "Spending is concentrating in a small number of categories.",
      aliases: ["concentration risk"],
      compatibility: "compatible",
      impactScope: "domain-level"
    },
    incomeInstability: {
      canonicalLabel: "incomeInstability",
      description: "Income is uneven or declining across observed periods.",
      aliases: ["income volatility"],
      compatibility: "compatible",
      impactScope: "signal-level"
    },
    spendingAcceleration: {
      canonicalLabel: "spendingAcceleration",
      description: "Spending is increasing faster than the reference baseline.",
      aliases: ["spend acceleration"],
      compatibility: "compatible",
      impactScope: "domain-level"
    },
    recurringExpense: {
      canonicalLabel: "recurringExpense",
      description: "A repeating expense pattern is present and stable enough to track.",
      aliases: ["subscription pattern"],
      compatibility: "compatible",
      impactScope: "signal-level"
    },
    savingsMomentum: {
      canonicalLabel: "savingsMomentum",
      description: "Income is leaving room after spending and the remaining balance is improving.",
      aliases: ["positive savings rate"],
      compatibility: "compatible",
      impactScope: "signal-level"
    }
  },
  v2: {
    cashFlowRisk: {
      canonicalLabel: "cashFlowRisk",
      description: "Cash flow pressure is active, with expenses exceeding income in the current window.",
      aliases: ["negative cashflow", "balance pressure"],
      compatibility: "compatible",
      impactScope: "signal-level"
    },
    budgetPressure: {
      canonicalLabel: "budgetPressure",
      description: "Budget usage is high and concentrated near a limit, which can precede overspend.",
      aliases: ["overspend risk", "limit pressure"],
      compatibility: "partially compatible",
      impactScope: "signal-level"
    },
    categoryDominance: {
      canonicalLabel: "categoryDominance",
      description: "A category is dominating spend composition enough to matter for interpretation.",
      aliases: ["concentration risk", "category concentration"],
      compatibility: "compatible",
      impactScope: "domain-level"
    },
    incomeInstability: {
      canonicalLabel: "incomeInstability",
      description: "Income pattern variability is material enough to affect temporal interpretation.",
      aliases: ["income volatility"],
      compatibility: "compatible",
      impactScope: "signal-level"
    },
    spendingAcceleration: {
      canonicalLabel: "spendingAcceleration",
      description: "Spending growth is sustained across periods and should be read as trend pressure.",
      aliases: ["spend acceleration"],
      compatibility: "partially compatible",
      impactScope: "domain-level"
    },
    recurringExpense: {
      canonicalLabel: "recurringExpense",
      description: "A repeating expense pattern is stable enough to be treated as persistent behavior.",
      aliases: ["subscription pattern"],
      compatibility: "compatible",
      impactScope: "signal-level"
    },
    savingsMomentum: {
      canonicalLabel: "savingsMomentum",
      description: "Savings momentum is positive and should be read as resilient balance formation.",
      aliases: ["positive savings rate", "resilient savings"],
      compatibility: "compatible",
      impactScope: "signal-level"
    }
  }
};

export function getSignalDefinition(signalType: FinancialSignalType, version: SignalDefinitionVersion = "v1"): SignalMeaningAnnotation {
  const definition = signalMeaningRegistry[version][signalType];

  return {
    version,
    ...definition
  };
}

export function annotateFinancialSignal(signal: FinancialSignal, version: SignalDefinitionVersion = "v1") {
  const definition = getSignalDefinition(signal.type, version);

  return {
    ...signal,
    meaning: definition,
    meaningVersion: version
  };
}

export function annotateFinancialSignals(signals: FinancialSignal[], version: SignalDefinitionVersion = "v1") {
  return signals.map((signal) => annotateFinancialSignal(signal, version));
}

export function compareSignalMeaning(signalType: FinancialSignalType, fromVersion: SignalDefinitionVersion, toVersion: SignalDefinitionVersion): SignalMeaningDrift {
  const fromDefinition = getSignalDefinition(signalType, fromVersion);
  const toDefinition = getSignalDefinition(signalType, toVersion);

  return {
    signalType,
    fromVersion,
    toVersion,
    compatibility: toDefinition.compatibility,
    impactScope: toDefinition.impactScope,
    summary: `${fromDefinition.canonicalLabel} meaning evolved from ${fromVersion} to ${toVersion}: ${fromDefinition.description} -> ${toDefinition.description}`
  };
}

export function buildMeaningEvolutionReport(signalTypes: FinancialSignalType[], fromVersion: SignalDefinitionVersion, toVersion: SignalDefinitionVersion) {
  return signalTypes.map((signalType) => compareSignalMeaning(signalType, fromVersion, toVersion));
}