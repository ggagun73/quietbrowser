const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('quietBrowse', {
  getState: () => ipcRenderer.invoke('get-state'),
  navigate: (url) => ipcRenderer.invoke('navigate', url),
  back: () => ipcRenderer.invoke('back'),
  forward: () => ipcRenderer.invoke('forward'),
  reload: () => ipcRenderer.invoke('reload'),
  newTab: () => ipcRenderer.invoke('new-tab'),
  selectTab: (id) => ipcRenderer.invoke('select-tab', id),
  closeTab: (id) => ipcRenderer.invoke('close-tab', id),
  setSettingsOpen: (isOpen) => ipcRenderer.invoke('set-settings-open', isOpen),
  updateSettings: (patch) => ipcRenderer.invoke('update-settings', patch),
  onStateChanged: (callback) => ipcRenderer.on('state-changed', (_event, state) => callback(state))
});
