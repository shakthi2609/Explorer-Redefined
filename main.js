const { app, BrowserWindow, ipcMain, shell, protocol, net, Menu } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const os = require("os");
const { pathToFileURL } = require("url");
const { spawn } = require("child_process");

const APP_ROOT = path.join(os.homedir(), "Myne");
const META_FILE = path.join(APP_ROOT, ".myne.json");
const TRASH_DIR = path.join(APP_ROOT, ".trash");
const TRASH_META = path.join(TRASH_DIR, ".meta.json");

const SEED_META = {
  "Product Design": {
    defaultPalette: "parchment",
    projects: [
      { id: "p1", index: "01", title: "Nova Health",
        date: "2024-11-14T09:30:00Z",
        desc: "HUDR — Heads-Up Display Reboot Assembly. A wearable-first interface for real-time vitals.",
        tech: "Figma · React · Node.js", image: "",
        gradient: "linear-gradient(150deg,#8a6a3a,#3b2f1c)",
        themeColor: "150 50% 25%", href: "HUDR.html" },
      { id: "p2", index: "02", title: "Zenith Platform",
        date: "2024-10-02T14:15:00Z",
        desc: "Mobile app for holistic wellness tracking, from sleep cycles to daily habits.",
        tech: "Figma · React · Node.js", image: "",
        gradient: "linear-gradient(150deg,#4a6b7c,#1d2b33)",
        themeColor: "210 55% 32%", href: "#" },
      { id: "p3", index: "03", title: "Echo Social",
        date: "2024-09-18T11:00:00Z",
        desc: "An ambient social layer that keeps small circles close without the noise.",
        tech: "Figma · React · Node.js", image: "",
        gradient: "linear-gradient(150deg,#7b4b8a,#2c1733)",
        themeColor: "280 45% 38%", href: "#" },
    ],
  },
  "Engineering": {
    defaultPalette: "slate",
    projects: [
      { id: "p4", index: "04", title: "Quantum UI",
        date: "2024-11-20T16:45:00Z",
        desc: "A headless component system built for dense, data-heavy dashboards.",
        tech: "TypeScript · React · Vite", image: "",
        gradient: "linear-gradient(150deg,#4b4f55,#16181a)",
        themeColor: "220 15% 28%", href: "#" },
      { id: "p5", index: "05", title: "Horizon App",
        date: "2024-08-27T10:20:00Z",
        desc: "Offline-first mobile experience with sync, caching and local persistence.",
        tech: "React Native · SQLite", image: "",
        gradient: "linear-gradient(150deg,#a37a2a,#3a2a10)",
        themeColor: "35 60% 38%", href: "#" },
    ],
  },
};

async function ensureAppRoot() {
  let rootOk = true;
  try { await fs.access(APP_ROOT); } catch { rootOk = false; }
  if (!rootOk) await fs.mkdir(APP_ROOT, { recursive: true });

  let metaOk = true;
  try { await fs.access(META_FILE); } catch { metaOk = false; }
  if (!metaOk) {
    for (const name of Object.keys(SEED_META)) {
      const p = path.join(APP_ROOT, name);
      try { await fs.access(p); } catch { await fs.mkdir(p, { recursive: true }); }
    }
    await fs.writeFile(META_FILE, JSON.stringify(SEED_META, null, 2));
  }

  try { await fs.access(TRASH_DIR); }
  catch { await fs.mkdir(TRASH_DIR, { recursive: true }); }
}

function safeJoin(folder = "", name = "") {
  const p = path.join(APP_ROOT, folder, name);
  const rel = path.relative(APP_ROOT, p);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("Path escapes app root");
  return p;
}

async function loadTrashMeta() {
  try {
    const raw = await fs.readFile(TRASH_META, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.entries) ? parsed : { entries: [] };
  } catch { return { entries: [] }; }
}
async function saveTrashMeta(meta) {
  await fs.writeFile(TRASH_META, JSON.stringify(meta, null, 2));
}
async function purgeOldTrash() {
  const meta = await loadTrashMeta();
  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const kept = [];
  for (const entry of meta.entries) {
    if (now - entry.trashedAt > THIRTY_DAYS) {
      try { await fs.rm(path.join(TRASH_DIR, entry.storedName), { recursive: true, force: true }); } catch {}
    } else kept.push(entry);
  }
  meta.entries = kept;
  await saveTrashMeta(meta);
}

