// Міст між сторінкою і файловим сховищем
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ewiStore', {
  get: key => ipcRenderer.sendSync('store:get', key),
  set: (key, value) => ipcRenderer.sendSync('store:set', key, value),
  newMidis: () => ipcRenderer.sendSync('store:newMidis'),
  info: () => ipcRenderer.sendSync('app:info'),
  openDir: which => ipcRenderer.invoke('app:openDir', which),
  chooseDir: () => ipcRenderer.invoke('app:chooseDir'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdate: cb => ipcRenderer.on('update', (e, d) => cb(d)),
  onSaved: cb => ipcRenderer.on('saved', (e, p) => cb(p)),
  saveMedia: (name, bytes) => ipcRenderer.invoke('media:save', name, bytes),
  claudeCheck: () => ipcRenderer.invoke('claude:check'),
  claudeAsk: prompt => ipcRenderer.invoke('claude:ask', prompt),
  getConfig: () => ipcRenderer.sendSync('cfg:get'),
  setConfig: c => ipcRenderer.invoke('cfg:set', c),
  reportPractice: min => ipcRenderer.send('practice:report', min)
});
