// Rollbook window. Runs inside the desktop app (window.api comes from preload.js) and also in a plain
// browser, where it keeps data in localStorage so the sample can be tried without installing.
const store = window.api || {
  async load() { try { return JSON.parse(localStorage.getItem('rollbook')); } catch { return null; } },
  async save(d) { try { localStorage.setItem('rollbook', JSON.stringify(d)); } catch {} return true; },
  async exportSalary(sheet) {
    const head = ['Staff', 'Role', 'Pay basis', 'Present', 'Absent', 'Half days', 'Paid leave', 'Paid days', 'Gross', 'Advance', 'Net pay'];
    const rows = sheet.rows.map(r => [r.name, r.role, r.basis, r.P, r.A, r.H, r.L, r.paidDays, r.gross, r.advance, r.net]);
    const csv = [head, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `Salary ${sheet.title}.csv`;
    a.click();
    return true;
  },
  async savePdf() { window.print(); return true; },
};

const q = new URLSearchParams(location.search);
const today = new Date();
const ymOf = d => `${d.getFullYear()}-${Pay.pad(d.getMonth() + 1)}`;
const todayIso = `${ymOf(today)}-${Pay.pad(today.getDate())}`;
let data;
let view = q.get('view') || 'register';
let ym = q.get('ym') || ymOf(today);
const $main = document.getElementById('main');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const inr = n => (n < 0 ? '−' : '') + '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN');
const monthName = m => new Date(m + '-01T00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const shiftMonth = (m, k) => { const [y, mo] = m.split('-').map(Number); return ymOf(new Date(y, mo - 1 + k, 1)); };
const fmtDays = n => (Math.floor(n) || (n % 1 ? '' : '0')) + (n % 1 ? '½' : '');
const marksOf = id => data.attendance[ym]?.[id] || {};
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const CYCLE = ['', 'P', 'A', 'H', 'L'];
const SHOW = { P: 'P', A: 'A', H: '½', L: 'L' };
const NAMES = { P: 'present', A: 'absent', H: 'half day', L: 'paid leave' };

// Writes are queued so two quick clicks can never write out of order.
let saving = Promise.resolve();
function persist() {
  const el = document.getElementById('saved');
  const snapshot = JSON.parse(JSON.stringify(data));
  saving = saving.then(() => store.save(snapshot)).then(
    () => { el.textContent = 'Saved at ' + new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }); el.classList.remove('err'); },
    err => { el.textContent = 'Not saved: ' + err.message; el.classList.add('err'); },
  );
}

function render() {
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-current', b.dataset.view === view));
  document.getElementById('biz-name').textContent = data.settings.business;
  ({ register, staff: staffView, advances: advancesView, salary: salaryView })[view]();
}

const monthNav = () => `<div class="month"><button type="button" data-month="-1" aria-label="Previous month">‹</button><span>${monthName(ym)}</span><button type="button" data-month="1" aria-label="Next month">›</button></div>`;

