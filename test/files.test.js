// Run with: node test/files.test.js
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');
const { loadData, saveData, writeSalaryXlsx } = require('../src/files.js');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rollbook-'));
  const file = path.join(dir, 'data.json');

  assert.equal(loadData(file), null); // first run

  saveData(file, { v: 1 });
  saveData(file, { v: 2 });
  assert.deepEqual(loadData(file), { v: 2 });
  assert.deepEqual(JSON.parse(fs.readFileSync(file + '.bak', 'utf8')), { v: 1 });

  fs.writeFileSync(file, '{"v": 3'); // damaged mid-write by something else
  assert.deepEqual(loadData(file), { v: 1 }, 'falls back to the backup');

  fs.rmSync(file + '.bak');
  assert.throws(() => loadData(file), /damaged/, 'never silently starts over');

  const x = path.join(dir, 'salary.xlsx');
  await writeSalaryXlsx({ title: 'September 2026', business: 'Test Co', rows: [
    { name: 'A', role: 'Tailor', basis: 'Monthly', rate: 15000, P: 25, A: 1, H: 0, L: 0, paidDays: 29, gross: 14500, advance: 2000, net: 12500 },
    { name: 'B', role: 'Helper', basis: 'Daily', rate: 500, P: 20, A: 0, H: 2, L: 0, paidDays: 21, gross: 10500, advance: 0, net: 10500 },
  ] }, x);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(x);
  const ws = wb.getWorksheet('Salary');
  assert.equal(ws.getCell('A5').value, 'A');
  assert.equal(ws.getCell('L5').value.formula, 'J5-K5');
  assert.equal(ws.getCell('L7').value.formula, 'SUM(L5:L6)');

  fs.rmSync(dir, { recursive: true });
  console.log('files.test.js: all checks passed');
})();
