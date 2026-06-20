const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('joVideos', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),
  setHideOnRecord: (enabled) => ipcRenderer.invoke('window:set-hide-on-record', enabled),
  recordingStarted: () => ipcRenderer.invoke('recording:started'),
  recordingStopped: () => ipcRenderer.invoke('recording:stopped'),
  listSources: () => ipcRenderer.invoke('sources:list'),
  selectSource: (sourceId) => ipcRenderer.invoke('source:select', sourceId),
  saveRecording: (payload) => ipcRenderer.invoke('recording:save', payload),
  transcodeRecording: (payload) => ipcRenderer.invoke('recording:transcode', payload),
  showInFolder: (filePath) => ipcRenderer.invoke('file:show', filePath),
  chooseOutputDir: () => ipcRenderer.invoke('output:choose-dir'),
  getOutputDir: () => ipcRenderer.invoke('output:get-dir')
});
