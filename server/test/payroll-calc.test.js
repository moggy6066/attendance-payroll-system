const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateNet } = require('../src/services/payrollCalc');

test('daily rate x paid days minus advances (fake data)', () => {
  const r = calculateNet({ salary: 6000, dailyRate: 750, paidDays: 8, advanceDeductions: 1000 });
  assert.equal(r.earned, 6000);
  assert.equal(r.netSalary, 5000);
  assert.equal(r.lateDeductions, 0);
});

test('mission days are paid because they are counted in paidDays', () => {
  const withMission = calculateNet({ salary: 0, dailyRate: 500, paidDays: 3 + 2 });
  assert.equal(withMission.netSalary, 2500);
});

test('net never goes below zero', () => {
  assert.equal(calculateNet({ salary: 0, dailyRate: 100, paidDays: 1, advanceDeductions: 500 }).netSalary, 0);
});

test('without a daily rate the legacy monthly rule applies', () => {
  const r = calculateNet({ salary: 2200, dailyRate: null, lateDays: 2, absentDays: 1, advanceDeductions: 100 });
  assert.equal(r.lateDeductions, 110);
  assert.equal(r.netSalary, 1990);
});

test('rounding is done in cents', () => {
  assert.equal(calculateNet({ salary: 0, dailyRate: 333.33, paidDays: 3 }).netSalary, 999.99);
});
