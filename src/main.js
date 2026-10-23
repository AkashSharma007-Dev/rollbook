const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { loadData, saveData, writeSalaryXlsx } = require('./files');

const dataFile = () => path.join(app.getPath('userData'), 'rollbook-data.json');
let win;

ipcMain.handle('load', () => loadData(dataFile()));
ipcMain.handle('save', (e, data) => { saveData(dataFile(), data); return true; });

ipcMain.handle('export-salary', async (e, sheet) => {
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    defaultPath: `Salary ${sheet.title}.xlsx`,
    filters: [{ name: 'Excel workbook', extensions: ['xlsx'] }],
  });
  if (canceled) return false;
  await writeSalaryXlsx(sheet, filePath);
  shell.showItemInFolder(filePath);
  return true;
});

ipcMain.handle('save-pdf', async (e, name) => {
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    defaultPath: name,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (canceled) return false;
  const pdf = await e.sender.printToPDF({ pageSize: 'A4', printBackground: true, preferCSSPageSize: true });
  fs.writeFileSync(filePath, pdf);
  shell.openPath(filePath);
  return true;
});

function createWindow() {
  win = new BrowserWindow({
    width: 1340, height: 820, minWidth: 1080, minHeight: 640,
    title: 'Rollbook', backgroundColor: '#F3F5F9', show: false,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'index.html'));
}

Menu.setApplicationMenu(null);
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
