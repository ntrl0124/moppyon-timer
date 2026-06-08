const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");

const {
  ALLOWED_INTERVALS,
  ALLOWED_OVERLAY_DURATIONS,
  DEFAULT_SETTINGS
} = require("./constants");

function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function pickAllowedNumber(rawValue, allowedValues, fallback) {
  const numericValue = Number(rawValue);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return allowedValues.includes(numericValue) ? numericValue : fallback;
}

function normalizeSettings(rawSettings = {}) {
  const mergedSettings = {
    ...DEFAULT_SETTINGS,
    ...rawSettings
  };

  const overlayDurationSeconds = pickAllowedNumber(
    mergedSettings.overlayDurationSeconds,
    ALLOWED_OVERLAY_DURATIONS,
    DEFAULT_SETTINGS.overlayDurationSeconds
  );

  const closeDelaySeconds = Math.min(
    DEFAULT_SETTINGS.closeDelaySeconds,
    overlayDurationSeconds
  );

  return {
    breakIntervalMinutes: pickAllowedNumber(
      mergedSettings.breakIntervalMinutes,
      ALLOWED_INTERVALS,
      DEFAULT_SETTINGS.breakIntervalMinutes
    ),
    overlayDurationSeconds,
    closeDelaySeconds,
    soundEnabled: Boolean(mergedSettings.soundEnabled),
    autoStartTimer: Boolean(mergedSettings.autoStartTimer)
  };
}

function readSettings() {
  const settingsPath = getSettingsPath();

  try {
    if (!fs.existsSync(settingsPath)) {
      return DEFAULT_SETTINGS;
    }

    const fileContents = fs.readFileSync(settingsPath, "utf8");
    return normalizeSettings(JSON.parse(fileContents));
  } catch (error) {
    return DEFAULT_SETTINGS;
  }
}

function writeSettings(nextSettings) {
  const settingsPath = getSettingsPath();
  const normalizedSettings = normalizeSettings(nextSettings);

  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(normalizedSettings, null, 2), "utf8");

  return normalizedSettings;
}

module.exports = {
  getSettingsPath,
  normalizeSettings,
  readSettings,
  writeSettings
};
