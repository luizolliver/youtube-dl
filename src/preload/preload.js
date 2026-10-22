'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const on = channel => cb => {
  const listener = (_e, payload) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('vela', {
  bootstrap: () => ipcRenderer.invoke('app:bootstrap'),

  engine: {
    ensure: () => ipcRenderer.invoke('engine:ensure'),
    version: () => ipcRenderer.invoke('engine:version'),
    update: () => ipcRenderer.invoke('engine:update'),
    onProgress: on('engine:progress')
  },

  analyze: url => ipcRenderer.invoke('media:analyze', url),

  downloads: {
    start: opts => ipcRenderer.invoke('download:start', opts),
    pause: id => ipcRenderer.invoke('download:pause', id),
    resume: id => ipcRenderer.invoke('download:resume', id),
    cancel: id => ipcRenderer.invoke('download:cancel', id),
    remove: id => ipcRenderer.invoke('download:remove', id),
    clearFinished: () => ipcRenderer.invoke('download:clearFinished'),
    onUpdate: on('download:update'),
    onRemoved: on('download:removed'),
    onAggregate: on('download:aggregate')
  },

  history: {
    remove: id => ipcRenderer.invoke('history:remove', id),
    clear: () => ipcRenderer.invoke('history:clear'),
    onAdded: on('history:added')
  },

  auth: {
    status: () => ipcRenderer.invoke('auth:status'),
    login: siteId => ipcRenderer.invoke('auth:login', siteId),
    cancel: () => ipcRenderer.invoke('auth:cancel'),
    finish: () => ipcRenderer.invoke('auth:finish'),
    onPhase: on('auth:phase'),
    logout: siteId => ipcRenderer.invoke('auth:logout', siteId),
    clear: () => ipcRenderer.invoke('auth:clear'),
    importFile: () => ipcRenderer.invoke('auth:import')
  },

  settings: {
    set: patch => ipcRenderer.invoke('settings:set', patch)
  },

  chooseFolder: () => ipcRenderer.invoke('dialog:chooseFolder'),
  openPath: p => ipcRenderer.invoke('shell:open', p),
  reveal: p => ipcRenderer.invoke('shell:reveal', p),
  openExternal: url => ipcRenderer.invoke('shell:external', url),
  freeSpace: dir => ipcRenderer.invoke('fs:free', dir),
  sites: () => ipcRenderer.invoke('sites:list'),

  clipboard: {
    onUrl: on('clipboard:url'),
    ignore: url => ipcRenderer.invoke('clipboard:ignore', url)
  },

  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggleMaximize'),
    close: () => ipcRenderer.send('window:close'),
    onState: on('window:state')
  }
});
