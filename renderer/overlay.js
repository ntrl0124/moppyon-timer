const stateBadge = document.getElementById("stateBadge");
const message = document.getElementById("message");
const bunchoVideo = document.getElementById("bunchoVideo");
const fallbackMessage = document.getElementById("fallbackMessage");
const remainingLabel = document.getElementById("remainingLabel");
const closeLabel = document.getElementById("closeLabel");
const closeButton = document.getElementById("closeButton");

let overlayInterval = null;
let activeAudio = null;
let activeAudioStopTimeout = null;
let isBreakFinished = false;

function formatSeconds(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function renderCountdown(remainingSeconds, closeDelaySeconds) {
  if (remainingSeconds > 0) {
    remainingLabel.textContent = `休憩時間 — あと ${formatSeconds(remainingSeconds)}`;
  } else if (isBreakFinished) {
    remainingLabel.textContent = "休憩時間が終わりました";
  } else {
    remainingLabel.textContent = "まもなく休憩終了です";
  }

  if (closeDelaySeconds > 0) {
    closeLabel.textContent = isBreakFinished
      ? `あと ${closeDelaySeconds} 秒で、下のボタンから作業に戻れます。`
      : `閉じるボタンはあと ${closeDelaySeconds} 秒で使えます。`;
    closeButton.disabled = true;
    closeButton.textContent = isBreakFinished
      ? `もうすぐ作業に戻れます — あと${closeDelaySeconds}秒`
      : `まだ閉じられません — あと${closeDelaySeconds}秒`;
    return;
  }

  closeLabel.textContent = isBreakFinished
    ? "準備ができたら、下のボタンから作業に戻ってください。"
    : "こまめな休憩が、パフォーマンスを保ちます。\n急ぐ場合は、このまま閉じて作業に戻れます。";
  closeButton.disabled = false;
  closeButton.textContent = isBreakFinished ? "作業に戻る" : "閉じる";
}

async function playAudio(soundUrl) {
  if (!soundUrl) {
    return;
  }

  if (activeAudioStopTimeout) {
    clearTimeout(activeAudioStopTimeout);
    activeAudioStopTimeout = null;
  }

  activeAudio = new Audio(soundUrl);

  try {
    activeAudio.volume = 1;
    await activeAudio.play();
  } catch (error) {
    activeAudio = null;
  }
}

async function playAudioSnippet(soundUrl, snippetDurationSeconds = 5) {
  if (!soundUrl) {
    return;
  }

  if (activeAudioStopTimeout) {
    clearTimeout(activeAudioStopTimeout);
    activeAudioStopTimeout = null;
  }

  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
  }

  const snippetAudio = new Audio(soundUrl);
  activeAudio = snippetAudio;

  try {
    const duration = await new Promise((resolve, reject) => {
      snippetAudio.addEventListener("loadedmetadata", () => resolve(snippetAudio.duration), {
        once: true
      });
      snippetAudio.addEventListener("error", () => reject(new Error("audio-load-failed")), {
        once: true
      });
      snippetAudio.load();
    });

    const maxStartTime = Math.max(0, duration - snippetDurationSeconds);

    if (Number.isFinite(maxStartTime) && maxStartTime > 0) {
      snippetAudio.currentTime = Math.random() * maxStartTime;
    }

    snippetAudio.volume = 1;
    await snippetAudio.play();
    activeAudioStopTimeout = setTimeout(() => {
      if (activeAudio === snippetAudio) {
        snippetAudio.pause();
        snippetAudio.currentTime = 0;
        activeAudio = null;
      }
    }, snippetDurationSeconds * 1000);
  } catch (error) {
    if (activeAudio === snippetAudio) {
      activeAudio = null;
    }
  }
}

function startOverlay(payload) {
  isBreakFinished = false;
  stateBadge.textContent = "BREAK TIME";
  message.textContent = payload.message || "席を離れて、目と肩をほぐしましょう。";

  if (payload.videoExists && payload.videoUrl) {
    bunchoVideo.src = payload.videoUrl;
    bunchoVideo.hidden = false;
    fallbackMessage.hidden = true;
    bunchoVideo.play().catch(() => {
      bunchoVideo.hidden = true;
      fallbackMessage.hidden = false;
    });
  } else {
    bunchoVideo.hidden = true;
    fallbackMessage.hidden = false;
  }

  playAudio(payload.soundUrl);

  let remainingSeconds = payload.durationSeconds;
  let closeDelaySeconds = payload.closeDelaySeconds;
  renderCountdown(remainingSeconds, closeDelaySeconds);

  if (overlayInterval) {
    clearInterval(overlayInterval);
  }

  overlayInterval = setInterval(() => {
    remainingSeconds = Math.max(0, remainingSeconds - 1);
    closeDelaySeconds = Math.max(0, closeDelaySeconds - 1);
    renderCountdown(remainingSeconds, closeDelaySeconds);
  }, 1000);
}

function showBreakFinishedState(payload) {
  isBreakFinished = true;
  stateBadge.textContent = "BREAK OVER";
  renderCountdown(0, 0);
  playAudioSnippet(payload.soundUrl);
}

closeButton.addEventListener("click", async () => {
  await window.bunchoAPI.closeOverlay();
});

window.bunchoAPI.onBreakFinished((payload) => {
  showBreakFinishedState(payload);
});

window.bunchoAPI.onBreakPayload((payload) => {
  startOverlay(payload);
});

window.addEventListener("beforeunload", () => {
  if (overlayInterval) {
    clearInterval(overlayInterval);
  }

  if (activeAudio) {
    activeAudio.pause();
  }

  if (activeAudioStopTimeout) {
    clearTimeout(activeAudioStopTimeout);
  }
});