/* ---------- Register ---------- */
function register() {
  const days = Pay.daysIn(ym);
  const isThisMonth = ym === ymOf(today);
  const td = today.getDate();
  const active = data.staff.filter(s => s.active && !(s.joined > `${ym}-${days}`));
  const todayCls = d => (isThisMonth && d === td ? ' today' : '');

  let head = '<th class="name">Staff</th>';
  for (let d = 1; d <= days; d++) {
    const wd = Pay.weekday(ym, d);
    head += `<th class="${wd === 0 ? 'off' : ''}${todayCls(d)}"><b>${d}</b>${'SMTWTFS'[wd]}</th>`;
  }
  head += '<th class="sum" title="Present">P</th><th class="sum" title="Absent">A</th><th class="sum" title="Half days">½</th><th class="sum" title="Paid leave">L</th>';

  const rows = active.map((s, r) => {
    const m = marksOf(s.id);
    const sum = Pay.monthSummary(s, ym, m);
    let cells = '';
    for (let d = 1; d <= days; d++) {
      const pre = s.joined && `${ym}-${Pay.pad(d)}` < s.joined;
      const wo = Pay.weekday(ym, d) === s.weeklyOff;
      const mk = m[d] || '';
      const state = NAMES[mk] || (pre ? 'before joining' : wo ? 'weekly off' : 'not marked');
      cells += `<td class="${wo ? 'off' : ''}${todayCls(d)}"><button type="button" class="cell ${mk}${!mk && wo ? ' wo' : ''}${pre ? ' pre' : ''}" data-s="${s.id}" data-d="${d}" data-r="${r}"${pre ? ' disabled' : ''} aria-label="${esc(s.name)}, ${d} ${monthName(ym)}: ${state}">${mk ? SHOW[mk] : wo && !pre ? '–' : ''}</button></td>`;
    }
    return `<tr><td class="name" title="${esc(s.name)}">${esc(s.name)}<small>${esc(s.role)}</small></td>${cells}<td class="sum">${sum.P}</td><td class="sum a">${sum.A || ''}</td><td class="sum">${sum.H || ''}</td><td class="sum">${sum.L || ''}</td></tr>`;
  }).join('');

  const canMarkToday = isThisMonth && active.some(s => !marksOf(s.id)[td] && Pay.weekday(ym, td) !== s.weeklyOff && !(s.joined > `${ym}-${Pay.pad(td)}`));
  $main.innerHTML = `
    <div class="head"><h1>Register</h1>${monthNav()}<span class="grow"></span>
      ${isThisMonth ? `<button type="button" class="btn" data-act="mark-today"${canMarkToday ? '' : ' disabled'}>Mark everyone present today</button>` : ''}</div>
    ${active.length ? `<div class="card reg-wrap"><table class="reg"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>
    <div class="legend"><span><b>P</b>Present</span><span><b class="A">A</b>Absent</span><span><b>½</b>Half day</span><span><b class="L">L</b>Paid leave</span><span><b style="color:#A9B3C7">–</b>Weekly off</span>
      <span>Click a box to change it, or use the arrow keys and type <kbd>P</kbd> <kbd>A</kbd> <kbd>H</kbd> <kbd>L</kbd>. <kbd>Delete</kbd> clears.</span></div>`
    : `<div class="card" style="padding:28px"><p>No staff yet. Add the people who work here, then mark their attendance every day.</p><p style="margin-top:12px"><button type="button" class="btn" data-act="go-staff">Add staff</button></p></div>`}`;
}

function setMark(btn, mark) {
  if (btn.disabled) return;
  const { s, d } = btn.dataset;
  const month = data.attendance[ym] ||= {};
  const m = month[s] ||= {};
  if (mark) m[d] = mark; else delete m[d];
  persist();
  register();
  $main.querySelector(`.cell[data-s="${s}"][data-d="${d}"]`)?.focus();
}

function moveFrom(btn, key) {
  let r = +btn.dataset.r, d = +btn.dataset.d;
  const step = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[key];
  for (;;) {
    r += step[0]; d += step[1];
    const next = $main.querySelector(`.cell[data-r="${r}"][data-d="${d}"]`);
    if (!next) return;
    if (!next.disabled) return next.focus();
  }
}

/* ---------- Staff ---------- */
function staffView() {
  const rows = data.staff.map(s => `<tr class="click" data-edit="${s.id}">
      <td><b>${esc(s.name)}</b></td><td>${esc(s.role)}</td>
      <td class="r">${inr(s.rate)} <span class="muted">${s.payType === 'daily' ? 'a day' : 'a month'}</span></td>
      <td>${s.weeklyOff >= 0 ? WEEKDAYS[s.weeklyOff] : 'None'}</td>
      <td>${s.joined ? new Date(s.joined + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</td>
      <td>${esc(s.phone)}</td><td>${s.active ? '' : '<span class="tag">Left</span>'}</td></tr>`).join('');
  $main.innerHTML = `
    <div class="head"><h1>Staff</h1><span class="muted">${data.staff.filter(s => s.active).length} working</span><span class="grow"></span><button type="button" class="btn" data-act="add-staff">Add staff</button></div>
    <div class="card"><table class="tbl"><thead><tr><th>Name</th><th>Work</th><th class="r">Pay</th><th>Weekly off</th><th>Joined</th><th>Phone</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="note">Click a person to change their details. Someone who leaves stays in past months' registers and salary.</p>`;
  if (q.get('edit')) { openStaff(data.staff.find(s => s.id === q.get('edit'))); q.delete('edit'); }
}

