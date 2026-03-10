# Selection Highlighter

Chrome extension that instantly highlights all occurrences of selected text on the page.

Uses [CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API) — no DOM mutations, no `<mark>` wrappers, just native browser rendering on top of existing text nodes. Falls back to `<mark>` for older browsers.

## How it works

1. Listen to `selectionchange` event (mouse, keyboard, double-click, Ctrl+A — anything)
2. Walk all text nodes via `TreeWalker`
3. Create `Range` objects for each match
4. Register them as `CSS.highlights` — browser paints the background, DOM stays untouched

## Features

- **Instant highlighting** — all occurrences appear as you select
- **Navigation** — `Ctrl+↓` / `Ctrl+↑` to jump between matches, active match is visually distinct
- **Match counter** — badge on the extension icon shows total matches (or `3/42` when navigating)
- **Scrollbar markers** — tick marks on the right edge showing where matches are on the page
- **Whole word match** — optional, to avoid partial matches (e.g. "test" won't match "testing")
- **Case sensitive** — optional toggle
- **Custom highlight color** — any color via picker
- **Custom border color** — for scrollbar markers, with a button to sync it to the highlight color
- **Min selection length** — skip selections shorter than N characters
- **Reset defaults** — one click to restore all settings

## Settings

Click the extension icon to configure. Settings sync across devices via `chrome.storage.sync`.

## Install

```
git clone https://github.com/<you>/selection-highlighter.git
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the cloned folder

## License

MIT
