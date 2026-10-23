// Run with: node test/pay.test.js
const assert = require('node:assert/strict');
const { monthSummary, weekday } = require('../src/pay.js');

const ym = '2026-10'; // 31 days, 1 Oct is a Thursday, Sundays are 4, 11, 18, 25
assert.equal(weekday(ym, 1), 4);

// Monthly: 2 absent, 1 half day, everything else present.
const monthly = { id: 'm', payType: 'monthly', rate: 15000, weeklyOff: 0 };
const marks = {};
for (let d = 1; d <= 31; d++) if (![4, 11, 18, 25].includes(d)) marks[d] = 'P';
marks[6] = 'A'; marks[7] = 'A'; marks[8] = 'H';
let s = monthSummary(monthly, ym, marks);
assert.equal(s.WO, 4);
assert.equal(s.unmarked, 0);
assert.equal(s.paidDays, 28.5);
assert.equal(s.gross, 13790); // 15000 x 28.5 / 31 = 13790.32

// Daily: paid for present, paid leave and half of half days only.
const daily = { id: 'd', payType: 'daily', rate: 600, weeklyOff: 0 };
const dm = {};
for (let d = 1; d <= 20; d++) dm[d] = 'P';
dm[21] = 'H'; dm[22] = 'H'; dm[23] = 'L';
s = monthSummary(daily, ym, dm);
assert.equal(s.paidDays, 22);
assert.equal(s.gross, 13200);

// Joined mid-month: days before joining are not paid.
s = monthSummary({ ...monthly, joined: '2026-10-15' }, ym, {});
assert.equal(s.employed, 17);
assert.equal(s.gross, 8226); // 15000 x 17 / 31 = 8225.8

// Only this month's advances are deducted, and only for this person.
const advances = [
  { staffId: 'm', date: '2026-10-05', amount: 2000 },
  { staffId: 'm', date: '2026-09-28', amount: 500 },
  { staffId: 'x', date: '2026-10-05', amount: 900 },
];
s = monthSummary(monthly, ym, marks, advances);
assert.equal(s.advance, 2000);
assert.equal(s.net, 11790);

// A month still running: only unmarked days before the cutoff count as missed.
s = monthSummary(monthly, ym, { 1: 'P', 2: 'P' }, [], 6);
assert.equal(s.missed, 2); // 3 Oct and 5 Oct; 4 Oct is Sunday
assert.equal(s.unmarked, 25);

console.log('pay.test.js: all checks passed');
