import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { ImportProgress, Item, LompiiAPI, UpdateStatus } from '@shared/api'

const api: LompiiAPI = {
  platform: process.platform,
  list: () => ipcRenderer.invoke('items:list'),
  tags: (id) => ipcRenderer.invoke('items:tags', id),
  addTags: (id, tags) => ipcRenderer.invoke('items:addTags', id, tags),
  tagIndex: () => ipcRenderer.invoke('tags:index'),
  tagCounts: () => ipcRenderer.invoke('tags:counts'),
  renameTag: (from, to) => ipcRenderer.invoke('tags:rename', from, to),
  deleteTag: (value) => ipcRenderer.invoke('tags:delete', value),
  removeTag: (id, tag) => ipcRenderer.invoke('items:removeTag', id, tag),
  stacks: () => ipcRenderer.invoke('stacks:list'),
  createStack: (name, color) => ipcRenderer.invoke('stacks:create', name, color),
  updateStack: (id, patch) => ipcRenderer.invoke('stacks:update', id, patch),
  deleteStack: (id) => ipcRenderer.invoke('stacks:delete', id),
  setInStack: (stackId, itemId, member) => ipcRenderer.invoke('stacks:setItem', stackId, itemId, member),
  update: (id, patch) => ipcRenderer.invoke('items:update', id, patch),
  palette: (id) => ipcRenderer.invoke('items:palette', id),
  similar: (id) => ipcRenderer.invoke('items:similar', id),
  saveAs: (id) => ipcRenderer.invoke('items:saveAs', id),
  copy: (id) => ipcRenderer.invoke('items:copy', id),
  archive: (ids, on) => ipcRenderer.invoke('items:archive', ids, on),
  unlockArchive: (pin) => ipcRenderer.invoke('archive:unlock', pin),
  lockArchive: () => ipcRenderer.invoke('archive:lock'),
  setArchivePassword: (current, next) => ipcRenderer.invoke('settings:setArchivePassword', current, next),
  remove: (id) => ipcRenderer.invoke('items:remove', id),
  restore: (ids) => ipcRenderer.invoke('items:restore', ids),
  trashCount: () => ipcRenderer.invoke('trash:count'),
  trashList: () => ipcRenderer.invoke('trash:list'),
  emptyTrash: () => ipcRenderer.invoke('trash:empty'),
  deleteForever: (ids) => ipcRenderer.invoke('trash:delete', ids),
  backup: () => ipcRenderer.invoke('library:backup'),

  ingestPaths: (paths) => ipcRenderer.invoke('ingest:paths', paths),
  ingestBuffer: (data) => ipcRenderer.invoke('ingest:buffer', data),
  pathForFile: (file) => webUtils.getPathForFile(file),
  importFolder: () => ipcRenderer.invoke('library:importFolder'),
  onImportProgress: (cb) => {
    const handler = (_e: unknown, p: ImportProgress) => cb(p)
    ipcRenderer.on('import:progress', handler)
    return () => ipcRenderer.off('import:progress', handler)
  },

  onAdded: (cb) => {
    const handler = (_e: unknown, item: Item) => cb(item)
    ipcRenderer.on('item:added', handler)
    return () => ipcRenderer.off('item:added', handler)
  },

  onPairChanged: (cb) => {
    const handler = () => cb()
    ipcRenderer.on('pair:changed', handler)
    return () => ipcRenderer.off('pair:changed', handler)
  },
  pairRequest: () => ipcRenderer.invoke('pair:get'),
  answerPair: (id, ok) => ipcRenderer.invoke('pair:answer', id, ok),

  onUpdated: (cb) => {
    const handler = (_e: unknown, item: Item) => cb(item)
    ipcRenderer.on('item:updated', handler)
    return () => ipcRenderer.off('item:updated', handler)
  },

  fileSize: (id) => ipcRenderer.invoke('items:fileSize', id),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  windowControl: (action) => ipcRenderer.invoke('window:control', action),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  resetToken: () => ipcRenderer.invoke('settings:resetToken'),
  extensionFolder: () => ipcRenderer.invoke('extension:folder'),
  showExtensionFolder: () => ipcRenderer.invoke('extension:show'),
  saveProvider: (p, patch) => ipcRenderer.invoke('settings:saveProvider', p, patch),
  setActiveProvider: (p) => ipcRenderer.invoke('settings:setActiveProvider', p),
  setOpenAtLogin: (on) => ipcRenderer.invoke('settings:setOpenAtLogin', on),
  setFreeMemoryInTray: (on) => ipcRenderer.invoke('settings:setFreeMemoryInTray', on),
  setAnalyseImports: (n) => ipcRenderer.invoke('settings:setAnalyseImports', n),
  analyse: (id) => ipcRenderer.invoke('ai:analyse', id),
  analyseAll: () => ipcRenderer.invoke('ai:analyseAll'),
  testProvider: (p) => ipcRenderer.invoke('ai:test', p),
  listModels: (p) => ipcRenderer.invoke('ai:models', p),
  imagePrompt: (id) => ipcRenderer.invoke('ai:prompt', id),
  embeddingStatus: () => ipcRenderer.invoke('embeddings:status'),
  searchSemantic: (query) => ipcRenderer.invoke('search:semantic', query),

  updateStatus: () => ipcRenderer.invoke('update:status'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateChanged: (cb) => {
    const handler = (_e: unknown, status: UpdateStatus) => cb(status)
    ipcRenderer.on('update:changed', handler)
    return () => ipcRenderer.off('update:changed', handler)
  }
}

contextBridge.exposeInMainWorld('lompii', api)
