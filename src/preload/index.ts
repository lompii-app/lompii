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
  backup: () => ipcRenderer.invoke('library:backup'),

  ingestPaths: (paths) => ipcRenderer.invoke('ingest:paths', paths),
  ingestBuffer: (data) => ipcRenderer.invoke('ingest:buffer', data),
  pathForFile: (file) => webUtils.getPathForFile(file),

  onAdded: (cb) => {
    const handler = (_e: unknown, item: Item) => cb(item)
    ipcRenderer.on('item:added', handler)
    return () => ipcRenderer.off('item:added', handler)
  },

  onUpdated: (cb) => {
    const handler = (_e: unknown, item: Item) => cb(item)
    ipcRenderer.on('item:updated', handler)
    return () => ipcRenderer.off('item:updated', handler)
  },

  fileSize: (id) => ipcRenderer.invoke('items:fileSize', id),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  windowControl: (action) => ipcRenderer.invoke('window:control', action),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  setAi: (patch) => ipcRenderer.invoke('settings:setAi', patch),
  setOpenAtLogin: (on) => ipcRenderer.invoke('settings:setOpenAtLogin', on),
  analyse: (id) => ipcRenderer.invoke('ai:analyse', id),
  analyseAll: () => ipcRenderer.invoke('ai:analyseAll'),
  embeddingStatus: () => ipcRenderer.invoke('embeddings:status'),
  searchSemantic: (query) => ipcRenderer.invoke('search:semantic', query)
}

contextBridge.exposeInMainWorld('tessera', api)
