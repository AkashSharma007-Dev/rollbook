// Salary rules, shared by the app window and the tests.
// Monthly staff: rate x (days employed - absent - half of half-days) / days in month.
//   Weekly offs and paid leave are paid. Days with no mark count as worked but are reported as "unmarked".
// Daily staff: rate x (present + paid leave + half of half-days). Weekly offs and unmarked days are unpaid.
// "missed" counts unmarked days before cutoffDay, so a month still running does not flag days yet to come.
(function (root) {
  const pad = n => String(n).padStart(2, '0');
  const daysIn = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
  const weekday = (ym, d) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };

  function monthSummary(staff, ym, marks = {}, advances = [], cutoffDay = Infinity) {
    const days = daysIn(ym);
    let P = 0, A = 0, H = 0, L = 0, WO = 0, unmarked = 0, missed = 0, employed = 0;
    for (let d = 1; d <= days; d++) {
      if (staff.joined && `${ym}-${pad(d)}` < staff.joined) continue;
      employed++;
      const mark = marks[d];
      if (mark === 'P') P++;
      else if (mark === 'A') A++;
      else if (mark === 'H') H++;
      else if (mark === 'L') L++;
      else if (weekday(ym, d) === staff.weeklyOff) WO++;
      else { unmarked++; if (d < cutoffDay) missed++; }
    }
    const paidDays = staff.payType === 'daily' ? P + L + H / 2 : employed - A - H / 2;
    const gross = Math.round(staff.payType === 'daily' ? staff.rate * paidDays : staff.rate * paidDays / days);
    const advance = advances
      .filter(a => a.staffId === staff.id && a.date.startsWith(ym))
      .reduce((sum, a) => sum + a.amount, 0);
    // shortcut: an advance larger than the month's pay leaves a negative net; carry-forward would need a ledger.
    return { days, employed, P, A, H, L, WO, unmarked, missed, paidDays, gross, advance, net: gross - advance };
  }

  const api = { daysIn, weekday, monthSummary, pad };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Pay = api;
})(this);
