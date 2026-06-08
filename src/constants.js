const BREAK_MESSAGES = [
  "お茶を淹れる時間です。",
  "首と肩を回してください。",
  "30秒だけ窓の外を見てください。",
  "深呼吸を3回しましょう。",
  "立って、少し歩いてみましょう。",
  "水を一杯飲んでください。",
  "目を閉じて、10秒だけ休めてください。",
  "背筋を伸ばして、大きく息を吸ってください。",
  "手首と指をほぐしてみませんか？",
  "遠くの景色を眺めてみませんか？",
  "少しだけストレッチしましょう。",
];

const DEFAULT_SETTINGS = {
  breakIntervalMinutes: 30,
  overlayDurationSeconds: 60,
  closeDelaySeconds: 10,
  soundEnabled: true,
  autoStartTimer: true
};

const ALLOWED_INTERVALS = [15, 30, 45, 60];
const ALLOWED_OVERLAY_DURATIONS = [30, 60, 180, 300];

module.exports = {
  ALLOWED_INTERVALS,
  ALLOWED_OVERLAY_DURATIONS,
  BREAK_MESSAGES,
  DEFAULT_SETTINGS
};
