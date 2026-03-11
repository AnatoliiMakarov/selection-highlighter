(() => {
  "use strict";

  const DEBOUNCE_MS = 80;
  const MAX_SCROLLBAR_MARKERS = 500;

  const supportsHighlightAPI = typeof Highlight !== "undefined" && !!CSS?.highlights;

  let fallbackMarks = [];
  let scrollbarTrack = null;
  let currentRanges = [];   // all found ranges
  let currentIndex = -1;    // active match index
  let inputMatchCount = 0;
  let inputBanner = null;
  let highlightedInputs = [];
  let matchingInputEls = [];
  let navItems = [];
  let settings = {
    minLength: 2,
    color: "#ffeb3b",
    borderColor: "#000000",
    caseSensitive: false,
    wholeWord: false,
    enabled: true,
    highlightInputs: false,
    showInputBanner: true,
  };

  const TEXT_INPUT_TYPES = new Set(["text", "search", "url", "email", "tel", ""]);

  // ── Load settings ──
  chrome.storage.sync.get(settings, (s) => {
    settings = s;
    applyColor();
  });

  // ── React to settings changes in real time ──
  chrome.storage.onChanged.addListener((changes) => {
    for (const [key, { newValue }] of Object.entries(changes)) {
      settings[key] = newValue;
    }
    applyColor();
    clearHighlights();
  });

  // ── Color: CSS variables ──
  function applyColor() {
    document.documentElement.style.setProperty("--sh-color", settings.color);
    document.documentElement.style.setProperty("--sh-border", settings.borderColor);
  }

  // ── Whole word check ──
  function isWordBoundary(char) {
    return !char || /[\s\p{P}\p{S}]/u.test(char);
  }

  function isWholeWordMatch(text, idx, queryLen) {
    const before = idx > 0 ? text[idx - 1] : "";
    const after = idx + queryLen < text.length ? text[idx + queryLen] : "";
    return isWordBoundary(before) && isWordBoundary(after);
  }

  // ── Count matches inside input/textarea fields ──
  function countInputMatches(query) {
    const elements = [];
    let count = 0;
    const searchQuery = settings.caseSensitive ? query : query.toLowerCase();
    const fields = document.querySelectorAll("input, textarea");

    for (const el of fields) {
      if (el.tagName === "INPUT" &&
          !TEXT_INPUT_TYPES.has((el.getAttribute("type") || "").toLowerCase())) {
        continue;
      }
      if ((el.offsetParent === null && getComputedStyle(el).position !== "fixed") ||
          getComputedStyle(el).visibility === "hidden") {
        continue;
      }
      const val = el.value;
      if (!val) continue;
      const hay = settings.caseSensitive ? val : val.toLowerCase();
      let pos = 0;
      let fieldCount = 0;
      while ((pos = hay.indexOf(searchQuery, pos)) !== -1) {
        if (!settings.wholeWord || isWholeWordMatch(hay, pos, searchQuery.length)) {
          fieldCount++;
        }
        pos += 1;
      }
      if (fieldCount > 0) {
        count += fieldCount;
        elements.push(el);
      }
    }

    return { count, elements };
  }

  // ── Main function ──
  function highlightMatches(searchText) {
    clearHighlights();

    if (!settings.enabled) return;

    const query = searchText ?? "";
    if (!query || query.trim().length === 0 || query.length < settings.minLength) return;

    let matchCount = 0;

    if (supportsHighlightAPI) {
      const ranges = findAllRanges(query);
      currentRanges = ranges;
      matchCount = ranges.length;
      if (ranges.length > 0) {
        const hl = new Highlight();
        for (const r of ranges) hl.add(r);
        CSS.highlights.set("selection-matches", hl);
      }
    } else {
      matchCount = highlightWithFallback(query);
    }

    // Input field matches
    const inputResult = countInputMatches(query);
    inputMatchCount = inputResult.count;
    matchingInputEls = inputResult.elements;
    if (settings.highlightInputs && inputResult.elements.length > 0) {
      for (const el of inputResult.elements) {
        el.classList.add("sh-input-match");
        highlightedInputs.push(el);
      }
    }
    if (inputMatchCount > 0 && settings.showInputBanner) {
      showInputBanner(inputMatchCount);
    } else {
      removeInputBanner();
    }

    // Build unified navigation list
    navItems = [];
    if (supportsHighlightAPI) {
      for (const r of currentRanges) {
        try {
          const rect = r.getBoundingClientRect();
          navItems.push({ type: "range", target: r, y: rect.top + window.scrollY });
        } catch (e) { /* detached range */ }
      }
    } else {
      for (const m of fallbackMarks) {
        const rect = m.getBoundingClientRect();
        navItems.push({ type: "mark", target: m, y: rect.top + window.scrollY });
      }
    }
    for (const el of matchingInputEls) {
      const rect = el.getBoundingClientRect();
      navItems.push({ type: "input", target: el, y: rect.top + window.scrollY });
    }
    navItems.sort((a, b) => a.y - b.y);

    currentIndex = -1;
    updateBadge(matchCount + inputMatchCount);
    if (matchCount > 0) {
      showScrollbarMarkers(query);
    }
  }

  // ── Clear input highlights ──
  function clearInputHighlights() {
    for (const el of highlightedInputs) {
      el.classList.remove("sh-input-match");
      el.classList.remove("sh-input-active");
    }
    highlightedInputs = [];
    inputMatchCount = 0;
  }

  // ── Input banner ──
  function buildBannerText(count) {
    const frag = document.createDocumentFragment();
    const name = document.createElement("strong");
    name.style.color = "var(--sh-color, #ffeb3b)";
    name.textContent = "Selection Highlighter";
    frag.appendChild(name);

    const word = count === 1 ? "match" : "matches";
    if (settings.highlightInputs) {
      frag.appendChild(document.createTextNode(` \u2014 ${count} ${word} highlighted in input fields`));
    } else {
      frag.appendChild(document.createTextNode(` \u2014 ${count} ${word} found in input fields (not highlightable)`));
      const br = document.createElement("br");
      frag.appendChild(br);
      const hint = document.createElement("span");
      hint.style.cssText = "font-size:11px;opacity:0.7";
      hint.textContent = "Enable input highlighting in extension settings";
      frag.appendChild(hint);
    }
    return frag;
  }

  function showInputBanner(count) {
    if (!inputBanner) {
      inputBanner = document.createElement("div");
      inputBanner.className = "sh-input-banner";

      const icon = document.createElement("img");
      icon.src = chrome.runtime.getURL("icon16.png");
      icon.width = 14;
      icon.height = 14;
      icon.style.cssText = "flex-shrink:0;";
      inputBanner.appendChild(icon);

      const textSpan = document.createElement("span");
      textSpan.className = "sh-input-banner-text";
      inputBanner.appendChild(textSpan);

      const dismiss = document.createElement("button");
      dismiss.className = "sh-input-banner-dismiss";
      dismiss.textContent = "\u00d7";
      dismiss.addEventListener("click", () => removeInputBanner());
      inputBanner.appendChild(dismiss);

      document.body.appendChild(inputBanner);
    }

    const textEl = inputBanner.querySelector(".sh-input-banner-text");
    textEl.textContent = "";
    textEl.appendChild(buildBannerText(count));
  }

  function removeInputBanner() {
    if (inputBanner) {
      inputBanner.remove();
      inputBanner = null;
    }
  }

  // ── Navigation: Ctrl+↑ / Ctrl+↓ ──
  function findClosestMatchIndex() {
    if (navItems.length === 0) return 0;
    let selY = 0;
    const active = document.activeElement;
    if (active && matchingInputEls.includes(active)) {
      const rect = active.getBoundingClientRect();
      selY = rect.top + window.scrollY;
    } else {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const selRect = sel.getRangeAt(0).getBoundingClientRect();
        selY = selRect.top + window.scrollY;
      }
    }
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < navItems.length; i++) {
      const dist = Math.abs(navItems[i].y - selY);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }
    return closestIdx;
  }

  function navigateToMatch(direction) {
    const total = navItems.length;
    if (total === 0) return;

    if (currentIndex === -1) {
      const closest = findClosestMatchIndex();
      if (direction === "next") {
        currentIndex = closest < total - 1 ? closest + 1 : 0;
      } else {
        currentIndex = closest > 0 ? closest - 1 : total - 1;
      }
    } else if (direction === "next") {
      currentIndex = currentIndex < total - 1 ? currentIndex + 1 : 0;
    } else {
      currentIndex = currentIndex > 0 ? currentIndex - 1 : total - 1;
    }

    // Clear all active states
    if (supportsHighlightAPI) {
      CSS.highlights.delete("selection-current");
    } else {
      fallbackMarks.forEach((m) => m.classList.remove("sh-highlight-current"));
    }
    for (const el of matchingInputEls) {
      el.classList.remove("sh-input-active");
    }

    // Activate current item
    const item = navItems[currentIndex];
    if (item.type === "range") {
      CSS.highlights.set("selection-current", new Highlight(item.target));
      scrollToRange(item.target);
    } else if (item.type === "mark") {
      item.target.classList.add("sh-highlight-current");
      item.target.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (item.type === "input") {
      item.target.classList.add("sh-input-active");
      item.target.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    updateBadge(total, currentIndex);
    updateActiveScrollbarMarker();
  }

  function scrollToRange(range) {
    const rect = range.getBoundingClientRect();
    const isVisible =
      rect.top >= 0 &&
      rect.bottom <= window.innerHeight;

    if (!isVisible) {
      const absY = rect.top + window.scrollY - window.innerHeight / 2;
      window.scrollTo({ top: absY, behavior: "smooth" });
    }
  }

  document.addEventListener("keydown", (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      navigateToMatch("next");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      navigateToMatch("prev");
    }
  });

  // ── CSS Custom Highlight API ──
  function findAllRanges(query) {
    const ranges = [];
    const searchQuery = settings.caseSensitive ? query : query.toLowerCase();
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT
    );

    let node;
    while ((node = walker.nextNode())) {
      const tag = node.parentElement?.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") continue;

      const text = settings.caseSensitive
        ? node.textContent
        : node.textContent.toLowerCase();
      let pos = 0;

      while ((pos = text.indexOf(searchQuery, pos)) !== -1) {
        if (!settings.wholeWord || isWholeWordMatch(text, pos, searchQuery.length)) {
          try {
            const range = new Range();
            range.setStart(node, pos);
            range.setEnd(node, pos + query.length);
            ranges.push(range);
          } catch (e) {
            // skip
          }
        }
        pos += 1;
      }
    }

    return ranges;
  }

  // ── Fallback: <mark> wrapper ──
  function highlightWithFallback(query) {
    const searchQuery = settings.caseSensitive ? query : query.toLowerCase();
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT
    );

    const matches = [];
    let node;
    while ((node = walker.nextNode())) {
      const tag = node.parentElement?.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "MARK") continue;

      const text = settings.caseSensitive
        ? node.textContent
        : node.textContent.toLowerCase();
      if (text.includes(searchQuery)) {
        matches.push(node);
      }
    }

    let count = 0;

    for (const textNode of matches) {
      const frag = document.createDocumentFragment();
      const original = textNode.textContent;
      const haystack = settings.caseSensitive ? original : original.toLowerCase();
      let cursor = 0;
      let searchFrom = 0;

      while (cursor < original.length) {
        const idx = haystack.indexOf(searchQuery, searchFrom);
        if (idx === -1) {
          frag.appendChild(document.createTextNode(original.slice(cursor)));
          break;
        }
        if (settings.wholeWord && !isWholeWordMatch(haystack, idx, searchQuery.length)) {
          searchFrom = idx + 1;
          continue;
        }
        if (idx > cursor) {
          frag.appendChild(document.createTextNode(original.slice(cursor, idx)));
        }
        const mark = document.createElement("mark");
        mark.className = "sh-highlight-match";
        mark.style.backgroundColor = settings.color;
        mark.textContent = original.slice(idx, idx + searchQuery.length);
        frag.appendChild(mark);
        fallbackMarks.push(mark);
        cursor = idx + searchQuery.length;
        searchFrom = cursor;
        count++;
      }

      textNode.parentNode.replaceChild(frag, textNode);
    }

    return count;
  }

  // ── Badge with match count ──
  function updateBadge(count, activeIdx) {
    try {
      chrome.runtime.sendMessage({
        type: "updateBadge",
        count: count,
        activeIndex: activeIdx ?? -1,
      });
    } catch (e) {
      // extension context invalidated
    }
  }

  // ── Scrollbar markers ──
  function showScrollbarMarkers(query) {
    removeScrollbarMarkers();

    const searchQuery = settings.caseSensitive ? query : query.toLowerCase();
    const docHeight = document.documentElement.scrollHeight;
    if (docHeight <= window.innerHeight) return;

    const positions = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT
    );

    let node;
    while ((node = walker.nextNode())) {
      const tag = node.parentElement?.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") continue;

      const text = settings.caseSensitive
        ? node.textContent
        : node.textContent.toLowerCase();

      if (text.includes(searchQuery)) {
        // Check wholeWord for scrollbar markers
        if (settings.wholeWord) {
          let found = false;
          let sPos = 0;
          while ((sPos = text.indexOf(searchQuery, sPos)) !== -1) {
            if (isWholeWordMatch(text, sPos, searchQuery.length)) {
              found = true;
              break;
            }
            sPos += 1;
          }
          if (!found) continue;
        }
        try {
          const range = document.createRange();
          range.selectNodeContents(node);
          const rect = range.getBoundingClientRect();
          const absY = rect.top + window.scrollY;
          positions.push(absY / docHeight);
        } catch (e) {
          // skip
        }
      }

      if (positions.length >= MAX_SCROLLBAR_MARKERS) break;
    }

    if (positions.length === 0) return;

    scrollbarTrack = document.createElement("div");
    scrollbarTrack.className = "sh-scrollbar-track";
    scrollbarTrack.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 14px;
      height: 100vh;
      z-index: 2147483647;
      pointer-events: none;
    `;

    // Deduplicate
    const unique = [];
    const sorted = positions.sort((a, b) => a - b);
    for (const p of sorted) {
      if (unique.length === 0 || p - unique[unique.length - 1] > 0.005) {
        unique.push(p);
      }
    }

    for (let i = 0; i < unique.length; i++) {
      const marker = document.createElement("div");
      marker.dataset.markerIndex = i;
      marker.style.cssText = `
        position: absolute;
        top: ${unique[i] * 100}%;
        right: 1px;
        width: 12px;
        height: 4px;
        background: ${settings.color};
        border: 1px solid ${settings.borderColor};
        border-radius: 1px;
        opacity: 0.85;
        transition: opacity 0.15s;
      `;
      scrollbarTrack.appendChild(marker);
    }

    document.body.appendChild(scrollbarTrack);
  }

  function updateActiveScrollbarMarker() {
    if (!scrollbarTrack) return;
    const markers = scrollbarTrack.children;
    for (const m of markers) {
      m.style.opacity = "0.85";
      m.style.height = "4px";
    }
    // Highlight marker closest to active match
    if (currentIndex >= 0) {
      const total = navItems.length;
      // Approximate marker index (markers are deduplicated)
      const ratio = currentIndex / total;
      const markerIdx = Math.min(
        Math.round(ratio * markers.length),
        markers.length - 1
      );
      if (markers[markerIdx]) {
        markers[markerIdx].style.opacity = "1";
        markers[markerIdx].style.height = "6px";
      }
    }
  }

  function removeScrollbarMarkers() {
    if (scrollbarTrack) {
      scrollbarTrack.remove();
      scrollbarTrack = null;
    }
  }

  // ── Clear highlights ──
  function clearHighlights() {
    if (supportsHighlightAPI) {
      CSS.highlights.delete("selection-matches");
      CSS.highlights.delete("selection-current");
    } else {
      for (const mark of fallbackMarks) {
        const parent = mark.parentNode;
        if (!parent) continue;
        parent.replaceChild(document.createTextNode(mark.textContent), mark);
        parent.normalize();
      }
      fallbackMarks = [];
    }
    currentRanges = [];
    currentIndex = -1;
    matchingInputEls = [];
    navItems = [];
    clearInputHighlights();
    removeInputBanner();
    removeScrollbarMarkers();
    updateBadge(0);
  }

  // ── Debounced listener ──
  let timer = null;
  document.addEventListener("selectionchange", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      let text = window.getSelection()?.toString() || "";
      if (!text) {
        const active = document.activeElement;
        if (active && (active.tagName === "TEXTAREA" ||
            (active.tagName === "INPUT" && TEXT_INPUT_TYPES.has((active.getAttribute("type") || "").toLowerCase())))) {
          const start = active.selectionStart;
          const end = active.selectionEnd;
          if (start !== null && end !== null && start !== end) {
            text = active.value.slice(start, end);
          }
        }
      }
      highlightMatches(text);
    }, DEBOUNCE_MS);
  });
})();