async function uniqueName(folder, baseName) {
  let name = baseName;
  let i = 1;
  while (true) {
    try { await fs.access(safeJoin(folder, name)); }
    catch { return name; }
    const dot = baseName.lastIndexOf(".");
    if (dot > 0) name = `${baseName.slice(0, dot)}(${i})${baseName.slice(dot)}`;
    else name = `${baseName}(${i})`;
    i++;
  }
}

function spawnDetached(cmd, args) {
  return new Promise((resolve, reject) => {
    let child;
    try { child = spawn(cmd, args, { detached: true, stdio: "ignore" }); }
    catch (e) { reject(e); return; }
    child.on("error", reject);
    child.on("spawn", () => { child.unref(); resolve(); });
  });
}

protocol.registerSchemesAsPrivileged([
  { scheme: "myne", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 900, minHeight: 600,
    backgroundColor: "#13110c",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile("index.html");
  win.webContents.openDevTools();
}

app.whenReady().then(async () => {
  await ensureAppRoot();
  await purgeOldTrash();
  Menu.setApplicationMenu(null);
  if (process.platform === "darwin") {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: app.name, submenu: [
        { role: "hide" }, { role: "hideOthers" }, { role: "unhide" },
        { type: "separator" }, { role: "quit" },
      ]},
      { label: "Window", submenu: [
        { role: "minimize" }, { role: "close" }, { role: "front" },
      ]},
    ]));
  }

  protocol.handle("myne", async (request) => {
    try {
      const url = new URL(request.url);
      const parts = decodeURIComponent(url.pathname).split("/").filter(Boolean);
      if (parts.length < 2) return new Response("Not found", { status: 404 });
      const folder = parts[0];
      const file = parts.slice(1).join("/");
      const filePath = safeJoin(folder, file);
      return net.fetch(pathToFileURL(filePath).toString());
    } catch (e) {
      return new Response("Error: " + e.message, { status: 500 });
    }
  });

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

/* ---------- FOLDERS ---------- */
ipcMain.handle("myne:root", async () => APP_ROOT);

ipcMain.handle("myne:listFolders", async () => {
  const entries = await fs.readdir(APP_ROOT, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory() && !e.name.startsWith("."))
    .map(e => e.name)
    .sort((a, b) => a.localeCompare(b));
});

ipcMain.handle("myne:createFolder", async (_e, name) => {
  await fs.mkdir(safeJoin(name), { recursive: true });
  return true;
});

ipcMain.handle("myne:deleteFolder", async (_e, name) => {
  await fs.rm(safeJoin(name), { recursive: true, force: true });
  return true;
});

ipcMain.handle("myne:renameFolder", async (_e, oldName, newName) => {
  await fs.rename(safeJoin(oldName), safeJoin(newName));
  return true;
});

ipcMain.handle("myne:openFolder", async (_e, name) => {
  const err = await shell.openPath(safeJoin(name));
  if (err) throw new Error(err);
  return true;
});

ipcMain.handle("myne:openRoot", async () => {
  const err = await shell.openPath(APP_ROOT);
  if (err) throw new Error(err);
  return true;
});

/* ---------- FILES ---------- */
ipcMain.handle("myne:listFiles", async (_e, folder) => {
  const dir = safeJoin(folder);
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); }
  catch { return []; }
  const out = [];
  for (const e of entries) {
    if (!e.isFile() || e.name.startsWith(".")) continue;
    try {
      const stat = await fs.stat(path.join(dir, e.name));
      out.push({ name: e.name, size: stat.size, lastModified: stat.mtimeMs });
    } catch {}
  }
  return out;
});

ipcMain.handle("myne:writeFile", async (_e, folder, name, bytes) => {
  await fs.mkdir(safeJoin(folder), { recursive: true });
  await fs.writeFile(safeJoin(folder, name), Buffer.from(bytes));
  return true;
});

ipcMain.handle("myne:deleteFile", async (_e, folder, name) => {
  await fs.unlink(safeJoin(folder, name));
  return true;
});

ipcMain.handle("myne:renameFile", async (_e, folder, oldName, newName) => {
  if (oldName === newName) return newName;
  const finalName = await uniqueName(folder, newName);
  await fs.rename(safeJoin(folder, oldName), safeJoin(folder, finalName));
  return finalName;
});

ipcMain.handle("myne:openFile", async (_e, folder, name) => {
  const err = await shell.openPath(safeJoin(folder, name));
  if (err) throw new Error(err);
  return true;
});

ipcMain.handle("myne:revealInSystem", async (_e, folder, name) => {
  shell.showItemInFolder(safeJoin(folder, name));
  return true;
});

