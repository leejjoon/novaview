# Future Work

## Remove custom title bar workaround once Tauri/WebKitGTK fixes fractional scaling

### Background

On Linux with Wayland and a fractional display scaling factor (e.g. 150%), WebKitGTK
reports `devicePixelRatio = 2` (integer, rounded up) instead of the true 1.5. After a
window resize, the Wayland compositor's coordinate mapping between the window buffer and
the WebView content area becomes incorrect. The result is that mouse-drag events inside
the WebView are delivered at roughly half the expected speed — the sky survey image moves
only half as far as the cursor.

The bug does **not** reproduce in a regular web browser, nor at 100% display scaling, nor
in fullscreen mode.

Setting `WEBKIT_DISABLE_COMPOSITING_MODE=1` partially fixes the issue (fullscreen works)
but not when the window has native decorations (title bar). The remaining offset is caused
by Server-Side Decorations (SSD): the Wayland compositor draws the title bar in a
separate buffer, creating a coordinate offset between the window buffer origin and the
WebView content origin that WebKitGTK does not account for correctly under fractional
scaling.

### Current workaround (as of 2026-03)

`"decorations": false` is set in `src-tauri/tauri.conf.json`, which disables the native
title bar. This makes the WebView fill the entire window surface (identical to fullscreen)
and eliminates the decoration-induced coordinate offset.

To compensate for the missing title bar, a custom HTML title bar was added:

- `index.html`: `<header>` element carries `data-tauri-drag-region` and explicit
  minimize / maximize / close buttons (`#btn-minimize`, `#btn-maximize`, `#btn-close`).
- `src/main.ts`: `getCurrentWindow()` from `@tauri-apps/api/window` is used to wire up
  the buttons, and an explicit `mousedown → appWindow.startDragging()` handler is added
  for reliable drag-to-move on Wayland.
- `src-tauri/capabilities/default.json`: `core:window:allow-minimize`,
  `core:window:allow-maximize`, `core:window:allow-unmaximize`,
  `core:window:allow-close`, and `core:window:allow-start-dragging` are added explicitly
  because they are not included in `core:window:default`.

### What to do when the upstream bug is fixed

The upstream issue is a WebKitGTK / Tauri bug in coordinate mapping under Wayland
fractional scaling with Server-Side Decorations. Track progress at:

- WebKitGTK bug tracker: fractional scaling + SSD mouse coordinate offset
- Tauri issue tracker: https://github.com/tauri-apps/tauri/issues (search for "wayland
  fractional scaling" or "mouse drag offset")

Once the bug is confirmed fixed in a WebKitGTK / Tauri release you are targeting,
revert the workaround as follows:

1. **`src-tauri/tauri.conf.json`** — remove `"decorations": false` (or set it to
   `true`) to restore native window decorations.

2. **`index.html`** — remove from `<header>`:
   - `data-tauri-drag-region` attribute (and from child elements)
   - `select-none` class
   - The `#window-controls` div and its three buttons (`#btn-minimize`, `#btn-maximize`,
     `#btn-close`)
   - Restore nav `<a>` tags to normal (remove the `onclick="return false;"` guards if
     they were added only to prevent focus-ring issues during drag).

3. **`src/main.ts`** — remove the entire `if (isTauri) { ... }` block that:
   - Shows `#window-controls`
   - Wires up minimize / maximize / close / `onResized` handlers
   - Adds the `mousedown → appWindow.startDragging()` listener on the header

4. **`src-tauri/capabilities/default.json`** — remove the five explicitly added
   permissions:
   - `core:window:allow-minimize`
   - `core:window:allow-maximize`
   - `core:window:allow-unmaximize`
   - `core:window:allow-close`
   - `core:window:allow-start-dragging`
   (keep `core:default` only, unless other features need additional permissions)

5. Verify that mouse drag inside the Aladin viewer works correctly at 150% (and other
   fractional) display scaling after a window resize, both in a small window and in
   fullscreen.
