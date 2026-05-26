export function getCurrentMonthYear(date = new Date()) {
  return {
    month: date.getMonth() + 1,
    year: date.getFullYear()
  };
}

export function getMonthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);

  return { start, end };
}

export function formatMonthYear(month: number, year: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric"
  }).format(new Date(year, month - 1, 1));
}

export function clampBudgetProgress(spent: number, limit: number) {
  if (limit <= 0) {
    return 0;
  }

  return Math.min(100, (spent / limit) * 100);
}