const DEFAULTS = {
  minLength: 2,
  color: "#ffeb3b",
  borderColor: "#000000",
  caseSensitive: false,
  wholeWord: false,
  enabled: true,
};

const els = {
  minLength: document.getElementById("minLength"),
  color: document.getElementById("color"),
  borderColor: document.getElementById("borderColor"),
  caseSensitive: document.getElementById("caseSensitive"),
  wholeWord: document.getElementById("wholeWord"),
  enabled: document.getElementById("enabled"),
  saved: document.getElementById("saved"),
  colorHex: document.getElementById("colorHex"),
  borderHex: document.getElementById("borderHex"),
  powerBtn: document.getElementById("powerBtn"),
};

// ── Load settings ──
chrome.storage.sync.get(DEFAULTS, (s) => {
  els.minLength.value = s.minLength;
  els.color.value = s.color;
  els.borderColor.value = s.borderColor;
  els.caseSensitive.checked = s.caseSensitive;
  els.wholeWord.checked = s.wholeWord;
  els.enabled.checked = s.enabled;
  els.colorHex.textContent = s.color;
  els.borderHex.textContent = s.borderColor;
  syncPower();
});

// ── Save on any change ──
function save() {
  const settings = {
    minLength: Math.max(1, parseInt(els.minLength.value) || 2),
    color: els.color.value,
    borderColor: els.borderColor.value,
    caseSensitive: els.caseSensitive.checked,
    wholeWord: els.wholeWord.checked,
    enabled: els.enabled.checked,
  };
  chrome.storage.sync.set(settings, () => {
    flash("Saved");
  });
}

function flash(text) {
  els.saved.textContent = text;
  els.saved.classList.add("show");
  setTimeout(() => {
    els.saved.classList.remove("show");
    els.saved.textContent = "Saved";
  }, 1200);
}

els.minLength.addEventListener("change", save);
els.color.addEventListener("input", save);
els.borderColor.addEventListener("input", save);
els.caseSensitive.addEventListener("change", save);
els.wholeWord.addEventListener("change", save);
els.enabled.addEventListener("change", save);

// ── Power button ──
function syncPower() {
  const on = els.enabled.checked;
  els.powerBtn.classList.toggle("on", on);
  els.powerBtn.querySelector(".power-label").textContent = on ? "ON" : "OFF";
}

els.powerBtn.addEventListener("click", () => {
  els.enabled.checked = !els.enabled.checked;
  els.enabled.dispatchEvent(new Event("change"));
  syncPower();
});

// ── Stepper +/- ──
document.getElementById("minDec").addEventListener("click", () => {
  els.minLength.value = Math.max(1, parseInt(els.minLength.value || 2) - 1);
  els.minLength.dispatchEvent(new Event("change"));
});
document.getElementById("minInc").addEventListener("click", () => {
  els.minLength.value = Math.min(100, parseInt(els.minLength.value || 2) + 1);
  els.minLength.dispatchEvent(new Event("change"));
});

// ── Color hex displays ──
els.color.addEventListener("input", () => {
  els.colorHex.textContent = els.color.value;
});
els.borderColor.addEventListener("input", () => {
  els.borderHex.textContent = els.borderColor.value;
});

// ── Sync border to highlight color ──
document.getElementById("syncBorder").addEventListener("click", () => {
  els.borderColor.value = els.color.value;
  els.borderHex.textContent = els.color.value;
  els.borderColor.dispatchEvent(new Event("input"));
});

// ── Reset ──
document.getElementById("resetBtn").addEventListener("click", () => {
  chrome.storage.sync.set(DEFAULTS, () => {
    els.minLength.value = DEFAULTS.minLength;
    els.color.value = DEFAULTS.color;
    els.colorHex.textContent = DEFAULTS.color;
    els.borderColor.value = DEFAULTS.borderColor;
    els.borderHex.textContent = DEFAULTS.borderColor;
    els.caseSensitive.checked = DEFAULTS.caseSensitive;
    els.wholeWord.checked = DEFAULTS.wholeWord;
    els.enabled.checked = DEFAULTS.enabled;
    syncPower();
    flash("Reset");
  });
});
