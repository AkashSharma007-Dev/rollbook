// Opens the real app window on sample data, saves a screenshot of each screen and the salary slips PDF.
// Run with: npx electron test/smoke.js <output folder>
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { loadData, saveData } = require('../src/files');

const out = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'rollbook-smoke'));
const dataFile = path.join(out, 'data.json');
const wait = ms => new Promise(r => setTimeout(r, ms));
ipcMain.handle('load', () => loadData(dataFile));
ipcMain.handle('save', (e, d) => { saveData(dataFile, d); return true; });

app.whenReady().then(async () => {
  fs.mkdirSync(out, { recursive: true });
  for (const f of [dataFile, dataFile + '.bak']) fs.rmSync(f, { force: true });
  const win = new BrowserWindow({
    width: 1366, height: 768, useContentSize: true, show: false,
    webPreferences: { preload: path.join(__dirname, '../src/preload.js'), contextIsolation: true, sandbox: true },
  });
  const errors = [];
  win.webContents.on('console-message', (e, level, msg) => { if (level >= 3) errors.push(msg); });
  await win.loadFile(path.join(__dirname, '../src/index.html'));
  const run = js => win.webContents.executeJavaScript(js);
  await wait(600);
  for (const v of ['register', 'staff', 'advances', 'salary']) {
    await run(`document.querySelector('[data-view="${v}"]').click()`);
    await wait(300);
    fs.writeFileSync(path.join(out, v + '.png'), (await win.webContents.capturePage()).toPNG());
  }
  await run(`document.getElementById('print').innerHTML = slipsHtml(salaryRows())`);
  fs.writeFileSync(path.join(out, 'slips.pdf'), await win.webContents.printToPDF({ pageSize: 'A4', printBackground: true, preferCSSPageSize: true }));
  console.log('saved data file:', fs.existsSync(dataFile));
  console.log('errors:', errors.length ? errors.join(' | ') : 'none');
  console.log('files:', fs.readdirSync(out).join(', '));
  app.quit();
});
