// --- Default widget settings ---
const fallbackData = {
  barImageUrl: "https://cdn.streamelements.com/uploads/01jvczf9f8ts6wgf8wvg4t7bej.png",
  dialImageUrl: "https://cdn.streamelements.com/uploads/01jvczh325nqme4aea6pmm9zz8.png",
  command: "!increase",
  resetCommand: "!reset",
  sections: 8,
  decayIntervalSeconds: 300
};

let config = null;
let progressState = null;
let decayTimer = null;

function calculateDialTop(currentStep, totalSections) {
  const rawTop = 100 - ((currentStep - 0.5) * (100 / totalSections)) - 3.125;
  return Math.max(rawTop, 0);
}

function updateDialPosition() {
  const dial = document.getElementById("dial-image");
  if (!dial) return;
  const { currentStep, sections } = progressState;
  const topPercent = calculateDialTop(currentStep, sections);
  dial.style.top = `${topPercent}%`;
}

function resetDecayTimer() {
  if (decayTimer) clearInterval(decayTimer);

  decayTimer = setInterval(() => {
    if (progressState.currentStep > 1) {
      progressState.currentStep--;
      updateDialPosition();
    }
  }, config.decayIntervalSeconds * 1000);
}

function handleChatMessage(message, user = {}) {
  if (!message) return;
  const trimmed = message.trim().toLowerCase();

  if (trimmed === config.command.toLowerCase()) {
    if (progressState.currentStep < progressState.sections) {
      progressState.currentStep++;
      updateDialPosition();
    }
    resetDecayTimer();
  }

  if (trimmed === config.resetCommand.toLowerCase()) {
    const isModOrBroadcaster = user.isModerator || user.isBroadcaster;
    if (isModOrBroadcaster) {
      progressState.currentStep = 1;
      updateDialPosition();
      resetDecayTimer();
    }
  }
}

window.addEventListener("onWidgetLoad", (obj) => {
  const fieldData = obj.detail.fieldData || {};

  config = {
    barImageUrl: (typeof fieldData.barImageUrl === "string" && fieldData.barImageUrl.trim()) || fallbackData.barImageUrl,
    dialImageUrl: (typeof fieldData.dialImageUrl === "string" && fieldData.dialImageUrl.trim()) || fallbackData.dialImageUrl,
    command: (typeof fieldData.command === "string" && fieldData.command.trim()) || fallbackData.command,
    resetCommand: (typeof fieldData.resetCommand === "string" && fieldData.resetCommand.trim()) || fallbackData.resetCommand,
    sections: Number.isInteger(+fieldData.sections) ? +fieldData.sections : fallbackData.sections,
    decayIntervalSeconds: Number.isInteger(+fieldData.decayIntervalSeconds) ? +fieldData.decayIntervalSeconds : fallbackData.decayIntervalSeconds
  };

  window.addEventListener("onEventReceived", (obj) => {
  const data = obj.detail;
  
  if (data.listener === "message") {
    const message = data.event.data.text;
    const user = {
      isModerator: data.event.data.tags.mod === "1",
      isBroadcaster: data.event.data.displayName?.toLowerCase() === data.event.data.channel?.toLowerCase()
    };

    handleChatMessage(message, user);
  }
});

  progressState = {
    currentStep: 1,
    sections: config.sections
  };

  document.getElementById("bar-image").src = config.barImageUrl;
  document.getElementById("dial-image").src = config.dialImageUrl;

  updateDialPosition();
  resetDecayTimer();
});