function openStaff(s) {
  document.querySelector('.drawer')?.remove();
  const isNew = !s;
  s = s || { id: 's' + Date.now(), name: '', role: '', payType: 'monthly', rate: '', weeklyOff: 0, joined: todayIso, phone: '', active: true };
  const el = document.createElement('form');
  el.className = 'drawer';
  el.noValidate = true;
  el.innerHTML = `
    <h2>${isNew ? 'Add staff' : 'Edit ' + esc(s.name)}</h2>
    <label>Name<input name="name" value="${esc(s.name)}" autocomplete="off"></label>
    <label>Work<input name="role" value="${esc(s.role)}" placeholder="For example, Tailor"></label>
    <div class="seg" role="radiogroup" aria-label="Paid by">
      <label><input type="radio" name="payType" value="monthly"${s.payType === 'monthly' ? ' checked' : ''}><span>Monthly salary</span></label>
      <label><input type="radio" name="payType" value="daily"${s.payType === 'daily' ? ' checked' : ''}><span>Daily wage</span></label>
    </div>
    <div class="two">
      <label><span id="rate-label">${s.payType === 'daily' ? 'Wage a day' : 'Salary a month'} (₹)</span><input name="rate" inputmode="numeric" value="${esc(s.rate)}"></label>
      <label>Weekly off<select name="weeklyOff">${WEEKDAYS.map((w, i) => `<option value="${i}"${s.weeklyOff === i ? ' selected' : ''}>${w}</option>`).join('')}<option value="-1"${s.weeklyOff < 0 ? ' selected' : ''}>None</option></select></label>
    </div>
    <div class="two">
      <label>Joined on<input type="date" name="joined" value="${esc(s.joined)}"></label>
      <label>Phone<input name="phone" value="${esc(s.phone)}" inputmode="tel"></label>
    </div>
    ${isNew ? '' : `<label class="check"><input type="checkbox" name="active"${s.active ? ' checked' : ''}>Still works here</label>`}
    <p class="err-msg" role="alert"></p>
    <div class="row-end"><button type="button" class="btn line" data-act="close-drawer">Cancel</button><button class="btn">${isNew ? 'Add staff' : 'Save changes'}</button></div>`;
  el.addEventListener('change', e => {
    if (e.target.name === 'payType') el.querySelector('#rate-label').textContent = (e.target.value === 'daily' ? 'Wage a day' : 'Salary a month') + ' (₹)';
  });
  el.addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(el);
    const name = f.get('name').trim();
    const rate = Number(String(f.get('rate')).replace(/[,₹\s]/g, ''));
    const msg = !name ? 'Enter a name.' : !(rate > 0) ? 'Enter the pay as a number, for example 15000.' : '';
    if (msg) { el.querySelector('.err-msg').textContent = msg; return; }
    Object.assign(s, {
      name, role: f.get('role').trim(), payType: f.get('payType'), rate,
      weeklyOff: Number(f.get('weeklyOff')), joined: f.get('joined'), phone: f.get('phone').trim(),
      active: isNew || f.get('active') === 'on',
    });
    if (isNew) data.staff.push(s);
    persist();
    el.remove();
    render();
  });
  el.addEventListener('keydown', e => { if (e.key === 'Escape') el.remove(); });
  document.body.append(el);
  el.querySelector('input').focus();
}

/* ---------- Advances ---------- */
function advancesView() {
  const list = data.advances.filter(a => a.date.startsWith(ym)).sort((a, b) => a.date.localeCompare(b.date));
  const nameOf = id => data.staff.find(s => s.id === id)?.name || 'Removed';
  const defDate = ym === ymOf(today) ? todayIso : `${ym}-01`;
  const total = list.reduce((t, a) => t + a.amount, 0);
  $main.innerHTML = `
    <div class="head"><h1>Advances</h1>${monthNav()}</div>
    <form class="card addrow" id="adv-form" novalidate>
      <label>Given to<select name="staffId">${data.staff.filter(s => s.active).map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label>
      <label>Date<input type="date" name="date" value="${defDate}"></label>
      <label>Amount (₹)<input name="amount" inputmode="numeric" autocomplete="off"></label>
      <label>Note<input name="note" placeholder="Optional" autocomplete="off"></label>
      <button class="btn">Add advance</button>
    </form>
    <p class="err-msg" id="adv-err" role="alert"></p>
    <div class="card"><table class="tbl">
      <thead><tr><th>Date</th><th>Given to</th><th class="r">Amount</th><th>Note</th><th></th></tr></thead>
      <tbody>${list.map(a => `<tr><td>${new Date(a.date + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td><td>${esc(nameOf(a.staffId))}</td><td class="r">${inr(a.amount)}</td><td class="muted">${esc(a.note)}</td><td class="r"><button type="button" class="link del" data-del-adv="${a.id}">Delete</button></td></tr>`).join('')
        || `<tr><td colspan="5" class="muted">No advances given in ${monthName(ym)}.</td></tr>`}</tbody>
      ${list.length ? `<tfoot><tr><td colspan="2">Total</td><td class="r">${inr(total)}</td><td colspan="2"></td></tr></tfoot>` : ''}
    </table></div>
    <p class="note">Advances are taken off the salary of the month they were given in.</p>`;
  document.getElementById('adv-form').addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const amount = Number(String(f.get('amount')).replace(/[,₹\s]/g, ''));
    const date = f.get('date');
    const msg = !f.get('staffId') ? 'Add staff first.' : !date ? 'Choose a date.' : !(amount > 0) ? 'Enter the amount as a number, for example 2000.' : '';
    if (msg) { document.getElementById('adv-err').textContent = msg; return; }
    data.advances.push({ id: 'a' + Date.now(), staffId: f.get('staffId'), date, amount, note: f.get('note').trim() });
    ym = date.slice(0, 7);
    persist();
    render();
  });
}

