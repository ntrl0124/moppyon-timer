const statusLead = document.getElementById("statusLead");
const statusTime = document.getElementById("statusTime");
const progressRing = document.getElementById("progressRing");
const pauseResumeButton = document.getElementById("pauseResumeButton");
const pauseResumeIcon = document.getElementById("pauseResumeIcon");
const pauseResumeText = document.getElementById("pauseResumeText");
const resetButton = document.getElementById("resetButton");
const skipButton = document.getElementById("skipButton");
const showNowButton = document.getElementById("showNowButton");
const saveButton = document.getElementById("saveButton");
const saveStatus = document.getElementById("saveStatus");
const settingsForm = document.getElementById("settingsForm");
const tabButtons = Array.from(document.querySelectorAll("[data-tab-button]"));
const tabPanels = Array.from(document.querySelectorAll("[data-tab-panel]"));

const videosPath = document.getElementById("videosPath");
const videoCount = document.getElementById("videoCount");
const soundsPath = document.getElementById("soundsPath");
const soundCount = document.getElementById("soundCount");
const stopSoundsPath = document.getElementById("stopSoundsPath");
const stopSoundCount = document.getElementById("stopSoundCount");

const breakIntervalMinutesField = document.getElementById("breakIntervalMinutes");
const overlayDurationSecondsField = document.getElementById("overlayDurationSeconds");
const soundEnabledField = document.getElementById("soundEnabled");
const autoStartTimerField = document.getElementById("autoStartTimer");

let currentState = null;
let currentSettings = null;
let activeTab = "timer";
let saveStatusTimeout = null;

const PLAY_ICON = `
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5.5a1 1 0 0 1 1.53-.848l9 5.5a1 1 0 0 1 0 1.696l-9 5.5A1 1 0 0 1 8 16.5z" />
  </svg>
`;

const PAUSE_ICON = `
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 5.75A1.75 1.75 0 0 1 8.75 4h1.5A1.75 1.75 0 0 1 12 5.75v12.5A1.75 1.75 0 0 1 10.25 20h-1.5A1.75 1.75 0 0 1 7 18.25zM12 5.75A1.75 1.75 0 0 1 13.75 4h1.5A1.75 1.75 0 0 1 17 5.75v12.5A1.75 1.75 0 0 1 15.25 20h-1.5A1.75 1.75 0 0 1 12 18.25z" />
  </svg>
`;

function setActiveTab(nextTab) {
  activeTab = nextTab;

  tabButtons.forEach((button) => {
    const isActive = button.dataset.tabButton === nextTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  });

  tabPanels.forEach((panel) => {
    const isActive = panel.dataset.tabPanel === nextTab;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });
}

function clearSaveStatus() {
  if (saveStatusTimeout) {
    clearTimeout(saveStatusTimeout);
    saveStatusTimeout = null;
  }

  saveStatus.textContent = "";
}

function showSaveStatus(message) {
  clearSaveStatus();
  saveStatus.textContent = message;
  saveStatusTimeout = setTimeout(() => {
    saveStatus.textContent = "";
    saveStatusTimeout = null;
  }, 3000);
}

function formatSeconds(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getProgressValue(state) {
  if (!currentSettings) {
    return 1;
  }

  const totalSeconds = currentSettings.breakIntervalMinutes * 60;

  if (state.isOverlayVisible || totalSeconds <= 0) {
    return 1;
  }

  return Math.max(0, Math.min(1, state.nextBreakInSeconds / totalSeconds));
}

function renderStatusDetails(state) {
  if (state.isOverlayVisible) {
    if (state.isBreakFinished) {
      statusLead.textContent = "休憩終了";
      statusTime.textContent = "戻れます";
      return;
    }

    statusLead.textContent = "休憩オーバーレイ";
    statusTime.textContent = "表示中";
    return;
  }

  if (state.isPaused) {
    statusLead.textContent = "一時停止中";
    statusTime.textContent = formatSeconds(state.nextBreakInSeconds);
    return;
  }

  statusLead.textContent = "次の休憩まで";
  statusTime.textContent = formatSeconds(state.nextBreakInSeconds);
}

function applySettings(settings) {
  currentSettings = settings;
  breakIntervalMinutesField.value = String(settings.breakIntervalMinutes);
  overlayDurationSecondsField.value = String(settings.overlayDurationSeconds);
  soundEnabledField.checked = settings.soundEnabled;
  autoStartTimerField.checked = settings.autoStartTimer;

  if (currentState) {
    progressRing.style.setProperty("--progress", String(getProgressValue(currentState)));
  }
}

function applyState(state) {
  currentState = state;
  renderStatusDetails(state);
  progressRing.style.setProperty("--progress", String(getProgressValue(state)));
  progressRing.setAttribute("aria-valuenow", String(Math.round(getProgressValue(state) * 100)));
  pauseResumeIcon.innerHTML = state.isPaused ? PLAY_ICON : PAUSE_ICON;
  pauseResumeText.textContent = state.isPaused ? "再開" : "一時停止";
  skipButton.disabled = state.isOverlayVisible;
  resetButton.disabled = state.isOverlayVisible;
  pauseResumeButton.disabled = false;
}

function readForm() {
  return {
    autoStartTimer: autoStartTimerField.checked,
    breakIntervalMinutes: Number(breakIntervalMinutesField.value),
    overlayDurationSeconds: Number(overlayDurationSecondsField.value),
    soundEnabled: soundEnabledField.checked
  };
}

saveButton.addEventListener("click", async () => {
  const result = await window.bunchoAPI.saveSettings(readForm());
  applySettings(result.settings);
  applyState(result.state);
  showSaveStatus("保存しました");
});

pauseResumeButton.addEventListener("click", async () => {
  if (!currentState || currentState.isPaused) {
    applyState(await window.bunchoAPI.resumeTimer());
    return;
  }

  applyState(await window.bunchoAPI.pauseTimer());
});

resetButton.addEventListener("click", async () => {
  applyState(await window.bunchoAPI.resetTimer());
});

skipButton.addEventListener("click", async () => {
  applyState(await window.bunchoAPI.skipNextBreak());
});

showNowButton.addEventListener("click", async () => {
  applyState(await window.bunchoAPI.showBreakNow());
});

settingsForm.addEventListener("input", () => {
  clearSaveStatus();
});

settingsForm.addEventListener("change", () => {
  clearSaveStatus();
});

tabButtons.forEach((button, index) => {
  button.addEventListener("click", () => {
    setActiveTab(button.dataset.tabButton);
  });

  button.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
      return;
    }

    event.preventDefault();
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + offset + tabButtons.length) % tabButtons.length;
    const nextButton = tabButtons[nextIndex];
    setActiveTab(nextButton.dataset.tabButton);
    nextButton.focus();
  });
});

window.bunchoAPI.onTimerState((state) => {
  applyState(state);
});

window.bunchoAPI.onSettingsUpdated((settings) => {
  applySettings(settings);
});

window.addEventListener("DOMContentLoaded", async () => {
  setActiveTab(activeTab);
  const data = await window.bunchoAPI.getSettingsData();
  applySettings(data.settings);
  applyState(data.state);
  stopSoundCount.textContent = `${data.stopSoundCount} 個`;
  stopSoundsPath.textContent = data.stopSoundsPath;
  videosPath.textContent = data.videosPath;
  videoCount.textContent = `${data.videoCount} 個`;
  soundsPath.textContent = data.soundsPath;
  soundCount.textContent = `${data.soundCount} 個`;
});
