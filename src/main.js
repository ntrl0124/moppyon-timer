const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  Tray
} = require("electron");

const {
  BREAK_MESSAGES,
  DEFAULT_SETTINGS
} = require("./constants");
const { readSettings, writeSettings } = require("./settings-store");

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

let tray = null;
let settingsWindow = null;
let overlayWindow = null;
let settings = { ...DEFAULT_SETTINGS };
let timerTimeout = null;
let breakEndTimeout = null;
let statusInterval = null;
let nextBreakAt = null;
let remainingMs = DEFAULT_SETTINGS.breakIntervalMinutes * 60 * 1000;
let isPaused = false;
let overlayLockedUntil = null;
let isFinishingBreak = false;
let isBreakFinished = false;
let preferredSettingsContentHeight = null;

const OVERLAY_SOUND_EXTENSIONS = new Set([".wav"]);
const STOP_SOUND_EXTENSIONS = new Set([".wav", ".mp3", ".m4a", ".aac", ".ogg"]);

function getAppAssetPath(...segments) {
  const assetsRoot = app.isPackaged
    ? path.join(process.resourcesPath, "assets")
    : path.join(app.getAppPath(), "assets");

  return path.join(assetsRoot, ...segments);
}

function getBreakIntervalMs() {
  return settings.breakIntervalMinutes * 60 * 1000;
}

function getRemainingMs() {
  if (nextBreakAt) {
    return Math.max(0, nextBreakAt - Date.now());
  }

  return remainingMs;
}

function formatSeconds(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function pickRandom(items) {
  if (!items.length) {
    return null;
  }

  return items[Math.floor(Math.random() * items.length)];
}

function listAssetFiles(directoryName, allowedExtensions) {
  const assetDirectory = getAppAssetPath(directoryName);

  try {
    if (!fs.existsSync(assetDirectory)) {
      return [];
    }

    return fs
      .readdirSync(assetDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && allowedExtensions.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => path.join(assetDirectory, entry.name));
  } catch (error) {
    return [];
  }
}

function listSoundFiles() {
  return listAssetFiles("sounds", OVERLAY_SOUND_EXTENSIONS);
}

function listStopSoundFiles() {
  return listAssetFiles("stop_sounds", STOP_SOUND_EXTENSIONS);
}

function listVideoFiles() {
  const videosDirectory = getAppAssetPath("videos");
  const allowedExtensions = new Set([".mp4", ".mov", ".m4v", ".webm"]);

  try {
    if (!fs.existsSync(videosDirectory)) {
      return [];
    }

    return fs
      .readdirSync(videosDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && allowedExtensions.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => path.join(videosDirectory, entry.name));
  } catch (error) {
    return [];
  }
}

function buildOverlayPayload() {
  const videoFiles = listVideoFiles();
  const selectedVideoPath = pickRandom(videoFiles);
  const soundFiles = listSoundFiles();
  const selectedSoundPath = settings.soundEnabled ? pickRandom(soundFiles) : null;

  return {
    closeDelaySeconds: settings.closeDelaySeconds,
    durationSeconds: settings.overlayDurationSeconds,
    message: pickRandom(BREAK_MESSAGES),
    soundUrl: selectedSoundPath ? pathToFileURL(selectedSoundPath).href : null,
    videoExists: Boolean(selectedVideoPath),
    videoUrl: selectedVideoPath ? pathToFileURL(selectedVideoPath).href : null
  };
}

function buildBreakFinishedPayload() {
  const stopSoundFiles = listStopSoundFiles();
  const selectedSoundPath = settings.soundEnabled ? pickRandom(stopSoundFiles) : null;

  return {
    soundUrl: selectedSoundPath ? pathToFileURL(selectedSoundPath).href : null
  };
}

function getTimerStatusLabel() {
  if (overlayWindow) {
    if (isBreakFinished) {
      return "休憩終了";
    }

    return "休憩オーバーレイ表示中";
  }

  if (isPaused) {
    return `一時停止中 (${formatSeconds(Math.ceil(getRemainingMs() / 1000))})`;
  }

  return `次の休憩まで ${formatSeconds(Math.ceil(getRemainingMs() / 1000))}`;
}

function getStateSnapshot() {
  return {
    isBreakFinished,
    isOverlayVisible: Boolean(overlayWindow),
    isPaused,
    nextBreakInSeconds: Math.ceil(getRemainingMs() / 1000),
    statusLabel: getTimerStatusLabel()
  };
}

function sendToSettingsWindow(channel, payload) {
  if (!settingsWindow || settingsWindow.isDestroyed()) {
    return;
  }

  settingsWindow.webContents.send(channel, payload);
}

function broadcastState() {
  sendToSettingsWindow("timer:state", getStateSnapshot());
}

function broadcastSettings() {
  sendToSettingsWindow("settings:updated", settings);
}

function refreshTrayTitle() {
  if (!tray) {
    return;
  }

  if (overlayWindow) {
    if (isBreakFinished) {
      tray.setTitle("終了");
      tray.setToolTip("文鳥休憩タイマー: 休憩が終わりました");
      return;
    }

    tray.setTitle("休憩中");
    tray.setToolTip("文鳥休憩タイマー: 休憩オーバーレイ表示中");
    return;
  }

  if (isPaused) {
    tray.setTitle("停止中");
    tray.setToolTip("文鳥休憩タイマー: 一時停止中");
    return;
  }

  const remainingSeconds = Math.ceil(getRemainingMs() / 1000);
  const title = formatSeconds(remainingSeconds);
  tray.setTitle(title);
  tray.setToolTip(`文鳥休憩タイマー: ${title}`);
}

function refreshTrayMenu() {
  if (!tray) {
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: isPaused ? "再開" : "一時停止",
      click: () => {
        if (isPaused) {
          resumeTimer();
        } else {
          pauseTimer();
        }
      }
    },
    {
      label: "タイマーをリセット",
      enabled: !overlayWindow,
      click: () => resetTimer()
    },
    {
      label: "次の休憩をスキップ",
      enabled: !overlayWindow,
      click: () => skipNextBreak()
    },
    {
      label: "今すぐ休憩を表示",
      click: () => showBreakNow()
    },
    { type: "separator" },
    {
      label: "設定を開く",
      click: () => openSettingsWindow()
    },
    { type: "separator" },
    {
      label: "終了",
      click: () => app.quit()
    }
  ]);

  tray.setContextMenu(contextMenu);
  refreshTrayTitle();
}

