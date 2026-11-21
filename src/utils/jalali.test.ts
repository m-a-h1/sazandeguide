import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareJalaliDates,
  formatJalaliDisplay,
  gregorianToJalali,
  isJalaliInRange,
  isJalaliLeapYear,
  parseJalaliDate,
} from './jalali';

test('parseJalaliDate validates standard YYYY/MM/DD Persian dates', () => {
  const valid = parseJalaliDate('1405/07/27');
  assert.equal(valid.valid, true);
  assert.equal(valid.normalized, '1405/07/27');

  const persianDigits = parseJalaliDate('۱۴۰۵/۰۷/۲۷');
  assert.equal(persianDigits.valid, true);
  assert.equal(persianDigits.normalized, '1405/07/27');
});

test('parseJalaliDate rejects Gregorian dates, text, and invalid days', () => {
  assert.equal(parseJalaliDate('2026/11/20').valid, false);
  assert.equal(parseJalaliDate('امروز').valid, false);
  assert.equal(parseJalaliDate('1405-07-27').valid, false);
  assert.equal(parseJalaliDate('1405/07/31').valid, false); // Mehr has 30 days
  assert.equal(parseJalaliDate('1405/12/30').valid, false); // 1405 is not leap
  assert.equal(isJalaliLeapYear(1403), true);
  assert.equal(parseJalaliDate('1403/12/30').valid, true);
});

test('compareJalaliDates and isJalaliInRange work chronologically', () => {
  assert.equal(compareJalaliDates('1405/06/31', '1405/07/01'), -1);
  assert.equal(compareJalaliDates('1405/07/27', '1405/07/27'), 0);
  assert.equal(isJalaliInRange('1405/07/15', '1405/07/01', '1405/07/30'), true);
  assert.equal(isJalaliInRange('1405/08/01', '1405/07/01', '1405/07/30'), false);
});

test('formatJalaliDisplay converts digits to Persian and gregorianToJalali converts accurately', () => {
  assert.equal(formatJalaliDisplay('1405/07/27'), '۱۴۰۵/۰۷/۲۷');
  assert.equal(gregorianToJalali(2026, 10, 19), '1405/07/27');
});
