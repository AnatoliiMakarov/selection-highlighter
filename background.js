chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type !== "updateBadge") return;

  const tabId = sender.tab?.id;
  if (!tabId) return;

  if (msg.count > 0) {
    let text;
    if (msg.activeIndex >= 0) {
      // Navigation: show "3/42"
      const current = msg.activeIndex + 1;
      text = msg.count > 99 ? `${current}` : `${current}/${msg.count}`;
    } else {
      text = msg.count > 999 ? "999+" : String(msg.count);
    }
    chrome.action.setBadgeText({ text, tabId });
    chrome.action.setBadgeBackgroundColor({ color: "#ffeb3b", tabId });
    chrome.action.setBadgeTextColor({ color: "#1e1e2e", tabId });
  } else {
    chrome.action.setBadgeText({ text: "", tabId });
  }
});