function clearTimerTimeout() {
  if (timerTimeout) {
    clearTimeout(timerTimeout);
    timerTimeout = null;
  }
}

function clearBreakEndTimeout() {
  if (breakEndTimeout) {
    clearTimeout(breakEndTimeout);
    breakEndTimeout = null;
  }
}

function notifyOverlayBreakFinished() {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return;
  }

  isBreakFinished = true;
  overlayWindow.webContents.send("break:finished", buildBreakFinishedPayload());
  broadcastState();
  refreshTrayMenu();
}

function scheduleNextBreak(delayMs = getBreakIntervalMs()) {
  clearTimerTimeout();
  nextBreakAt = Date.now() + delayMs;
  remainingMs = delayMs;
  timerTimeout = setTimeout(() => {
    timerTimeout = null;
    nextBreakAt = null;
    showBreakNow();
  }, delayMs);

  broadcastState();
  refreshTrayMenu();
}

function pauseTimer() {
  if (isPaused) {
    return getStateSnapshot();
  }

  if (!overlayWindow) {
    remainingMs = getRemainingMs() || getBreakIntervalMs();
  } else {
    remainingMs = getBreakIntervalMs();
  }

  isPaused = true;
  nextBreakAt = null;
  clearTimerTimeout();
  broadcastState();
  refreshTrayMenu();

  return getStateSnapshot();
}

function resumeTimer() {
  if (!isPaused && timerTimeout) {
    return getStateSnapshot();
  }

  isPaused = false;
  scheduleNextBreak(remainingMs || getBreakIntervalMs());
  return getStateSnapshot();
}

function resetTimer() {
  if (overlayWindow) {
    return getStateSnapshot();
  }

  remainingMs = getBreakIntervalMs();

  if (isPaused) {
    nextBreakAt = null;
    clearTimerTimeout();
    broadcastState();
    refreshTrayMenu();
    return getStateSnapshot();
  }

  scheduleNextBreak(getBreakIntervalMs());
  return getStateSnapshot();
}

function finishBreak() {
  if (isFinishingBreak) {
    return;
  }

  isFinishingBreak = true;
  isBreakFinished = false;
  clearBreakEndTimeout();
  overlayLockedUntil = null;

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
  }

  overlayWindow = null;
  isFinishingBreak = false;
  remainingMs = getBreakIntervalMs();

  if (!isPaused) {
    scheduleNextBreak(getBreakIntervalMs());
  } else {
    broadcastState();
    refreshTrayMenu();
  }
}

function canCloseOverlay() {
  return overlayLockedUntil === null || Date.now() >= overlayLockedUntil;
}

function showBreakNow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.focus();
    return getStateSnapshot();
  }

  clearTimerTimeout();
  nextBreakAt = null;
  isBreakFinished = false;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { bounds } = primaryDisplay;

  overlayWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js")
    }
  });

  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  overlayWindow.on("close", (event) => {
    if (isFinishingBreak) {
      return;
    }

    if (!canCloseOverlay()) {
      event.preventDefault();
      return;
    }
  });

  overlayWindow.on("closed", () => {
    overlayWindow = null;
    isBreakFinished = false;
    refreshTrayMenu();
    broadcastState();
  });

  overlayWindow.loadFile(path.join(__dirname, "..", "renderer", "overlay.html"));

  overlayWindow.webContents.once("did-finish-load", () => {
    const payload = buildOverlayPayload();
    overlayLockedUntil = Date.now() + settings.closeDelaySeconds * 1000;
    overlayWindow.webContents.send("break:payload", payload);
    broadcastState();
    refreshTrayMenu();
  });

  breakEndTimeout = setTimeout(() => {
    breakEndTimeout = null;
    notifyOverlayBreakFinished();
  }, settings.overlayDurationSeconds * 1000);

  return getStateSnapshot();
}

