const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("myne", {
  platform: process.platform,
  root: () => ipcRenderer.invoke("myne:root"),

  listFolders:    ()                    => ipcRenderer.invoke("myne:listFolders"),
  createFolder:   (name)                => ipcRenderer.invoke("myne:createFolder", name),
  deleteFolder:   (name)                => ipcRenderer.invoke("myne:deleteFolder", name),
  renameFolder:   (oldName, newName)    => ipcRenderer.invoke("myne:renameFolder", oldName, newName),
  moveFolder:     (fromPath, toParent)  => ipcRenderer.invoke("myne:moveFolder", fromPath, toParent),
  openFolder:     (name)                => ipcRenderer.invoke("myne:openFolder", name),
  openRoot:       ()                    => ipcRenderer.invoke("myne:openRoot"),

  listFiles:      (folder)              => ipcRenderer.invoke("myne:listFiles", folder),
  writeFile:      (folder, name, bytes) => ipcRenderer.invoke("myne:writeFile", folder, name, bytes),
  deleteFile:     (folder, name)        => ipcRenderer.invoke("myne:deleteFile", folder, name),
  renameFile:     (folder, oldN, newN)  => ipcRenderer.invoke("myne:renameFile", folder, oldN, newN),
  openFile:       (folder, name)        => ipcRenderer.invoke("myne:openFile", folder, name),
  revealInSystem: (folder, name)        => ipcRenderer.invoke("myne:revealInSystem", folder, name),
  openInCursor:   (folder, name)        => ipcRenderer.invoke("myne:openInCursor", folder, name),
  readTextFile:   (folder, name, limit) => ipcRenderer.invoke("myne:readTextFile", folder, name, limit),

  moveFile:       (fromF, name, toF)    => ipcRenderer.invoke("myne:moveFile", fromF, name, toF),
  copyFile:       (fromF, name, toF)    => ipcRenderer.invoke("myne:copyFile", fromF, name, toF),

  trashFile:      (folder, name)        => ipcRenderer.invoke("myne:trashFile", folder, name),
  listTrash:      ()                    => ipcRenderer.invoke("myne:listTrash"),
  restoreTrash:   (id)                  => ipcRenderer.invoke("myne:restoreTrash", id),
  emptyTrash:     ()                    => ipcRenderer.invoke("myne:emptyTrash"),

  readMeta:       ()                    => ipcRenderer.invoke("myne:readMeta"),
  writeMeta:      (meta)                => ipcRenderer.invoke("myne:writeMeta", meta),
});