/* ---------- Salary ---------- */
function salaryRows() {
  const days = Pay.daysIn(ym);
  return data.staff
    .filter(s => !(s.joined > `${ym}-${days}`) && (s.active || Object.keys(marksOf(s.id)).length))
    .map(s => ({ s, ...Pay.monthSummary(s, ym, marksOf(s.id), data.advances, ym === ymOf(today) ? today.getDate() : Infinity) }));
}

function salaryView() {
  const rows = salaryRows();
  const tot = k => rows.reduce((t, r) => t + r[k], 0);
  const missed = tot('missed');
  const running = ym === ymOf(today);
  $main.innerHTML = `
    <div class="head"><h1>Salary</h1>${monthNav()}<span class="grow"></span>
      <button type="button" class="btn line" data-act="export"${rows.length ? '' : ' disabled'}>Export to Excel</button>
      <button type="button" class="btn" data-act="slips"${rows.length ? '' : ' disabled'}>Print salary slips</button></div>
    ${running ? `<p class="note">${monthName(ym)} is not over yet. Monthly staff are counted as working the rest of the month.</p>` : ''}
    ${missed ? `<p class="warn">${missed} past working ${missed === 1 ? 'day is' : 'days are'} not marked in the register. Monthly staff are paid for those days and daily staff are not.</p>` : ''}
    <div class="card"><table class="tbl">
      <thead><tr><th>Staff</th><th class="r">Pay</th><th class="r">Present</th><th class="r">Absent</th><th class="r">Half days</th><th class="r">Leave</th><th class="r">Paid days</th><th class="r">Earned</th><th class="r">Advance</th><th class="r">To pay</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td><b>${esc(r.s.name)}</b>${r.missed ? ` <span class="tag" title="Past days not marked">${r.missed} unmarked</span>` : ''}<div class="muted" style="font-size:12px">${esc(r.s.role)}</div></td>
        <td class="r">${inr(r.s.rate)}<div class="muted" style="font-size:12px">${r.s.payType === 'daily' ? 'a day' : 'a month'}</div></td>
        <td class="r">${r.P}</td><td class="r">${r.A || ''}</td><td class="r">${r.H || ''}</td><td class="r">${r.L || ''}</td>
        <td class="r">${fmtDays(r.paidDays)}</td><td class="r">${inr(r.gross)}</td>
        <td class="r">${r.advance ? '−' + inr(r.advance) : ''}</td><td class="r${r.net < 0 ? ' neg' : ''}"><b>${inr(r.net)}</b></td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="7">Total for ${rows.length} people</td><td class="r">${inr(tot('gross'))}</td><td class="r">${tot('advance') ? '−' + inr(tot('advance')) : ''}</td><td class="r">${inr(tot('net'))}</td></tr></tfoot>
    </table></div>
    <p class="note">Monthly staff are paid for every day of the month except absences, and half days count as half. Daily staff are paid for days present, paid leave and half of each half day.</p>`;
}

function slipsHtml(rows) {
  const b = data.settings;
  const line = (k, v) => `<tr><td>${k}</td><td>${v}</td></tr>`;
  return rows.map(r => `<section class="slip">
    <header><div><b>${esc(b.business)}</b><br><span>${esc(b.address)}</span></div><b>Salary slip, ${monthName(ym)}</b></header>
    <div class="who"><span><b>${esc(r.s.name)}</b>, ${esc(r.s.role)}</span><span>${r.s.payType === 'daily' ? 'Daily wage ' + inr(r.s.rate) : 'Monthly salary ' + inr(r.s.rate)}</span></div>
    <div class="cols">
      <table>${line('Days in month', r.days)}${line('Weekly offs', r.WO)}${line('Present', r.P)}${line('Half days', r.H)}${line('Paid leave', r.L)}${line('Absent', r.A)}${line('<b>Paid days</b>', '<b>' + fmtDays(r.paidDays) + '</b>')}</table>
      <table>${line('Earned', inr(r.gross))}${line('Advance taken', r.advance ? '−' + inr(r.advance) : inr(0))}</table>
    </div>
    <div class="net"><span>Net pay</span><span>${inr(r.net)}</span></div>
    <div class="sign"><span>Received by ${esc(r.s.name)}</span><span>For ${esc(b.business)}</span></div>
  </section>`).join('');
}

