const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");

const { DEFAULT_SETTINGS } = require("./constants");

const DECIMAL_PRECISION = 1000;
const MINIMUM_BREAK_INTERVAL_MINUTES = 0.1;
const MINIMUM_OVERLAY_DURATION_SECONDS = 6;

function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function roundToPrecision(value) {
  return Math.round(value * DECIMAL_PRECISION) / DECIMAL_PRECISION;
}

function normalizeNumericSetting(rawValue, fallback, minimumValue) {
  const numericValue = Number(rawValue);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return roundToPrecision(Math.max(minimumValue, numericValue));
}

function normalizeSettings(rawSettings = {}) {
  const mergedSettings = {
    ...DEFAULT_SETTINGS,
    ...rawSettings
  };

  const overlayDurationSeconds = normalizeNumericSetting(
    mergedSettings.overlayDurationSeconds,
    DEFAULT_SETTINGS.overlayDurationSeconds,
    MINIMUM_OVERLAY_DURATION_SECONDS
  );

  const closeDelaySeconds = roundToPrecision(Math.min(
    DEFAULT_SETTINGS.closeDelaySeconds,
    overlayDurationSeconds
  ));

  return {
    breakIntervalMinutes: normalizeNumericSetting(
      mergedSettings.breakIntervalMinutes,
      DEFAULT_SETTINGS.breakIntervalMinutes,
      MINIMUM_BREAK_INTERVAL_MINUTES
    ),
    overlayDurationSeconds,
    closeDelaySeconds,
    soundEnabled: Boolean(mergedSettings.soundEnabled),
    autoStartTimer: Boolean(mergedSettings.autoStartTimer),
    launchAtLogin: Boolean(mergedSettings.launchAtLogin)
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