function skipNextBreak() {
  if (overlayWindow) {
    finishBreak();
    return getStateSnapshot();
  }

  if (isPaused) {
    return getStateSnapshot();
  }

  scheduleNextBreak(getBreakIntervalMs());
  return getStateSnapshot();
}

function createTray() {
  const trayIconPath = getAppAssetPath("tray", "bunchoTemplate.png");
  const fallbackTrayImage = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/AsVY5QAAAABJRU5ErkJggg=="
  );
  const trayImage = nativeImage.createFromPath(trayIconPath);
  const resolvedTrayImage = trayImage.isEmpty() ? fallbackTrayImage : trayImage;

  if (!resolvedTrayImage.isEmpty() && process.platform === "darwin") {
    resolvedTrayImage.setTemplateImage(true);
  }

  tray = new Tray(resolvedTrayImage);
  tray.setIgnoreDoubleClickEvents(true);
  tray.on("click", () => openSettingsWindow());
  refreshTrayMenu();
}

function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow;
  }

  settingsWindow = new BrowserWindow({
    width: 520,
    height: preferredSettingsContentHeight ?? 700,
    minWidth: 480,
    minHeight: 620,
    title: "文鳥休憩タイマー設定",
    backgroundColor: "#f6f6f9",
    autoHideMenuBar: true,
    useContentSize: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js")
    }
  });

  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });

  settingsWindow.loadFile(path.join(__dirname, "..", "renderer", "settings.html"));
  settingsWindow.webContents.once("did-finish-load", () => {
    broadcastSettings();
    broadcastState();
  });

  return settingsWindow;
}

function applySettings(nextSettings) {
  const previousSettings = settings;
  settings = writeSettings(nextSettings);
  const intervalChanged =
    previousSettings.breakIntervalMinutes !== settings.breakIntervalMinutes;

  if (!overlayWindow) {
    if (isPaused) {
      if (intervalChanged) {
        remainingMs = getBreakIntervalMs();
      }
      nextBreakAt = null;
      clearTimerTimeout();
    } else if (intervalChanged) {
      scheduleNextBreak(getBreakIntervalMs());
    }
  }

  broadcastSettings();
  broadcastState();
  refreshTrayMenu();

  return settings;
}

function startTimerFromSettings() {
  remainingMs = getBreakIntervalMs();

  if (settings.autoStartTimer) {
    isPaused = false;
    scheduleNextBreak(getBreakIntervalMs());
  } else {
    isPaused = true;
    nextBreakAt = null;
    clearTimerTimeout();
    broadcastState();
    refreshTrayMenu();
  }
}

function registerIpcHandlers() {
  ipcMain.handle("settings:get-data", () => ({
    settings,
    state: getStateSnapshot()
  }));

  ipcMain.handle("settings:save", (_event, nextSettings) => ({
    settings: applySettings(nextSettings),
    state: getStateSnapshot()
  }));
  ipcMain.handle("settings:resize-window", (_event, requestedHeight) => {
    if (!settingsWindow || settingsWindow.isDestroyed()) {
      return null;
    }

    const normalizedHeight = Math.max(
      620,
      Math.min(760, Math.ceil(Number(requestedHeight) || 0))
    );

    preferredSettingsContentHeight = normalizedHeight;
    const [currentWidth] = settingsWindow.getContentSize();
    settingsWindow.setContentSize(currentWidth, normalizedHeight);

    return normalizedHeight;
  });

  ipcMain.handle("timer:pause", () => pauseTimer());
  ipcMain.handle("timer:reset", () => resetTimer());
  ipcMain.handle("timer:resume", () => resumeTimer());
  ipcMain.handle("timer:skip", () => skipNextBreak());
  ipcMain.handle("timer:show-now", () => showBreakNow());
  ipcMain.handle("overlay:close-request", () => {
    if (canCloseOverlay()) {
      finishBreak();
      return { closed: true };
    }

    return {
      closed: false,
      remainingLockSeconds: Math.ceil((overlayLockedUntil - Date.now()) / 1000)
    };
  });
}

app.whenReady().then(() => {
  settings = readSettings();
  registerIpcHandlers();
  createTray();
  openSettingsWindow();
  startTimerFromSettings();

  statusInterval = setInterval(() => {
    refreshTrayTitle();
    broadcastState();
  }, 1000);

  app.on("activate", () => {
    openSettingsWindow();
  });
});

app.on("before-quit", () => {
  clearTimerTimeout();
  clearBreakEndTimeout();

  if (statusInterval) {
    clearInterval(statusInterval);
  }
});
