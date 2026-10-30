// Pure payroll arithmetic (no database), so it can be tested directly.
//
// Rules
// - Employee with a daily rate:  gross = dailyRate x paid days
//   (paid days = present + late + mission), minus advances and deductions.
// - Employee without a daily rate (monthly, legacy rule): basic salary minus
//   5% of the daily rate (salary / 22) per late day and a full daily rate per absent day,
//   minus advances and deductions.
const WORK_DAYS_FALLBACK = 22;
const LATE_PENALTY = 0.05;

const toCents = (n) => Math.round(Number(n) * 100);
const fromCents = (c) => c / 100;

function calculateNet({
  salary,
  dailyRate,
  paidDays = 0,
  lateDays = 0,
  absentDays = 0,
  advanceDeductions = 0,
  bonuses = 0
}) {
  const basic = toCents(salary);
  const hasRate = dailyRate !== null && dailyRate !== undefined && Number(dailyRate) > 0;
  let earned;
  let lateDeductions = 0;
  if (hasRate) {
    earned = toCents(dailyRate) * paidDays;
  } else {
    const daily = basic / WORK_DAYS_FALLBACK;
    lateDeductions = Math.round(lateDays * daily * LATE_PENALTY + absentDays * daily);
    earned = basic - lateDeductions;
  }
  const net = Math.max(0, earned + toCents(bonuses) - toCents(advanceDeductions));
  return {
    earned: fromCents(earned),
    lateDeductions: fromCents(lateDeductions),
    advanceDeductions: fromCents(toCents(advanceDeductions)),
    netSalary: fromCents(net)
  };
}

module.exports = { calculateNet, WORK_DAYS_FALLBACK, LATE_PENALTY };
