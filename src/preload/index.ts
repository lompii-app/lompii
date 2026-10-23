import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { Item, TesseraAPI } from '@shared/api'

const api: TesseraAPI = {
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
  analyse: (id) => ipcRenderer.invoke('ai:analyse', id),
  analyseAll: () => ipcRenderer.invoke('ai:analyseAll'),
  testProvider: (p) => ipcRenderer.invoke('ai:test', p),
  listModels: (p) => ipcRenderer.invoke('ai:models', p),
  imagePrompt: (id) => ipcRenderer.invoke('ai:prompt', id),
  embeddingStatus: () => ipcRenderer.invoke('embeddings:status'),
  searchSemantic: (query) => ipcRenderer.invoke('search:semantic', query)
}

contextBridge.exposeInMainWorld('tessera', api)
