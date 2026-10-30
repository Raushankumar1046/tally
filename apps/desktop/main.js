const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const http = require('http');
const fs = require('fs');

let mainWindow = null;
let apiProcess = null;

const IS_DEV = process.env.NODE_ENV === 'development';
const API_PORT = process.env.API_PORT || 5000;
const WEB_PORT = process.env.WEB_PORT || 3000;

// ── File-based logger ─────────────────────────────────────────────────────────
let logStream = null;
function setupLogger() {
  const logDir = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, `app-${Date.now()}.log`);
  logStream = fs.createWriteStream(logFile, { flags: 'a' });
  return logFile;
}
function log(...args) {
  const msg = `[${new Date().toISOString()}] ${args.join(' ')}\n`;
  if (logStream) logStream.write(msg);
  console.log(...args);
}
function logError(...args) {
  const msg = `[${new Date().toISOString()}] ERROR: ${args.join(' ')}\n`;
  if (logStream) logStream.write(msg);
  console.error(...args);
}

// ── Wait for HTTP server ──────────────────────────────────────────────────────
function waitForServer(url, timeout = 30000) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode < 500) resolve(true);
        else retry();
      }).on('error', retry);
    };
    const retry = () => {
      if (Date.now() - startTime > timeout) {
        reject(new Error(`Timeout waiting for ${url}`));
      } else {
        setTimeout(check, 500);
      }
    };
    check();
  });
}

// ── Ensure user's tally.db exists (copy template on first launch) ─────────────
function ensureDatabase(userDataPath) {
  const dbPath = path.join(userDataPath, 'tally.db');
  if (!fs.existsSync(dbPath)) {
    const templatePath = path.join(__dirname, 'template.db');
    if (fs.existsSync(templatePath)) {
      log('[Electron] First launch — copying template.db to:', dbPath);
      fs.copyFileSync(templatePath, dbPath);
    } else {
      log('[Electron] template.db not found — DB will be empty on first connect.');
    }
  } else {
    log('[Electron] Existing DB found at:', dbPath);
  }
  return dbPath;
}

// ── Start Express API server (production only) ────────────────────────────────
function startApiServer() {
  const apiPath = path.join(__dirname, 'node_modules/@tally/api/dist/index.js');
  const webOutPath = path.join(__dirname, 'web/out');

  log('[Electron] API path:', apiPath, '→ exists:', fs.existsSync(apiPath));
  log('[Electron] web/out:', webOutPath, '→ exists:', fs.existsSync(webOutPath));

  if (!fs.existsSync(apiPath)) {
    logError('[Electron] FATAL: API not found at', apiPath);
    dialog.showErrorBox('Startup Error', `API server missing:\n${apiPath}`);
    return;
  }

  const userDataPath = app.getPath('userData');
  const dbPath = ensureDatabase(userDataPath);
  log('[Electron] DB path:', dbPath);

  const engineCandidates = [
    path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '@prisma', 'client', 'generated-client', 'query_engine-windows.dll.node'),
    path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '.prisma', 'client', 'query_engine-windows.dll.node'),
    path.join(__dirname, 'node_modules', '@prisma', 'client', 'generated-client', 'query_engine-windows.dll.node'),
    path.join(__dirname, 'node_modules', '.prisma', 'client', 'query_engine-windows.dll.node'),
  ];
  let resolvedEngine = engineCandidates[0];
  for (const candidate of engineCandidates) {
    if (fs.existsSync(candidate)) {
      resolvedEngine = candidate;
      break;
    }
  }
  log('[Electron] Prisma engine resolved path:', resolvedEngine, '→ exists:', fs.existsSync(resolvedEngine));

  const env = {
    ...process.env,
    DATABASE_URL: `file:${dbPath}`,
    PORT: String(API_PORT),
    NODE_ENV: 'production',
    WEB_OUT_PATH: webOutPath,
    PRISMA_QUERY_ENGINE_LIBRARY: resolvedEngine,
    PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: '1',
    APP_DATA_PATH: userDataPath,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET_KEY: process.env.GOOGLE_CLIENT_SECRET_KEY,
  };

  try {
    apiProcess = fork(apiPath, [], { env, stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });
    if (apiProcess.stdout) apiProcess.stdout.on('data', (d) => log('[API]', d.toString().trim()));
    if (apiProcess.stderr) apiProcess.stderr.on('data', (d) => logError('[API err]', d.toString().trim()));
    apiProcess.on('exit', (code, sig) => log(`[API] exited code=${code} sig=${sig}`));
    apiProcess.on('error', (err) => logError('[API] fork error:', err.message));
  } catch (err) {
    logError('[Electron] Failed to fork API:', err.message);
  }
}

// ── Create main window ────────────────────────────────────────────────────────
async function createWindow(logFile) {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: 'Tally Solutions - Billing & Inventory Management Enterprise',
    backgroundColor: '#0b0f17',
    autoHideMenuBar: !IS_DEV,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  mainWindow.maximize();

  if (IS_DEV) {
    // ── DEV MODE: connect to the already-running Next.js + Express dev servers ──
    const targetUrl = `http://localhost:${WEB_PORT}`;
    log('[Electron DEV] Waiting for Next.js dev server at:', targetUrl);
    try {
      await waitForServer(targetUrl, 60000);
      log('[Electron DEV] Next.js ready. Loading:', targetUrl);
    } catch (err) {
      logError('[Electron DEV] Next.js not ready:', err.message);
      mainWindow.loadURL(
        `data:text/html,<body style="font-family:sans-serif;padding:2rem;background:#0b0f17;color:#f87171">` +
        `<h2>⚠️ Dev Server Not Running</h2>` +
        `<p>Run <code>npm run dev</code> in another terminal first, then relaunch the Electron window.</p>` +
        `</body>`
      );
      return;
    }
    mainWindow.loadURL(targetUrl);
  } else {
    // ── PRODUCTION MODE: wait for bundled Express API to serve the static UI ──
    const targetUrl = `http://localhost:${API_PORT}`;
    log('[Electron] Waiting for API at', targetUrl);
    try {
      await waitForServer(targetUrl, 25000);
      log('[Electron] API ready. Loading UI at:', targetUrl);
    } catch (err) {
      logError('[Electron] API did not start:', err.message);
      mainWindow.loadURL(
        `data:text/html,<body style="background:#0b0f17;color:#f87171;font-family:sans-serif;padding:2rem">` +
        `<h2>⚠️ API Server Failed to Start</h2>` +
        `<p>Log: ${logFile}</p>` +
        `<p>Expected: ${targetUrl}</p>` +
        `</body>`
      );
      return;
    }
    mainWindow.loadURL(targetUrl);
  }

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    logError(`[Electron] Page load failed: ${desc} (${code}) at ${url}`);
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  const logFile = setupLogger();
  log(`[Electron] Starting in ${IS_DEV ? 'DEVELOPMENT' : 'PRODUCTION'} mode.`);
  log('[Electron] __dirname:', __dirname);

  if (!IS_DEV) {
    // Only start the bundled API in production — dev uses the running dev server
    startApiServer();
  } else {
    log('[Electron DEV] Skipping API spawn — using running dev servers on ports', WEB_PORT, 'and', API_PORT);
  }

  createWindow(logFile);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(logFile);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (apiProcess) apiProcess.kill();
    app.quit();
  }
});

app.on('will-quit', () => {
  if (apiProcess) apiProcess.kill();
  if (logStream) logStream.end();
});