ipcMain.handle("myne:openInCursor", async (_e, folder, name) => {
  const target = safeJoin(folder, name);
  const platform = process.platform;
  if (platform === "win32") {
    const candidates = [
      path.join(process.env.LOCALAPPDATA || "", "Programs", "cursor", "Cursor.exe"),
      path.join(process.env.LOCALAPPDATA || "", "Programs", "Cursor", "Cursor.exe"),
      path.join(process.env.PROGRAMFILES || "", "Cursor", "Cursor.exe"),
      "cursor.cmd",
      "cursor",
    ];
    let lastErr;
    for (const c of candidates) {
      try { await spawnDetached(c, [target]); return true; }
      catch (e) { lastErr = e; }
    }
    throw lastErr || new Error("Cursor not found");
  } else if (platform === "darwin") {
    await spawnDetached("open", ["-a", "Cursor", target]);
    return true;
  } else {
    await spawnDetached("cursor", [target]);
    return true;
  }
});

ipcMain.handle("myne:readTextFile", async (_e, folder, name, limit = 200000) => {
  const p = safeJoin(folder, name);
  const stat = await fs.stat(p);
  if (stat.size > limit * 4) {
    return { text: "", truncated: true, size: stat.size, tooLarge: true };
  }
  const buf = await fs.readFile(p);
  const slice = buf.slice(0, Math.min(limit, buf.length));
  return {
    text: slice.toString("utf8"),
    truncated: buf.length > limit,
    size: stat.size,
  };
});

/* ---------- MOVE / COPY ---------- */
ipcMain.handle("myne:moveFile", async (_e, fromFolder, name, toFolder) => {
  if (fromFolder === toFolder) return name;
  const finalName = await uniqueName(toFolder, name);
  await fs.mkdir(safeJoin(toFolder), { recursive: true });
  await fs.rename(safeJoin(fromFolder, name), safeJoin(toFolder, finalName));
  return finalName;
});

ipcMain.handle("myne:copyFile", async (_e, fromFolder, name, toFolder) => {
  const finalName = await uniqueName(toFolder, name);
  await fs.mkdir(safeJoin(toFolder), { recursive: true });
  await fs.copyFile(safeJoin(fromFolder, name), safeJoin(toFolder, finalName));
  return finalName;
});

/* ---------- TRASH ---------- */
ipcMain.handle("myne:trashFile", async (_e, folder, name) => {
  const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const storedName = `${id}__${name}`;
  await fs.rename(safeJoin(folder, name), path.join(TRASH_DIR, storedName));
  const meta = await loadTrashMeta();
  meta.entries.push({
    id,
    originalName: name,
    originalFolder: folder,
    storedName,
    trashedAt: Date.now(),
  });
  await saveTrashMeta(meta);
  return true;
});

ipcMain.handle("myne:listTrash", async () => {
  const meta = await loadTrashMeta();
  const out = [];
  for (const entry of meta.entries) {
    try {
      const stat = await fs.stat(path.join(TRASH_DIR, entry.storedName));
      out.push({ ...entry, size: stat.size, lastModified: stat.mtimeMs });
    } catch {}
  }
  out.sort((a, b) => b.trashedAt - a.trashedAt);
  return out;
});

ipcMain.handle("myne:restoreTrash", async (_e, id) => {
  const meta = await loadTrashMeta();
  const entry = meta.entries.find(e => e.id === id);
  if (!entry) throw new Error("Trash entry not found");
  const finalName = await uniqueName(entry.originalFolder, entry.originalName);
  await fs.mkdir(safeJoin(entry.originalFolder), { recursive: true });
  await fs.rename(path.join(TRASH_DIR, entry.storedName), safeJoin(entry.originalFolder, finalName));
  meta.entries = meta.entries.filter(e => e.id !== id);
  await saveTrashMeta(meta);
  return finalName;
});

ipcMain.handle("myne:emptyTrash", async () => {
  const meta = await loadTrashMeta();
  for (const entry of meta.entries) {
    try { await fs.rm(path.join(TRASH_DIR, entry.storedName), { recursive: true, force: true }); } catch {}
  }
  await saveTrashMeta({ entries: [] });
  return true;
});

/* ---------- META ---------- */
ipcMain.handle("myne:readMeta", async () => {
  try {
    const raw = await fs.readFile(META_FILE, "utf8");
    return JSON.parse(raw);
  } catch { return {}; }
});

ipcMain.handle("myne:writeMeta", async (_e, meta) => {
  await fs.writeFile(META_FILE, JSON.stringify(meta, null, 2));
  return true;
});