/* ---------- Events ---------- */
$main.addEventListener('click', async e => {
  const t = e.target;
  const month = t.closest('[data-month]');
  if (month) { ym = shiftMonth(ym, +month.dataset.month); return render(); }
  const cell = t.closest('.cell');
  if (cell) { const cur = marksOf(cell.dataset.s)[cell.dataset.d] || ''; return setMark(cell, CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length]); }
  const edit = t.closest('[data-edit]');
  if (edit) return openStaff(data.staff.find(s => s.id === edit.dataset.edit));
  const del = t.closest('[data-del-adv]');
  if (del && confirm('Delete this advance?')) { data.advances = data.advances.filter(a => a.id !== del.dataset.delAdv); persist(); return render(); }
  const act = t.closest('[data-act]')?.dataset.act;
  if (act === 'go-staff') { view = 'staff'; render(); openStaff(); }
  if (act === 'add-staff') openStaff();
  if (act === 'mark-today') {
    const d = today.getDate();
    const month = data.attendance[ym] ||= {};
    for (const s of data.staff.filter(s => s.active && !(s.joined > `${ym}-${Pay.pad(d)}`))) {
      const m = month[s.id] ||= {};
      if (!m[d] && Pay.weekday(ym, d) !== s.weeklyOff) m[d] = 'P';
    }
    persist();
    register();
  }
  if (act === 'export') {
    const rows = salaryRows().map(r => ({ name: r.s.name, role: r.s.role, basis: r.s.payType === 'daily' ? 'Daily' : 'Monthly', rate: r.s.rate, P: r.P, A: r.A, H: r.H, L: r.L, paidDays: r.paidDays, gross: r.gross, advance: r.advance, net: r.net }));
    try { await store.exportSalary({ title: monthName(ym), business: data.settings.business, rows }); }
    catch (err) { alert('Could not export: ' + err.message); }
  }
  if (act === 'slips') {
    const print = document.getElementById('print');
    print.innerHTML = slipsHtml(salaryRows());
    try { await store.savePdf(`Salary slips ${monthName(ym)}.pdf`); }
    catch (err) { alert('Could not save the slips: ' + err.message); }
    finally { print.innerHTML = ''; }
  }
});

$main.addEventListener('keydown', e => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const k = e.key.length === 1 ? e.key.toUpperCase() : '';
  if (k && 'PAHL'.includes(k)) { e.preventDefault(); setMark(cell, k); }
  else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); setMark(cell, ''); }
  else if (e.key.startsWith('Arrow')) { e.preventDefault(); moveFrom(cell, e.key); }
});

document.addEventListener('click', e => { if (e.target.closest('[data-act="close-drawer"]')) e.target.closest('.drawer').remove(); });
// Salary is paid after a month ends, so the Salary screen opens on last month.
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
  view = b.dataset.view;
  if (view === 'salary' && ym === ymOf(today)) ym = shiftMonth(ym, -1);
  document.querySelector('.drawer')?.remove();
  render();
}));

const dlg = document.getElementById('settings');
document.getElementById('open-settings').addEventListener('click', () => {
  dlg.querySelector('[name=business]').value = data.settings.business;
  dlg.querySelector('[name=address]').value = data.settings.address;
  dlg.showModal();
});
dlg.addEventListener('close', () => {
  if (dlg.returnValue !== 'ok') return;
  const business = dlg.querySelector('[name=business]').value.trim();
  if (!business) return;
  data.settings = { business, address: dlg.querySelector('[name=address]').value.trim() };
  persist();
  render();
});

(async () => {
  try { data = await store.load(); }
  catch (err) {
    $main.innerHTML = `<p class="err-msg">Could not open the saved data: ${esc(err.message)}. Nothing has been changed. Close Rollbook and contact support.</p>`;
    return;
  }
  if (!data) { data = demoData(today); persist(); }
  render();
})();
