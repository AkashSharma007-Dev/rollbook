const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  load: () => ipcRenderer.invoke('load'),
  save: data => ipcRenderer.invoke('save', data),
  exportSalary: sheet => ipcRenderer.invoke('export-salary', sheet),
  savePdf: name => ipcRenderer.invoke('save-pdf', name),
});
