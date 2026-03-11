# Selection Highlighter

Chrome extension that instantly highlights all occurrences of selected text on the page.

Uses [CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API) — no DOM mutations, no `<mark>` wrappers, just native browser rendering on top of existing text nodes. Falls back to `<mark>` for older browsers.

## How it works

1. Listen to `selectionchange` event (mouse, keyboard, double-click, Ctrl+A — anything)
2. Walk all text nodes via `TreeWalker`
3. Create `Range` objects for each match
4. Register them as `CSS.highlights` — browser paints the background, DOM stays untouched

### Input field awareness

Text inside `<input>` and `<textarea>` elements lives in `.value`, not as DOM text nodes, so the CSS Custom Highlight API cannot paint highlights inside them. The extension works around this by:

- **Counting** matches in visible text-like input fields (text, search, url, email, tel) and adding them to the badge total
- **Showing a banner** at the bottom of the page when input matches exist, so you know they're there even though they can't be highlighted inline
- **Optionally outlining** matching fields with a colored ring (box-shadow) to visually indicate which fields contain the selected text

Selecting text inside an input or textarea also works — `window.getSelection()` returns empty for these elements, so the extension reads `selectionStart`/`selectionEnd` from the active element as a fallback.

## Features

- **Instant highlighting** — all occurrences appear as you select
- **Navigation** — `Ctrl+↓` / `Ctrl+↑` to jump between matches, active match is visually distinct
- **Match counter** — badge on the extension icon shows total matches, including input fields (or `3/42` when navigating)
- **Scrollbar markers** — tick marks on the right edge showing where matches are on the page
- **Input field detection** — matches inside form fields are counted and reported via an info banner
- **Input field highlighting** — optional colored ring around inputs/textareas that contain matches
- **Whole word match** — optional, to avoid partial matches (e.g. "test" won't match "testing")
- **Case sensitive** — optional toggle
- **Custom highlight color** — any color via picker
- **Custom border color** — for scrollbar markers, with a button to sync it to the highlight color
- **Min selection length** — skip selections shorter than N characters
- **Reset defaults** — one click to restore all settings

## Settings

Click the extension icon to configure. Settings sync across devices via `chrome.storage.sync`.

| Setting | Default | Description |
|---------|---------|-------------|
| Min length | 2 | Minimum selection length to trigger highlighting |
| Highlight color | `#ffeb3b` | Background color for matches |
| Marker border | `#000000` | Border color for scrollbar tick marks |
| Case sensitive | off | Match exact case |
| Whole word | off | Skip partial matches |
| Input highlights | off | Show a colored ring around input/textarea fields containing matches |
| Input banner | on | Show a notification bar when matches exist in input fields |

## Install

```
git clone https://github.com/<you>/selection-highlighter.git
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the cloned folder

## License

MIT
