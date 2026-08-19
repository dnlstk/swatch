const { app, BrowserWindow, shell, globalShortcut, Tray, Menu, nativeImage, ipcMain, session } = require('electron');
const { spawn, execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const { startServer, stopServer } = require('./server');

// When running packaged, __dirname is inside the .app bundle so we use the
// known absolute path instead. In dev mode the relative path still works.
const TOOLS_DIR = app.isPackaged
  ? path.join(os.homedir(), 'Tools', 'ComfyUI', '_tools')
  : path.join(__dirname, '..', '_tools');
const PORT = 3000;
const APP_URL = `http://127.0.0.1:${PORT}/comfy-prompt-gen.html`;

let mainWindow = null;
let tray = null;
let statusInterval = null;
let forceQuit = false;

// ComfyUI auto-launch state
let _weStartedComfyUI = false; // true if we launched it (so we quit it on exit)
let _comfyStarting = false;    // process launched, window not hidden yet
let _comfyReady = false;       // port 8000 is responding

// ===================== CIVITAI POPUP WINDOW =====================
let civitaiWindow = null;

function openCivitAIPopup(url) {
  const targetUrl = url || 'https://civitai.red';
  if (civitaiWindow && !civitaiWindow.isDestroyed()) {
    civitaiWindow.loadURL(targetUrl);
    civitaiWindow.show();
    civitaiWindow.focus();
    return;
  }
  civitaiWindow = new BrowserWindow({
    width: 1200, height: 800,
    title: 'CivitAI',
    webPreferences: {
      partition: 'persist:civitai',
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  civitaiWindow.loadURL(targetUrl);
  civitaiWindow.webContents.setWindowOpenHandler(({ url: linkUrl }) => {
    if (/civitai\.(com|red)/i.test(linkUrl)) {
      civitaiWindow.loadURL(linkUrl);
    } else {
      shell.openExternal(linkUrl);
    }
    return { action: 'deny' };
  });
  const civBoundsFile = path.join(app.getPath('userData'), 'civitai-bounds.json');
  try {
    const saved = JSON.parse(fs.readFileSync(civBoundsFile, 'utf8'));
    if (saved) civitaiWindow.setBounds(saved);
  } catch {}
  const saveCivBounds = () => {
    if (!civitaiWindow || civitaiWindow.isDestroyed()) return;
    try { fs.writeFileSync(civBoundsFile, JSON.stringify(civitaiWindow.getBounds())); } catch {}
  };
  civitaiWindow.on('resize', saveCivBounds);
  civitaiWindow.on('move', saveCivBounds);
  civitaiWindow.on('closed', () => { civitaiWindow = null; });
}

// ===================== EXTERNAL LINK ROUTING =====================
// CivitAI links open in the in-app popup window.
// Everything else opens in the default browser.
function openExternalUrl(url) {
  try {
    if (/civitai\.(com|red)/i.test(url)) {
      openCivitAIPopup(url);
    } else {
      shell.openExternal(url);
    }
  } catch (e) {
    console.error('[openExternal] failed:', e.message);
    shell.openExternal(url);
  }
}

// ===================== WINDOW BOUNDS =====================
let boundsFile = null;
function getBoundsFile() {
  if (!boundsFile) boundsFile = path.join(app.getPath('userData'), 'window-bounds.json');
  return boundsFile;
}
function loadBounds() {
  try { return JSON.parse(fs.readFileSync(getBoundsFile(), 'utf8')); } catch { return null; }
}
function saveBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    fs.writeFileSync(getBoundsFile(), JSON.stringify(mainWindow.getBounds()));
  } catch (e) { console.error('[bounds] save failed:', e.message); }
}

// ===================== COMFYUI DIRECT LAUNCH =====================
// Launch the Python backend directly instead of going through the Comfy Desktop launcher.
const COMFY_PYTHON = path.join(os.homedir(), 'Tools', 'ComfyUI', '.venv', 'bin', 'python3');
const COMFY_MAIN = path.join(os.homedir(), 'ComfyUI-Installs', 'ComfyUI', 'ComfyUI', 'main.py');
const COMFY_CWD = path.join(os.homedir(), 'ComfyUI-Installs', 'ComfyUI', 'ComfyUI');
const COMFY_BASE = path.join(os.homedir(), 'Tools', 'ComfyUI');
const COMFY_EXTRA_MODELS = path.join(os.homedir(), 'Library', 'Application Support', 'ComfyUI', 'extra_models_config.yaml');
const COMFY_SHARED_MODELS = path.join(os.homedir(), 'Library', 'Application Support', 'Comfy Desktop', 'shared_model_paths.yaml');
let _comfyProcess = null;

function isComfyUIRunning() {
  try {
    execSync('pgrep -f "ComfyUI/main.py"', { stdio: 'ignore' });
    return true;
  } catch { return false; }
}

function startComfyUI() {
  const args = [COMFY_MAIN, '--port', '8000',
    '--output-directory', path.join(COMFY_BASE, 'output'),
    '--input-directory', path.join(COMFY_BASE, 'input')];
  if (fs.existsSync(COMFY_EXTRA_MODELS)) args.push('--extra-model-paths-config', COMFY_EXTRA_MODELS);
  if (fs.existsSync(COMFY_SHARED_MODELS)) args.push(COMFY_SHARED_MODELS);
  _comfyProcess = spawn(COMFY_PYTHON, args, { cwd: COMFY_CWD, stdio: 'ignore', detached: false });
  _comfyProcess.on('exit', (code) => {
    clog(`ComfyUI process exited with code ${code}`);
    _comfyProcess = null;
    _comfyReady = false;
    rebuildTrayMenu();
  });
  setTimeout(rebuildTrayMenu, 1000);
}

function stopComfyUI() {
  if (_comfyProcess) {
    _comfyProcess.kill('SIGTERM');
    _comfyProcess = null;
  } else {
    try { execSync('pkill -f "ComfyUI/main.py"', { stdio: 'ignore' }); } catch {}
  }
  setTimeout(rebuildTrayMenu, 1000);
}

function isComfyUIVisible() { return false; }
function hideComfyUI() {}
function showComfyUI() {}

// ===================== COMFYUI AUTO-LAUNCH =====================
function checkComfyPort() {
  return new Promise(resolve => {
    const req = http.get('http://127.0.0.1:8000/', { timeout: 2000 }, res => {
      resolve(res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

function waitForCondition(fn, timeoutMs, intervalMs) {
  return new Promise(async resolve => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await fn()) return resolve(true);
      await new Promise(r => setTimeout(r, intervalMs));
    }
    resolve(false);
  });
}

const LOG_FILE = path.join(os.homedir(), 'Library', 'Logs', 'PromptGen-comfy.log');
function clog(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(msg);
  try { fs.appendFileSync(LOG_FILE, line); } catch {}
}

async function autoStartComfyUI() {
  clog('autoStartComfyUI called');
  try {
    if (isComfyUIRunning()) {
      clog('ComfyUI already running — skipping auto-start');
      _comfyReady = await checkComfyPort();
      rebuildTrayMenu();
      return;
    }

    clog('ComfyUI not running — launching Python backend directly...');
    _weStartedComfyUI = true;
    _comfyStarting = true;
    _comfyReady = false;
    rebuildTrayMenu();

    startComfyUI();

    // Wait for the process to appear (up to 15s)
    const appeared = await waitForCondition(() => isComfyUIRunning(), 15000, 500);
    if (!appeared) {
      clog('ERROR: process never appeared — gave up');
      _comfyStarting = false;
      rebuildTrayMenu();
      return;
    }
    clog('process appeared');
    _comfyStarting = false;
    rebuildTrayMenu();

    // Wait for port 8000 to respond (model loading can take 30-90s)
    clog('waiting for port 8000...');
    const ready = await waitForCondition(checkComfyPort, 180000, 3000);
    _comfyReady = ready;
    clog(ready ? 'port 8000 ready' : 'ERROR: timed out waiting for port 8000');
    rebuildTrayMenu();
    // Auto-reload LoRAs and checkpoints now that ComfyUI + LoRA Manager are up
    if (ready && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript('loadLoras()').catch(() => {});
      mainWindow.webContents.executeJavaScript('loadComfyCheckpoints()').catch(() => {});
    }
  } catch (e) {
    clog(`ERROR in autoStartComfyUI: ${e.message}`);
  }
}

// ===================== TRAY =====================
function createTray() {
  const iconPath = path.join(__dirname, 'trayTemplate.png');
  const icon = nativeImage.createFromPath(iconPath);
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('Prompt Gen');
  rebuildTrayMenu();
}

function rebuildTrayMenu() {
  if (!tray) return;
  const comfyRunning = isComfyUIRunning();
  const windowVisible = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible();

  let comfyStatusLabel;
  if (_comfyStarting)      comfyStatusLabel = 'ComfyUI: ◌ Starting...';
  else if (!comfyRunning)  comfyStatusLabel = 'ComfyUI: ○ Stopped';
  else if (!_comfyReady)   comfyStatusLabel = 'ComfyUI: ● Loading models...';
  else                     comfyStatusLabel = 'ComfyUI: ● Ready';

  // Show ComfyUI startup status in the menu bar next to the icon.
  // Once ready, leave the title alone — the renderer owns it for generation progress.
  if (tray) {
    if (_comfyStarting)                    tray.setTitle(' ◌');
    else if (comfyRunning && !_comfyReady)  tray.setTitle(' …');
    else if (!_trayOwnedByRenderer)        tray.setTitle('');
  }

  const menu = Menu.buildFromTemplate([
    {
      label: 'Prompt Gen',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: comfyStatusLabel,
      enabled: false,
    },
    {
      label: comfyRunning ? 'Stop ComfyUI' : 'Start ComfyUI',
      enabled: !_comfyStarting,
      click: () => {
        if (comfyRunning) {
          _weStartedComfyUI = false;
          _comfyStarting = false;
          _comfyReady = false;
          stopComfyUI();
        } else {
          autoStartComfyUI();
        }
      },
    },
    { type: 'separator' },
    {
      label: windowVisible ? 'Hide Window' : 'Show Window',
      click: () => {
        if (!mainWindow || mainWindow.isDestroyed()) {
          createWindow();
        } else if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
        rebuildTrayMenu();
      },
      accelerator: 'CmdOrCtrl+Shift+P',
    },
    {
      label: app.dock.isVisible() ? 'Hide from Dock' : 'Show in Dock',
      click: () => {
        if (app.dock.isVisible()) {
          app.dock.hide();
        } else {
          app.dock.show();
        }
        rebuildTrayMenu();
      },
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        if (!mainWindow || mainWindow.isDestroyed()) {
          createWindow();
        }
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.executeJavaScript("switchTab('settings')");
        rebuildTrayMenu();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        forceQuit = true;
        app.quit();
      },
      accelerator: 'CmdOrCtrl+Q',
    },
  ]);

  tray.setContextMenu(menu);
}

// ===================== TRAY PROGRESS (from renderer via IPC) =====================
let _trayOwnedByRenderer = false;
ipcMain.on('tray-progress', (_event, text) => {
  if (!tray) return;
  _trayOwnedByRenderer = !!text;
  tray.setTitle(text ? ' ' + text : '');
});

ipcMain.on('open-civitai', (_event, url) => {
  openCivitAIPopup(url || '');
});

// ===================== WINDOW =====================
function createWindow() {
  const saved = loadBounds();
  mainWindow = new BrowserWindow({
    width: saved?.width || 1400,
    height: saved?.height || 900,
    x: saved?.x,
    y: saved?.y,
    minWidth: 900,
    minHeight: 600,
    title: 'Prompt Gen',
    backgroundColor: '#1a1a1a',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 16 },
    icon: path.join(__dirname, 'icon.icns'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    }
  });

  mainWindow.loadURL(APP_URL);

  // Push sidebar content down for traffic lights; kill inset top stripe
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.insertCSS(`
      .sidebar { padding-top: 46px !important; }
      .tabs { margin-top: 0 !important; border-top: none !important; }
      .app { border-top: none !important; box-shadow: none !important; }
      html, body { margin-top: 0 !important; padding-top: 0 !important; }
    `);
  });

  // Open external links (CivitAI etc.) in the browser, not in the app window
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${PORT}`)) {
      event.preventDefault();
      openExternalUrl(url);
    }
  });

  // Catch target="_blank" / window.open() so they don't spawn a detached
  // Electron popup that gets lost behind the main window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url);
    return { action: 'deny' };
  });

  mainWindow.on('resize', saveBounds);
  mainWindow.on('move', saveBounds);
  mainWindow.on('close', (e) => {
    e.preventDefault();
    saveBounds();
    mainWindow.hide();
    rebuildTrayMenu();
  });
}

// ===================== APP LIFECYCLE =====================
app.whenReady().then(async () => {
  await session.defaultSession.clearCache();
  createTray();
  await startServer(TOOLS_DIR, PORT);
  createWindow();

  globalShortcut.register('CommandOrControl+Option+I', () => {
    mainWindow?.webContents.openDevTools();
  });

  // Auto-launch ComfyUI in the background if it isn't already running
  autoStartComfyUI();

  // Poll status every 5s — also refresh the port-ready flag
  statusInterval = setInterval(async () => {
    if (isComfyUIRunning()) {
      _comfyReady = await checkComfyPort();
    } else {
      _comfyReady = false;
      _comfyStarting = false;
    }
    rebuildTrayMenu();
  }, 5000);
});

app.on('before-quit', (e) => {
  if (!forceQuit) {
    e.preventDefault();
    if (mainWindow && !mainWindow.isDestroyed()) {
      saveBounds();
      mainWindow.hide();
    }
    app.dock.hide();
    rebuildTrayMenu();
    return;
  }
  // Real quit from tray menu
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.removeAllListeners('close');
    mainWindow.close();
  }
  stopServer();
  if (statusInterval) clearInterval(statusInterval);
  // Quit ComfyUI only if we were the ones who started it
  if (_weStartedComfyUI && isComfyUIRunning()) {
    console.log('[comfyui] quitting (we started it)');
    stopComfyUI();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopServer();
    app.quit();
  }
});

app.on('activate', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
  rebuildTrayMenu();
});
