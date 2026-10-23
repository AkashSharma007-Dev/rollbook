// Disk work for the main process: the data file and the Excel export. Kept free of Electron so tests can run it.
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

// Read the data file, falling back to the copy kept before the last save if the file is damaged.
function loadData(file) {
  for (const p of [file, file + '.bak']) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch (e) { if (e.code !== 'ENOENT' && p === file + '.bak') throw e; }
  }
  if (fs.existsSync(file)) throw new Error('the data file is damaged and there is no backup');
  return null;
}

// Write to a temp file, keep the previous version as .bak, then swap, so a crash mid-write loses nothing.
function saveData(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', JSON.stringify(data));
  if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak');
  fs.renameSync(file + '.tmp', file);
}

async function writeSalaryXlsx(sheet, filePath) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Salary', { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 } });
  ws.addRow([sheet.business]).font = { bold: true, size: 14 };
  ws.addRow([`Salary for ${sheet.title}`]);
  ws.addRow([]);
  ws.addRow(['Staff', 'Work', 'Paid by', 'Rate', 'Present', 'Absent', 'Half days', 'Paid leave', 'Paid days', 'Earned', 'Advance', 'Net pay']).font = { bold: true };
  const first = 5;
  sheet.rows.forEach((r, i) => {
    const n = first + i;
    ws.addRow([r.name, r.role, r.basis, r.rate, r.P, r.A, r.H, r.L, r.paidDays, r.gross, r.advance, { formula: `J${n}-K${n}`, result: r.net }]);
  });
  const last = first + sheet.rows.length - 1;
  ws.addRow(['Total', null, null, null, null, null, null, null, null,
    ...['J', 'K', 'L'].map(c => ({ formula: `SUM(${c}${first}:${c}${last})` }))]).font = { bold: true };
  ['D', 'J', 'K', 'L'].forEach(c => { ws.getColumn(c).numFmt = '"₹"#,##0'; });
  ws.columns.forEach((c, i) => { c.width = [22, 18, 10, 10, 9, 9, 10, 10, 10, 12, 12, 12][i]; });
  await wb.xlsx.writeFile(filePath);
}

module.exports = { loadData, saveData, writeSalaryXlsx };
