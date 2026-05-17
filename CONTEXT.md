# Prompt Gen — Project Context
*This file is the living memory of this project. Read it at the start of every session. Rewrite/update it at the end of every session with anything new learned or decided. Don't just add bullet points — preserve the WHY behind decisions.*

**END-OF-SESSION CHECKLIST — do this before wrapping up every session:**
1. Update this file (CONTEXT.md) with everything shipped, decided, or learned
2. Update ROADMAP.md — mark completed items, add new ideas
3. Update the test checklist memory (`project_test_checklist.md`) — add new untested items, move confirmed items to tested
4. Update any other memory files that are now stale
5. Add a "Recently shipped (session N)" block to the section below with enough detail that the next session understands what changed
6. Take screenshots of each tab/section and save to `screenshots/` folder — Claude Design uses these as visual reference. Open the app, cycle through all tabs (Generate, LoRAs, Gallery, Checkpoints, Settings), capture current state. Commit alongside code changes.

---

## What this app is and who it's for

Daniel uses ComfyUI as a hobby on an M4 Pro MacBook (48GB unified memory). He creates AI-generated artwork with a dark surreal aesthetic — predominantly male figures, supernatural elements, body horror, graphic design collisions. His creative background includes Photoshop, Illustrator, and Painter. Design influences include Designers Republic and modern Marvel comic artists.

**He has aphantasia** — he cannot visualize things mentally. This is not a limitation, it's core to understanding his workflow. He generates images, reacts to what appears, adjusts, and generates again. The app should support iterative reactive workflows, not "plan then execute" ones.

He works primarily with Illustrious, Pony, and SDXL diffusion models, with a large LoRA collection weighted heavily toward Illustrious.

The app started as a simple tag clicker for building prompts. It has evolved into a full LoRA management and prompt assembly tool. The tag clicking is still there but Daniel rarely uses it — the LoRA browser is the core now.

---

## Current state of the app

**Files live at:** `~/Tools/ComfyUI/_tools/`
**Electron app at:** `~/Tools/ComfyUI/electron-app/` → packaged to `/Applications/Prompt Gen.app`
**Accessed via:** `http://127.0.0.1:3000/comfy-prompt-gen.html` (served by Node.js server inside Electron)

**Core files:**
- `comfy-prompt-gen.html` — all CSS and HTML structure
- `app.js` — all JavaScript (was split from HTML due to Safari 65KB inline script limit)
- `electron-app/server.js` — Node.js HTTP server (replaced Python proxy.py in session 7), serves files, proxies LoRA Manager + ComfyUI APIs, gallery operations, WebSocket proxy
- `electron-app/main.js` — Electron main process: window, tray, ComfyUI auto-launch, IPC
- `electron-app/preload.js` — IPC bridge for renderer → main communication (tray progress)

**Data persistence:** `app-data.json` in `_tools/` folder, read/written by the app via `/app-data` endpoint on server.js.

**Key appData structure** (consolidated in session 8 — all per-LoRA data lives under `loraData[filename]`):
```
appData = {
  loraData: { [filename]: { strength, cfg, steps, sampler, checkpoint, prefix, suffix,
              notes, triggers, overrides, name, image, status, favorite, adult } },
  loraCols: [ { id, label, keys: [filenames] } ],
  loraColBrut: { [colId]: true },
  deletedBuiltins: { [catId]: [tagNames] },
  customTags: { [catId]: [tagNames] },
  tagOrder: { [catId]: [tagNames] },
  catOrder: [catIds],
  checkpointNotes: { [filename]: { cfg, steps, sampler, clip, notes, displayName } },
  history: [ { pos, neg, time } ],
  presets: [ { name, id, model, subject, tags, weights, loras } ],
  galleryState: { [filename]: 'review'|'approved'|'declined' },
  galleryCats: [ { id, label, color, keys: [filenames] } ],
  galleryTags: { [filename]: ['tag1', 'tag2', ...] },
  galleryAdult: { [filename]: true },
  galleryTiming: { [filename]: durationInSeconds },
  galleryAutoTagged: { [filename]: true },
  embeddings: [ { name, target: 'pos'|'neg', active } ],
  settings: { lastSend, hiddenTabs, hideBrut, ... },
}
```

---

## Architecture decisions and why

**Why server.js exists (replaced proxy.py in session 7):**
The app is served as a local web page. Browsers block cross-origin requests, so app.js can't directly call LoRA Manager's API (port 8000) or ComfyUI from `http://127.0.0.1:3000`. server.js runs inside Electron's main process on port 3000, serves the HTML/JS/CSS, and forwards API calls. It also handles the WebSocket proxy (ComfyUI Desktop rejects browser WS connections due to origin checking — server.js proxies `ws://localhost:3000/ws` → `ws://localhost:8000/ws` from a Node.js context where there are no CORS restrictions).

**Why app.js is a separate file:**
Safari has a ~65KB limit on inline JavaScript. When the script exceeded this, Safari silently failed with no console errors and the app just didn't work. Splitting into a separate `app.js` file served by the server solved it. This was a painful debugging session.

**Why the panel replaced the popup:**
The original LoRA detail was a floating popup (lpopup). As we added more fields (prefix, suffix, triggers, settings, status, etc.) it got too cramped. Evolved into a 600px slide-in panel from the right side. The panel overlays the content rather than shifting it (user preference).

**Why preload.js exists:**
Electron runs with `contextIsolation: true` and `nodeIntegration: false` for security. The renderer (app.js) can't access Node.js or Electron APIs directly. preload.js uses `contextBridge.exposeInMainWorld` to expose a `window.promptGen` object with safe IPC methods (currently just `updateTrayProgress`). This is the bridge for renderer → main process communication.

**Why sl() exists and its limitation:**
`sl(str)` converts filenames to safe CSS IDs by replacing non-alphanumeric chars with underscores. The problem: it's lossy. `my.lora` and `my_lora` both become `my_lora`. This caused a long-running drag-to-reorder bug where we couldn't reverse the ID back to the original filename. Fixed by adding `data-key` attributes with the real filename to card elements.

**Why edit mode exists on the panel:**
Initially the panel always showed Save/Discard buttons. Daniel felt like he was always in an editing state even when just viewing. Added a view/edit mode toggle — panel opens in view mode (fields readonly, copy on click), Edit button unlocks everything.

---

## The LoRA browser — current features

- **Card view** with preview images (object-fit: cover, top-aligned)
- **Collections** — user-created groups, cards draggable within collections
- **Status badges** on cards: ✓ Verified (green), 🧪 Testing (amber), 👎 Bad (red) — top left corner of image
- **Fav star** — top right of image, gold with glow when active
- **Adult 🍆 badge** — top right, shifts left if fav star present
- **P badge** — bottom left corner of card image, shows when LoRA has prompt data saved
- **Type border colors** on cards: Character=cyan, Style=purple, Clothing=pink, Pose=green, Concept=orange, default=very subtle
- **Enable button** on each card — only way to activate, clicking card body does NOT enable
- **Triggers button** — copies trigger words
- **Info button** — opens detail panel
- **Context menu** on right-click: Enable, Favorite, Info, Verified/Testing/Bad status, Adult
- **Search** — searches name, folder, and saved notes
- **Filters** — All/Favs, Verified filter cycle, Adult toggle (pink border when active)
- **Sticky toolbar** in tab bar with all filters + search (wider on wide monitors, wraps on portrait)

**Detail panel fields:**
- Name (with inline rename via pencil icon)
- Type badge, status badge, CivitAI link, filename (click to copy)
- Image (160px, click to lightbox) with status/fav/adult badges overlaid
- Default strength slider (auto-sets when LoRA activated)
- CFG, Steps, Sampler, Best Checkpoint
- Trigger words (click to copy in view mode)
- Prompt prefix (click to copy)
- Prompt suffix (click to copy)  
- Notes (click to copy)
- Status buttons: Verified / Testing / Bad
- Show on models checkboxes

**Edit mode:** Panel opens in view mode. Click "✎ Edit" to unlock all fields. Footer shows Close in view mode, Save/Discard in edit mode.

**Known bugs / watch items:**
- Potential auto-approve bug (unconfirmed, 2026-05-05): images generated via remix from an approved image may occasionally be auto-approved. Intermittent — Daniel saw it once then it stopped. Check: where ComfyUI saves outputs, whether patchGalleryCard is inheriting state from source image filename, whether appData.galleryState has entries matching newly generated filenames.

**Backlog:**
- **Per-LoRA weight override on active LoRAs** — right-click a LoRA trigger chip (in the right panel) to set a one-off weight for this generation, without changing the LoRA's saved default. Currently you have to disable → change default → re-enable, which breaks flow.

**Recently shipped (Claude Code session 29 — Wave 4: Video Generation):**
- **Video sub-tab in Generate** — Image|Video toggle buttons below the main tabs. Switching to Video hides the LoRA panel, tag categories, subject/xneg textareas, and image send config. Shows video-specific UI instead. Mode persists in localStorage across reloads.
- **Video prompt area** — full-width textarea with motion-oriented placeholder. Separate from the image Subject field.
- **Motion hint chips** — 14 clickable chips (slow motion, timelapse, camera pan left/right, push forward, pull back, dolly zoom, handheld, orbit, tilt up, static, aerial, close-up, wide shot) that insert motion/camera terms into the video prompt.
- **Image-to-video drop zone** — placeholder UI for future i2v support. Not wired yet.
- **Video negative prompt** — optional textarea for negative terms.
- **Video send config panel** — right panel shows: Video Model dropdown (Wan 2.2 5B TI2V), W/H row, Frames/FPS row (with live "X frames = ~Ys at Zfps" info text), Steps/CFG row, Seed row with dice + lock buttons. All fields have `oninput` wired to `updateSendMeta()` for live footer updates. Default: 832x480, 81 frames, 16fps, 40 steps, CFG 6.
- **Video seed lock** — mirrors image tab's seed lock pattern. `toggleVideoSeedLock()` / `isVideoSeedLocked()` / `restoreVideoSeedLock()`. Persists in localStorage. Orange locked state with closed shackle SVG icon. If unlocked, `sendVideoToComfy()` randomizes seed before sending.
- **`buildVideoWorkflow(opts)`** — constructs the complete Wan 2.2 node graph as ComfyUI API JSON: UNETLoader → ModelSamplingSD3 (shift:8.0) → KSampler, CLIPLoader (type:'wan') → CLIPTextEncode (pos+neg), VAELoader → Wan22ImageToVideoLatent + VAEDecode, CreateVideo → SaveVideo. Uses euler sampler + simple scheduler (uni_pc is broken on MPS/Apple Silicon).
- **`sendVideoToComfy()`** — reads all video UI fields, builds workflow via `buildVideoWorkflow`, POSTs to `/comfy/prompt`, shows toast with queue position and seed. Send button changes to "→ Generate Video" in video mode.
- **Queue indicator self-heal** — `pollQueueOnce()` now checks: if WS thinks we're generating but the ComfyUI API says queue is empty, reset the stuck state (progress bar, pill text, tray progress). Fixes the indicator getting permanently stuck at "generating · 83%" during long video generations when the WebSocket connection drops.
- **Wan 2.2 5B model setup** — downloaded and configured: `wan2.2_ti2v_5B_fp16.safetensors` (diffusion model), `umt5_xxl_fp16.safetensors` (text encoder), `wan2.2_vae.safetensors` (VAE). All in ComfyUI `models/` subdirectories. Successfully generated video from both ComfyUI directly and from the app.
- **Mac/MPS gotchas discovered** — FP8 models don't work on MPS (use fp16 or GGUF). `uni_pc` sampler crashes with `linalg_solve_ex` error on Apple Silicon (use `euler` instead). Video gen is extremely memory-intensive — close other apps, don't let Mac sleep.
- **No rebuild needed** — all changes are in app.js and comfy-prompt-gen.html (served live from `_tools/`).

**Recently shipped (Claude Code session 28 — auto-tagging + denoise UX):**
- **Auto-tagging from metadata** — when a generation completes OR when viewing an image's detail panel, PNG metadata is parsed and checkpoint/LoRA names are added as gallery tags automatically. Gated on quality: LoRAs only tagged if Cleaned flag is set, checkpoints only tagged if `displayName` is set. Tracked in `appData.galleryAutoTagged` to avoid re-adding user-removed tags. One-time migration (`_autoTagV2`) clears old tags for re-processing with display names.
- **Denoise zone labels** — replaced "subtle"/"heavy" endpoint hints with three zone markers under the slider: "refine" / "remix" / "reimagine". Much more informative for understanding what each range does.
- **Denoise hover tooltip** — `?` icon next to denoise value, hover shows a fixed-position tooltip explaining what each zone means (Refine 0.1–0.4, Remix 0.5–0.7, Reimagine 0.8–1.0). Tooltip is a body-level element positioned via JS to avoid stacking context issues.
- **`--cyan` CSS variable** — was used in code but never defined. Added to both dark (`#67e8f9`) and light (`#0891b2`) palettes.
- **No rebuild needed** — all changes are in app.js and comfy-prompt-gen.html (served live from `_tools/`).

**Recently shipped (Claude Code session 27 — generation timing + img2img + gallery dedup):**
- **Generation timing** — tracks duration via WebSocket (start on first `executing`, stop on completion). Stored in `appData.galleryTiming[filename]`. Displayed as ⏱ badge in gallery detail header + Time row in metadata params grid. Survives renames.
- **img2img** — use a gallery image as a starting point. img2img button on gallery detail loads remix data + sets source image. Cyan strip in Generate tab with thumbnail, denoise slider (default 0.75), clear button. Server uploads gallery image directly to ComfyUI input folder via `/comfy/upload-gallery` (no browser round-trip). Workflow swaps `EmptyLatentImage` for `LoadImage` → `VAEEncode`, KSampler uses slider denoise. Process button shows ⟳ prefix when active.
- **Gallery duplicate filename fix** — auto-rename with timestamp suffix when listing gallery files that collide across `output/` and `approved/` folders. Fixes selection, compare, and state bugs from filename collisions.
- **Confirmation button color fix** — `var(--cyan)` was too light as button background. Changed to `#0e7490` (darker cyan-700).
- **Requires rebuild** — server.js changed (`/comfy/upload-gallery` endpoint + gallery dedup). Must `rm -rf dist` before rebuild to clear electron-builder's asar cache.

**Recently shipped (Claude Code session 26 — queue panel + dude button + auto-neg):**
- **Queue management panel** — floating vertical panel slides out left of right panel. Shows running + pending jobs with checkpoint display names, per-job cancel, auto-refreshes on WS events. "queue" button in queue strip toggles it.
- **♂ dude button** — toggle in Generate tab that injects "1boy, male focus, solo" tags into prompts. Configurable tag list in Settings. Pill sync with tag chips.
- **Auto-select negative tags** — configurable list of tags auto-activated on launch. Settings checkboxes for each negative tag. Custom tag support.
- **Requires rebuild** — server.js changed.

**Recently shipped (Claude Code session 25 — gallery age badges + state toggle):**
- **Unreviewed age ribbons** on gallery cards — diagonal corner ribbon in top-right showing age ("7d", "2w", "1m"). Amber for 7–13 days, red for 14+ days. Only appears on unreviewed images. `galleryAgeDays()` + `galleryAgeLabel()` helpers. CSS: `.gage-ribbon`, `.gage-warn`, `.gage-urgent`.
- **Gallery tab badge** — `⏱N` count (amber) next to "Gallery" tab label when old unreviewed images exist. Updates both at init (via `checkGalleryBacklog()` fetch) and on gallery render (via `updateGalleryFilterCounts()`).
- **Backlog toast** — amber "Gallery backlog" toast fires once on app launch (5s delay to avoid ComfyUI auto-launch covering it). `_backlogToastShown` flag prevents repeat. New `.toast.warn` CSS type.
- **Gallery state toggle behavior** — both context menu and detail panel now work identically: all three state buttons (Approve/Review/Decline) always visible, clicking an active state undoes it. Active state shown with ✓ suffix + bold (context menu) or filled background tint (panel). Review button no longer doubles as "Undo Decline" — each button toggles its own state only.
- **Un-approve** — new `/gallery/unapprove` server endpoint moves files from approved → raw. Called when toggling off an approved state. `/gallery/approve` endpoint now also checks the approved folder first (handles case where file was already there from a previous approve, e.g. after decline→approve).
- **`patchGalleryCard` updated** — now adds/removes age ribbons when card state changes, not just border color.
- **`.gdp-btn.gdp-active` CSS reworked** — was `opacity:.4;pointer-events:none` (disabled look). Now uses per-type filled background tint (green/amber/red) matching compare mode style. Buttons stay clickable for toggle.
- **Requires rebuild** — server.js changed (unapprove endpoint + approve fix).

**Recently shipped (Claude Code session 24 — queue stop/clear buttons):**
- **■ stop button** in queue bar — calls `POST /comfy/interrupt` to abort the currently running generation. Sits between progress bar and "recent ▴" toggle.
- **✕ clear button** in queue bar — calls `POST /comfy/queue/clear` (proxied to `POST /queue {"clear":true}` on ComfyUI) to flush all pending items. Use stop first, then clear to nuke everything.
- Both buttons turn red on hover (`.queue-ctrl-btn:hover { border-color/color: #f87171 }`). Always visible — useful even when idle to clear zombie state after a bad session.
- **Two new server.js proxy routes**: `POST /comfy/interrupt` → ComfyUI `/interrupt`; `POST /comfy/queue/clear` → ComfyUI `/queue` with `{"clear":true}` body.
- **Requires rebuild** — server.js changed.
- **Why**: ComfyUI Desktop's Python backend keeps running when the window is closed/hidden, not fully quit. "Restarting" ComfyUI often just reconnects the Electron UI to the same dirty server. Queue/model state persists, causing pink garbage output. These buttons let Daniel clear the pipes in seconds without going into ComfyUI or using curl. Full quit+relaunch still the gold standard for model cache corruption, but this handles the queue state immediately.

**Recently shipped (Claude Code session 18 — LoRA tab redesign + demo mode):**
- **LoRA card overlay redesign (Card Style A from Claude Design)**: full 2:3 `aspect-ratio` cards. Image fills card via `position:absolute;inset:0`. Gradient overlay at bottom. Name/type label/Enable/i buttons live inside the gradient. Triggers button removed (no longer needed since trigger chip system). Status badge top-left, fav star top-right, adult badge, P badge.
- **Type border colors**: character=cyan, style=purple, clothing=pink, pose=green, concept=orange (30% opacity, 60% on hover). Active LoRA always overrides to orange glow. Adult/brut card gets purple border (highest specificity).
- **Tabbed detail panel**: Overview / Notes / Settings tabs. Slides in from right, `border-radius: 12px 0 0 12px`. Overview has 2-col layout (140px thumbnail | status buttons + strength slider + triggers). Notes has prefix+suffix side by side + full-width notes. Settings has CFG/steps/sampler/checkpoint/models.
- **Sidebar**: `border-radius: 0 12px 12px 0` (floating right-edge look).
- **Critical fix during implementation**: The `onerror` attribute on `<img>` had `\"` inside a double-quoted HTML attribute (`onerror="...class=\"name\"..."`). HTML parser closes the attribute at the first `"`, spilling `</div>` as real content that closes the card div prematurely. Every card after the first fell outside the grid and rendered full-width. Fix: use unquoted class value in onerror (`class=lora-card-img-placeholder` — single class name, no quotes needed).
- **--radius was undefined**: `var(--radius)` not in `:root`. Other app CSS uses explicit px values. Fixed by hardcoding `10px` on `.lora-card`.
- **Demo mode (hideBrut setting)**: Settings → LoRAs section → "Brut / Adult Content" dropdown. Set to "Hidden" to: hide all ⍜ Brut toolbar buttons, hide adult-flagged LoRAs from grid, hide adult badges on cards, hide Brut context menu items and detail panel button. CSS via `body.hide-brut` class. Setting persists in `appData.settings.hideBrut`. Applied on startup via `applyBrutSetting()` called in `init()`.
- **Do not repeat**: `\"` inside a double-quoted HTML attribute is a parse error — use single-quoted or unquoted values inside `onerror`/`onclick` string attributes. When embedding HTML in onerror, never use `\\\"` to try to include double-quotes — they will break the outer attribute.

**Recently shipped (Claude Code session 17 — right panel polish, gallery multiselect, remix fixes, queue count, category management):**
- **Right panel strip reorder + visual cleanup**: Queue → Recent → LoRAs order. All strip backgrounds transparent. QUEUE/RECENT/LORAS labels in `var(--text)`. Sidebar HR full-width. Separator below categories removed.
- **Auto-lock seed on remix**: `setSeedLocked(true)` called in `applyRemixToSendPanel` when metadata contains a seed.
- **Extra neg auto-clear**: `extraNeg` restore block removed from `loadAppData` — box always empty on reload.
- **Strength slider auto-confirm**: `onchange="applyWeight()"` on range input; Apply button removed.
- **LoRA remove button in Generate panel**: ✕ in each trigger chip block calls `disableLoraFromPanel()`, strips prefix/suffix/triggers from subject-input before removing.
- **Prefix/suffix cleanup on LoRA remove AND on remix**: strips LoRA's prefix/suffix from subject-input in both `disableLoraFromPanel` and `doRemixFromGallery` (so they never double-print).
- **Copy image to clipboard**: right-click → "⎘ Copy Image" on thumbnails and detail panel image. ClipboardItem API + toast.
- **Queue strip**: progress bar at `bottom:-3px` 2px tall, sits on separator without taking space. "Queue · N" count label. Toast always at `right:438px`, 3.5s ok / 8s err.
- **Queue count fix**: debounced (150ms) fetch from `/comfy/queue` API replaces WS-message composition — authoritative `running+pending`, no race conditions.
- **Gallery multiselect**: Cmd/Ctrl/Shift+click enter select mode. Bulk bar and context menu actions apply to all selected, then `exitGallerySelectMode()`. `_galleryLastClicked` tracks Shift range anchor.
- **Remix LoRA UI fix**: `doRemixFromGallery` now calls `updateLoraStats()` (fixes "0 active" badge), `closeGalleryDetail()`, and `switchTab('tags')` — user lands in remixed Generate state immediately.
- **Category management UX**: "Set Category" label added to context menu category section. Non-bulk `ctxGallerySetCat` now calls `renderGallery()` so grid updates immediately. Works for multiselect too.
- **Testing checklist**: `project_test_checklist.md` in memory tracks features awaiting confirmation.

**Recently shipped (Claude Code session 12 — v5 Generate tab redesign + tag weight/paren features):**
- **v5 Generate tab redesign landed** — full 3-column CSS Grid layout replacing the old 2-column + fixed footer system. Columns: `var(--sidebar-w-redesign) 1fr var(--panel-w)` = `220px 1fr 420px`. Both sidebar and right panel float as cards with `margin`, `border-radius`, `box-shadow` inside a flush `window-shell`. Main column is scrollable; panels are sticky height-100vh.
- **Grid vs. old layout-right compatibility** — `applyLayout()` in JS still writes `layout-right` class to `.app` from localStorage. This triggered `.app.layout-right .main{margin-right:420px}` which ate 420px of the 688px grid track, leaving a 268px dead zone. Fixed by adding `.app.layout-right .main{margin-right:0 !important}` in the redesign CSS block. The `layout-right` class is now effectively a no-op.
- **Compose area restructured** — sticky subject textarea only (above the fold); extra-neg and tag categories scroll below in `.compose-scroll`. Old `compose-grid` side-by-side layout hidden; xneg now sits in the scroll area as a full-width textarea.
- **Right panel restructured** — send-config (checkpoint/dims/sampler/seed) pulled OUT of `panel-body` and placed between it and `send-footer`, so it stays visible at the bottom regardless of trigger scroll.
- **Collapsed sidebar fixes**: `sidebar-bottom-wrap` hidden when collapsed (it had a stray `border-top` creating a phantom box), increased `padding-top` on collapsed `sidebar-top` for traffic light clearance, logo area simplified to centered toggle arrow with no border when collapsed.
- **Pony button** → `PN` (was 🐴 emoji). Edit buttons → `✏` / `✓` (was text "edit"/"done").
- **Category header collapse removed** — `onclick="toggleCatCollapse()"` stripped from `.theader` in `renderTagSections()`. Cursor changed from `pointer` to `default`. No more accidental collapses.
- **Right-click weight → textarea bug fixed** — `applyWeight()` was saving to `tagWeights` and calling `updateOutput()` but not updating the textarea text. Fixed by adding inline regex logic: tries `(tag:X.XX)` form, then bare `(tag)` form, then plain `tag` in comma list, and replaces with the new weighted form.
- **Paren wrap feature** — two ways to wrap an active tag in `( )` for SD emphasis without specifying a weight:
  - **Shift+click** on an active chip instantly toggles it
  - **Right-click → "( ) wrap" button** in the weight popup (purple tinted button, fills when active)
  - `parenWraps` object tracks state (session-only, same lifecycle as `tagWeights`)
  - `fmtTag()` emits bare `(tag)` for paren-wrapped tags; `refreshTag()` adds CSS class `paren-wrapped` which shows the parens via `::before`/`::after` pseudo-elements — chip displays as `(1boy)` not `1boy ()`
  - `removeTagFromField()` extended to strip weighted `(tag:X.XX)` OR bare `(tag)` forms, not just plain `tag`
  - Applying an explicit weight via slider automatically clears the paren state and updates textarea
  - Paren → weight transition bug fixed: `applyWeight()`'s regex now uses `(?::\d+(?:\.\d+)?)?` making the weight suffix optional, so `(tag)` is found and replaced correctly
- **Recent strip self-fetching** — `renderRecentStrip()` is now `async` and calls `/gallery/list?folder=raw` directly. No longer depends on Gallery tab having been visited — thumbnails update immediately any time the strip renders.
- **Hover preview + lightbox for recent thumbnails** — hovering a recent thumb shows a fixed-position 160px preview card; clicking opens a full lightbox overlay. Both implemented with new `showRecentPreview/hideRecentPreview/openRecentLightbox/closeRecentLightbox` functions. HTML elements `#recent-hover-preview` and `#recent-lightbox` added before `</body>`.
- **LoRA header strip** — removed `→ browse` link (no visual hint = confusing silent navigation). Removed `onclick="switchTab('loras')"` and `cursor:pointer` from `.lora-hdr` entirely.
- **Select dropdown chevron** — replaced browser-native arrow with custom SVG via `appearance:none` + `background-image` + `background-position:right 10px center`. Balanced spacing on both sides. Light mode gets a darker stroke variant.
- **Scrollbars hidden** on `.main` and `.sidebar-nav` via `::-webkit-scrollbar{display:none}` + `scrollbar-width:none`.

**Recently shipped (Claude Code session 11 — right-panel polish, gallery auto-poll):**
- **Gallery auto-poll** — 3s polling loop runs while the Gallery tab is active. Compares newest mtime from `/gallery/list?folder=raw` against the last seen value; if a newer file appears, calls `loadGallery()` to refresh. Clears the interval on `switchTab` away. Fixes "image finished generating but gallery didn't update" — works for both app-sent generations and ComfyUI runs kicked off directly.
- **Layout toggle button relocated** — was added to `lora-toolbar` and `gallery-toolbar`, but the footer (prompt area) only renders on the Tags tab, so the button was useless where it lived. Moved into `.out-actions` row next to Clear all, so it's right there with what it controls.
- **Right-panel layout bug fixes**:
  - **CSS selectors were silently dead**: `#footer` is a sibling of `.app`, not a child, so `.app.layout-right .footer {…}` never matched. Also explains why the original `display:none !important` from earlier in the codebase was a no-op. Fixed all layout-right rules to use `.app.layout-right ~ .footer .X` (sibling combinator).
  - **Panel leaking into non-Tags tabs**: initial fix used `display:flex !important`, which overrode `switchTab`'s inline `display:none`. Removed `!important` — inline styles win naturally over non-important CSS, so the panel only shows when `switchTab` clears the inline display (i.e. on Tags tab).
  - **Dead 420px gap on non-Tags tabs**: `.main` had `margin-right:420px` whenever `.app.layout-right` was set, regardless of whether the footer was visible. Scoped to `.app.layout-right:not(.footer-hidden) .main` so the main content reclaims the space when the panel is hidden.
- **Right-panel width + layout density**: 360 → 420px width. Pos/neg textarea min-height 80 → 60px, tw-box 60 → 44px. Action buttons more compact (font 11px, padding 4×6). Clear all is now `flex:0 0 auto` inline instead of taking a full row. Send-panel fields shrunk to 24px height with 10px font. Send button full width at 8px padding. All to fit the full prompt+send block without scrolling on Daniel's monitor.
- **Docs**: added a "Gallery tab — design direction notes" section to CONTEXT.md, capturing Daniel's workflow-based reframing of the gallery (triage/culling tool, not display surface) for the next Claude Design session. Includes the planned Compare mode (2 selected → split view).

**Recently shipped (Claude Code session 10 — Remix fixes, trigger chips, right-panel layout):**
- Fixed remix-lock: checkpoint dropdown was being force-restored to the remixed image's checkpoint on every `refreshSendCkpts()` call (module-state `_comfyRemixCkpt` was persisting). Now remix applies the checkpoint as a one-shot override via `applyRemixToSendPanel()` then the dropdown is freely changeable. Clear All also drops the "remix negative locked" indicator pill ✓
- Fixed Pony-vs-Illustrious model misdetection on remix: `doRemixFromGallery` was using `score_9 / score_8_up` as a "this is Pony" signal, but our own CONTEXT says those are shared quality tokens for BOTH Illustrious and Pony. New detection order: (1) actual checkpoint filename stem → match against `comfyCkpts` list → read its `base_model`; (2) LoRA intersection; (3) checkpoint name string heuristic; (4) SDXL fallback. Dropped the score_9 sniff entirely ✓
- **LoRA trigger chip system**: replaced the static readonly trigger-words box with a live interactive chip strip ✓
  - `*` prefix on a trigger word marks it as REQUIRED (auto-injects into the positive prompt when the LoRA is enabled). No prefix = OPTIONAL (shown as a clickable chip, click to toggle into the prompt).
  - Required chips render orange/pinned with a ★, non-interactive. Optional chips render dim by default, blue when active.
  - Parser is `parseTriggers(raw)` which splits on commas, strips leading `*`. State `activeTriggers[loraKey]` is a Set of which optional triggers are toggled on for each active LoRA.
  - `buildPos` now injects per-LoRA: prefix → required triggers → active optional triggers, in that order, right after the LoRA call. Prefix field still exists for "always-on" tokens the user doesn't want chip-toggleable.
  - `tw-box` changed from `<textarea readonly>` to `<div>` that contains the chips; `copyOut('tw')` now reads from `buildTriggers()` state-builder instead of the element value.
  - Multi-LoRA: when 2+ LoRAs are active, each gets a small label header above its chip row.
- **Auto-migration for single-trigger LoRAs**: runs on every `loadLoras()`. For each LoRA whose `triggers` field in `appData.loraData` is empty AND whose CivitAI `trainedWords` has exactly 1 entry, auto-populate `triggers` with `*<word>`. Idempotent — after the first run that LoRA's `triggers` field is set, so next run skips it. Catches both the existing 250+ library and any new LoRAs installed later (they get migrated on the next app load after install).
- **Bulk "★ all" / "all opt" buttons** in the LoRA detail panel's Trigger Words section (visible only in edit mode). Reads current triggers field (or falls back to CivitAI `trainedWords` if empty), rewrites every token with/without a leading `*`. User saves via the existing panel Save flow. Dramatically speeds up multi-trigger LoRA marking.
- **Right-side panel layout toggle** (completes the portrait-monitor UX backlog item):
  - Previously `.app.layout-right` existed but had `.footer{display:none !important}`, i.e. half-implemented.
  - Now the footer becomes a fixed-position 360px right column (position:fixed, top:0, right:0, bottom:0, height:100vh), with flexbox layout internally: lora-strip → out-grid (scrollable) → out-actions → send-row. Send panel's fields stretch to full width in this mode.
  - Toast stack shifts left to `right:378px` when layout-right is active so it doesn't overlap the panel.
  - Layout toggle button (`⬒`) added to both the LoRAs-tab and Gallery-tab toolbars (next to `⠿` drag handle). Preference persists in `localStorage['cpg-layout']`.
  - Trigger chips in the right panel have max-height 240px (vs 180px bottom bar) so they breathe more. Send button becomes full-width.
- **Send panel fields pre-filled from remix** now also works correctly because the model-detection fix means the dropdown is populated with the correct model family before the checkpoint override runs.

**Recently shipped (Claude Code session 9 — Send to ComfyUI):**
- Phase 3 DONE: direct ComfyUI API integration ✓
- Send panel below prompt output: checkpoint dropdown (filtered by model family), W×H, steps, CFG, sampler, scheduler, seed (blank = random per send, dice button for manual roll), orange Send button ✓
- Workflow JSON built from scratch every send — no reliance on user's ComfyUI saved workflow ✓
- Multi-LoRA: LoraLoader nodes chained dynamically (model→model, clip→clip) based on active LoRA count. Works for 0, 1, N LoRAs ✓
- Send panel defaults: persisted via `appData.settings.lastSend`; also loaded from first active LoRA's saved settings or template defaults (30/5/euler_ancestral/karras/896×1152) ✓
- Remix from gallery extended: now also populates checkpoint, seed, W/H, steps, CFG, sampler, scheduler in the Send panel — tweak and re-send ✓
- Checkpoint dropdown filtered against ComfyUI's `/object_info/CheckpointLoaderSimple` authoritative list — eliminates phantom checkpoints that LoRA Manager knows about but ComfyUI can't load ✓
- Same filter approach for LoRAs (via `/object_info/LoraLoader`) since ComfyUI expects path+ext names (`Kuroimori-ArtStyle.safetensors`) but LoRA Manager returns bare stems (`Kuroimori-ArtStyle`). Resolver matches by stem and sends the ComfyUI-native name ✓
- Custom checkpoint display names: rename pencil on each Checkpoint card, stored under `appData.checkpointNotes[filename].displayName`, used in both the Checkpoint tab and the Send dropdown ✓
- Toast notifications at top-right: Sent confirmation with queue depth + seed, or detailed node errors surfaced from ComfyUI's `node_errors` object. Manual × close + auto-dismiss (9s ok / 10s err) ✓
- New server endpoints: `/comfy/prompt` (POST, forwards to ComfyUI), `/comfy/queue` (GET), `/comfy/checkpoints` (GET, auth list), `/comfy/loras` (GET, auth list) ✓
- Fixed: ComfyUI Desktop serves its API on port 8000, NOT 8188. LoRA Manager is a ComfyUI custom node, so they share the same port ✓

**Recently fixed (Claude Code session 5 — Bulk actions, categories, Brut):**
- Bulk select mode: Select button toggles mode, click cards to select (blue highlight), shift+click for range select ✓
- Floating bulk action bar: Approve / Review / Decline N selected images ✓
- Process declined confirmation dialog (uses inline confirm, not native) ✓
- Card size toggle: Small/Large view (2x card size) ✓
- Gallery categories system: one category per image, mutually exclusive ✓
- Categories in sidebar with colored dots, counts, rename/delete on hover ✓
- Drag to reorder categories in sidebar ✓
- Sectioned view: "All Images" shows sections per category, specific category filters to flat grid ✓
- Category assignment: dropdown in detail panel + categories in right-click context menu ✓
- Category CRUD: create (auto-cycling colors), rename, delete (with confirm) ✓
- Brut (adult) filter system unified across LoRA + Gallery tabs ✓
- Replaced 🍆 emoji with `⍜` Unicode symbol — innocuous geometric icon matching ⊞ ☑ ↺ style ✓
- Brut toggle moved to sidebar bottom on both tabs (stats above, HR divider, button below) ✓
- Brut in gallery context menu with bold state indicator ✓
- Gallery adult state stored in appData.galleryAdult, filtered in both sectioned/flat views ✓
- Sidebar repurposed for gallery: model buttons + stats hidden, Small/Select/Reload controls shown ✓
- Collapsed sidebar: gallery icons (⊞ ☑ ↺ ⍜) replace model icons (XL 🐴 IL) ✓
- Selection color changed from orange to blue (avoids confusion with review/amber) ✓
- Context menu click-through fixed: clicking card while ctx menu open closes menu instead of opening detail ✓
- Drag handle (⠿) added to gallery toolbar for window dragging ✓
- Window bounds persistence fixed: app.getPath('userData') was called before app.whenReady(), bounds file never saved ✓
- Drag-over highlight added for .nitem sidebar items (was missing CSS for both LoRA + gallery) ✓

**Recently fixed (Claude Code session 4 — Gallery + packaging):**
- Prompt suffix box moved to right of prefix box, below notes. Notes row now same height as others. No scrolling needed in panel ✓
- Packaged Electron app as proper .app using electron-builder. Lives at electron-app/dist/mac-arm64/ and /Applications/Prompt Gen.app ✓
- App icon redesigned: `»` (double chevron) in orange #fb923c on near-black #0e0e0f, macOS rounded corners. Generated via Python/Pillow, lives at electron-app/icon.icns ✓
- When app is packaged, TOOLS_DIR uses absolute path ~/Tools/ComfyUI/_tools (app.isPackaged check in main.js) ✓
- Gallery tab built (Phase 1): thumbnail grid, slide-in detail panel, 4-state system ✓
- Gallery state system: unreviewed (no border), review (amber border), approved (green border), declined (red border) ✓
- Soft-delete for declined: files stay in view with red border until "🗑 Process X" button trashes them all ✓
- Approved images stay in gallery view (green border), move physically to ~/Tools/ComfyUI/approved/ ✓
- Filters: All / Unreviewed / Review / Approved / Declined with live counts ✓
- Right-click context menu on gallery cards: Approve / Mark Review / Decline ✓
- Lightbox: click image in detail panel to open fullscreen (reuses existing lp-lightbox) ✓
- Cards are 7:9 aspect ratio (matches 896x1152 generation size), object-position: top ✓
- State shown as colored border on card, not dot overlay ✓
- "Undo Decline" button in detail panel replaces "Mark Review" when image is declined ✓
- Context menu review label updates dynamically (Mark/Unmark/Undo based on current state) ✓

**Recently fixed (Claude Code session 1):**
- P badge repositioned to bottom-left corner of card image ✓
- 👎 Bad status icon updated from ✗ across the board ✓

**Recently fixed (Claude Code session 2):**
- Bad badge redesigned: white "D" on red background, matching visual weight of ✓ verified badge ✓
- Bad badge dark mode CSS fixed: was white bg/black text, now consistent red bg across both modes ✓
- Panel footer fixed: view mode now shows Close button, edit mode shows Discard/Save ✓
- Drag to reorder within collections fixed: root cause was renderLoraTab using allItems.filter() which preserves API order, not col.keys order. Fixed by mapping col.keys → lora objects so render respects the saved order. Also hardened key passing via dataTransfer and replaced sl() lookup with querySelector in cardDragStart ✓

**Recently fixed (Claude Code session 3 — Electron + polish):**
- Built full Electron app (electron-app/) with auto-started proxy, hiddenInset titlebar, traffic lights in sidebar ✓
- Fixed sidebar close bug on wide monitors (ResizeObserver triggering re-open; save state to localStorage) ✓
- Fixed Tags tab sidebar bug (same ResizeObserver) ✓
- Replaced window.prompt/confirm with inline dialog system (Electron blocks native dialogs) ✓
- Moved rename/delete buttons to sidebar hover (ncol-actions) ✓
- Removed "All LoRAs" nav item ✓
- Added drag handle (⠿ grip) before search box for window dragging ✓
- Added status/adult colored dots to context menu ✓
- Widened panel to 780px, 2-column scroll layout ✓
- Fixed broken LoRA preview images in Electron (proxy.py extended to cache /api/previews, return 404 for video/mp4) ✓
- Status badges now just colored dots (no icons) ✓
- Context menu: always show all 3 status dots, bold the active one (was using textContent which wiped span elements) ✓
- Scrollbar light mode fixed for .lp-scroll (was missing light mode overrides) ✓
- Panel layout reorganized: show-on-models moved to header settings column; new action row with status dots + fav + adult + edit below image area; scroll area simplified to just text fields ✓
- App icon created: dark rounded square, orange "PG" (Poppins Bold), three status dots, "prompt gen" subtitle. Lives at electron-app/icon.icns ✓

---

## Prompt assembly — current output order

```
[LoRA calls] [LoRA prefix tags] [required triggers] [active optional triggers] [global quality tokens] [subject] [clicked tags] [LoRA suffix tags] [pos embeddings]
Negative: [global negative tokens] [extra neg] [neg embeddings]
```

**Global quality tokens (Illustrious/Pony positive):**
`score_9, score_8_up, score_7_up, masterwork, masterpiece, highres, very aesthetic, absurdres, best quality, amazing quality, intricate details, perfect composition`

**Global quality tokens (Illustrious/Pony negative):**
`score_4, score_3, score_2, score_1, bad anatomy, bad fingers, worst quality, lowres, text, signature, watermark, artist name, web address, border`

SDXL gets no auto-tokens.

---

## Embeddings (shipped, session 23)

Daniel uses `lazypos` and `lazyneg` textual inversion embeddings. These are quality shortcuts — `lazypos` goes in positive prompt, `lazyneg` in negative. No weight control needed, just on/off.

Key insight from testing: they don't just "make things better," they shift the aesthetic toward more minimal/graphic/flat. Better for some LoRAs, not others. Daniel is still learning when to use them.

**Implementation:** On/off chips pinned to the bottom of the triggers section in the right panel via `margin-top:auto`. Each embedding has a `target` field (`pos` or `neg`) — `embedding:name` syntax injected into the appropriate prompt in `buildPos()` / `buildNeg()`. + button to add new embeddings (name + pos/neg selector), right-click to remove. State persisted in `appData.embeddings` array. `clearAll()` deactivates all. `initEmbeddings()` seeds lazypos/lazyneg on first run.

---

## Design principles

- **Daniel doesn't use bullet points in conversation, he types casually.** Match his energy.
- **Don't over-explain.** He's technically capable, just not a developer. Explain the what and why briefly, skip the obvious.
- **Dark theme is primary.** Light mode exists but is secondary.
- **Space Mono for monospace, Poppins for sans** (Poppins served locally from `_tools/fonts/` folder to avoid Google Fonts load delay).
- **Orange (#fb923c) is the accent color** for active LoRA states, prompt areas, etc.
- **The app should feel like a tool, not a toy.** Dense, functional, dark.
- **Syntax check before every ship.** `node --check app.js` — we have burned ourselves too many times shipping broken JS.
- **The recurring bug pattern:** When inserting a new function near another function declaration, the insertion accidentally eats the adjacent `function` keyword, leaving orphaned code that causes SyntaxError. Always verify with node --check.

---

## Electron — current state

**Project lives at:** `~/Tools/ComfyUI/electron-app/`
**Packaged app:** `/Applications/Prompt Gen.app`
**Dev mode:** `cd ~/Tools/ComfyUI/electron-app && npm start`
**Rebuild:** `cd ~/Tools/ComfyUI/electron-app && rm -rf dist && npm run build` then copy to `/Applications/`

**How it works:**
- `main.js` starts `server.js` (Node.js HTTP + WS server) on port 3000
- Opens a BrowserWindow loading `http://127.0.0.1:3000/comfy-prompt-gen.html`
- Auto-launches ComfyUI Desktop on startup if not already running, hides its window via AppleScript, polls port 8000 until models are loaded
- Tray icon (`»`) with status menu: ComfyUI start/stop/hide/show, window show/hide, dock toggle, settings, quit
- Tray title shows live generation progress (`45% | +2`) via IPC from renderer
- External links: CivitAI opens in Chrome "Profile 1", everything else in default browser
- `preload.js` bridges renderer → main via `contextBridge` (currently exposes `updateTrayProgress`)
- Cmd+Q and window close just hide (tray stays alive); only tray "Quit" truly exits
- On real quit: kills ComfyUI only if we started it (`_weStartedComfyUI` flag)

**What requires a rebuild:**
Changes to `main.js`, `preload.js`, `server.js`, or `package.json` are bundled into `app.asar` — they need `rm -rf dist && npm run build` + copy to `/Applications/`. Changes to `app.js` and `comfy-prompt-gen.html` are loaded live from `_tools/` — just Cmd+R to reload.

**Bundled files** (listed in `package.json` → `build.files`):
`main.js`, `preload.js`, `server.js`, `package.json`, `icon.icns`, `trayTemplate.png`, `trayTemplate@2x.png`

---

## Generation flow

Build prompt in app → click Send to ComfyUI → workflow JSON built from scratch with dynamic LoRA chain → POST to ComfyUI `/prompt` → ComfyUI generates → auto-saved to raw folder → gallery picks it up via 3s auto-poll. Live progress via WebSocket (proxied through server.js). No copy/paste, no manual downloading from ComfyUI UI.

**img2img (shipped session 27):** Use any gallery image as a starting point instead of a blank canvas. Click "img2img" on the gallery detail panel → loads remix settings + sets the source image. A cyan strip appears above send-config showing a thumbnail, filename, denoise slider (default 0.75), and ✕ to clear. On send, the server uploads the gallery image directly to ComfyUI's input folder via `/comfy/upload-gallery` (no browser round-trip). Workflow swaps `EmptyLatentImage` for `LoadImage` → `VAEEncode`, and KSampler denoise uses the slider value instead of 1.0. Process button shows ⟳ prefix when img2img is active.

**Auto-tagging from metadata (shipped session 28):** When a generation completes, output files are auto-tagged with the checkpoint name and LoRA names extracted from PNG metadata. Also triggers when viewing an image's detail panel (catches existing un-tagged images). Tags are lowercase display names, added to `appData.galleryTags`. **Gated on quality**: LoRAs only tagged if Cleaned flag is set, checkpoints only tagged if displayName is set — prevents raw filenames from polluting tags. Tracked in `appData.galleryAutoTagged` — once a file is auto-tagged, it won't be re-tagged (so user-removed tags stay removed). Migrated on rename. One-time migration (`_autoTagV2`) clears galleryAutoTagged to re-process with display names.

**Generation timing (shipped session 27):** Captures duration of each generation via WebSocket — records start time on first `executing` message, captures output filenames from `executed` messages, computes duration on completion. Stored in `appData.galleryTiming[filename]`. Displayed as ⏱ badge in gallery detail header and "Time" row in metadata params grid.

**File naming:** Still `ComfyUI_000NN_.png` — matches user's existing numbered sequence so manual ComfyUI runs and prompt-gen sends share the same counter.

**Metadata:** ComfyUI embeds full workflow JSON into PNG files. We read this directly. Important: never let the files go through Photos — it strips the metadata.

**WebSocket progress (Phase 3.5, shipped session 16):** Browser connects to `ws://127.0.0.1:3000/ws` (same-origin); server.js proxies to `ws://127.0.0.1:8000/ws?clientId=prompt-gen` from Node.js context. Progress bar in the queue strip + menu bar tray title via IPC. ComfyUI's own UI shows 0% for our jobs (progress events are routed per client_id) — this is cosmetic only, jobs still run fine.

**Settings tab (shipped session 7):** Folder paths, default card size, ComfyUI app name, LoRA Manager port, tab visibility, Brut mode. Stored in `appData.settings`. Currently informational for paths — server still uses hardcoded paths.

**Changelog (shipped session 7):** Formatted version history with tagged entries (new/fix/change/removed). Data lives in CHANGELOG array in app.js. Accessible from Settings.

---

## Things that have bitten us (don't repeat)

1. **Safari 65KB inline script limit** — fails silently, no errors. Always use external app.js.
2. **Safari caching** — can mask fixes. Always test with cache disabled. Use `?v=N` query strings when needed.
3. **Orphaned function bodies** — inserting near a function declaration accidentally eats the `function` keyword. Pattern: `}` followed by code that should be `function foo(){` followed by code. Always run `node --check app.js`.
4. **sl() is lossy** — don't use it to reverse-lookup filenames. Use `data-key` attributes instead.
5. **innerHTML wipes child elements** — if you set `element.innerHTML = ...` it destroys any child elements you added separately. Build badge HTML into the innerHTML string itself.
6. **Duplicate CSS rules** — when rewriting a CSS block, check for stale copies of the same rule elsewhere in the file. Specificity wins unpredictably.
7. **saveAppData is debounced 300ms** — don't expect it to be synchronous. If you need data saved before reading it back, await it properly.
8. **The tool limit problem** — Claude hits tool call limits on complex builds. Strategy: make fewer larger edits, run syntax check only at the end, ship immediately after check passes. Don't do polish passes after the main build.
9. **Tag text exists in three forms in the textarea** — plain `tag`, bare-paren `(tag)`, and weighted `(tag:X.XX)`. Any code that reads or replaces tag text in subject-input / extra-neg must handle all three. `removeTagFromField()` now tries the wrapped regex `\(tag(?::\d+(?:\.\d+)?)?\)` first, then falls back to plain. `applyWeight()` uses the same optional-weight regex so it finds `(tag)` when transitioning from paren-wrap to explicit weight.
10. **layout-right class is still written by applyLayout() from localStorage** — the redesign made the right panel a permanent grid column, so `layout-right` is now a no-op. It's suppressed via `.app.layout-right .main{margin-right:0 !important}` in the redesign block. Don't remove that rule or the dead-zone comes back.
11. **ComfyUI Desktop memory corruption** — pink/salmon/mosaic/banded output across all checkpoints. Not a code bug, not an NSFW filter (ComfyUI has no content filter — confirmed via source code + GitHub). Root cause: MPS/Metal GPU memory gets dirty over long sessions, especially with many checkpoint switches. Fix: full Cmd+Q quit + relaunch of ComfyUI Desktop. The stop/clear buttons handle queue state but can't fix corrupted model cache.
12. **preload.js must be in package.json files list** — Electron's `app.asar` bundle only includes files explicitly listed in `build.files`. Missing preload silently fails (no error, IPC bridge just doesn't connect). Always check the files array when adding new bundled files.

---

## Gallery — current state

**Folders:**
- Raw (all generations): `~/Tools/ComfyUI/output`
- Approved (keepers): `~/Tools/ComfyUI/approved`

**server.js endpoints (Node.js, inside Electron main process):**
- `GET /gallery/list?folder=raw|approved` — list images (name, mtime, size), sorted newest first
- `GET /gallery/image?folder=raw|approved&file=xxx.png` — serve image
- `GET /gallery/metadata?folder=raw|approved&file=xxx.png` — extract generation params from PNG metadata (positive/negative prompts, checkpoint, LoRAs, seed, steps, CFG, sampler, scheduler, size)
- `POST /gallery/approve` — move file from raw → approved
- `POST /gallery/rename` — rename file in-place (validates characters, checks both folders for conflicts)
- `POST /gallery/decline` — move file to Trash (called by Process button, not on every decline click)
- `POST /comfy/prompt` — forwards a ComfyUI API-format workflow to `http://127.0.0.1:8000/prompt`
- `GET /comfy/queue` — returns `{running, pending}` counts from ComfyUI
- `GET /comfy/checkpoints` — authoritative checkpoint list from ComfyUI `/object_info/CheckpointLoaderSimple` (used to filter LoRA Manager's list of what ComfyUI can actually load)
- `GET /comfy/loras` — authoritative LoRA list from `/object_info/LoraLoader` (same purpose)
- `POST /comfy/interrupt` — aborts the currently running generation (proxies to ComfyUI `/interrupt`)
- `POST /comfy/queue/clear` — flushes all pending queue items (proxies to ComfyUI `POST /queue {"clear":true}`)

**State stored in appData.galleryState:**
- absent = unreviewed
- `'review'` = flagged amber
- `'approved'` = moved to approved folder, green border
- `'declined'` = soft-deleted, red border, awaiting Process

**Gallery features shipped:**
- Categories (one per image, mutually exclusive, sidebar nav with colored dots, drag to reorder)
- Category-level Brut (hide entire gallery categories when brut is off)
- Bulk select (Cmd/Ctrl/Shift+click, bulk bar with approve/review/decline/delete/brut/category)
- LoRA metadata popover (click LoRA chip in metadata accordion → floating card with preview + info)
- Time filters (All time / Today / 7 days / 30 days, combinable with state filters)
- Video + external media support (jpg/webp/gif/mp4/webm/mov, video lightbox, ↗ badge)
- Checkpoint display names in metadata
- Auto-poll (3s) for new images while gallery tab is active
- Remix from gallery (load prompt/LoRAs/settings back into Generate tab)

- Image renaming (✎ in detail header, character validation, updates all filename-keyed appData maps, cross-folder duplicate check)
- Gallery tags (freeform multi-tag per image, comma-batch add, lowercase normalized, survives rename)
- Gallery search (toolbar search bar, matches filename + tags, integrates with all filters)
- Compare mode (select 2 → Compare button in bulk bar → fullscreen 50/50 split with state controls, toggle any state, Escape to close)
- Back-to-top button (▲ fixed bottom-right, appears on scroll, fades in/out)
- Drag handles removed from gallery + LoRA toolbars (top bar drag region handles window dragging)

**Next for gallery** (see `_tools/ROADMAP.md` Wave 3+):
- Virtual scrolling (performance — not urgent until ~2000+ images)

---

## Claude Design — what it is and how we use it

Claude Design is an Anthropic Labs tool for collaborative visual design with Claude. We use it for **full-tab redesigns** — when a tab has drifted in scope or layout and needs a fresh take, not incremental polish.

**The interface:** chat panel on the left, live canvas on the right. Daniel describes what he wants, Claude generates a designed prototype, they iterate.

**What we hand it (input package):**
- **Screenshots** of the current tab — the literal "where we're starting from"
- **Plain-English description** of what the tab is *for*, including who's using it, what their workflow is, and what's broken about the current version
- **Codebase link / specific files** so it picks up on the existing design system (CSS variables, fonts, color palette, spacing). For us that's roughly `_tools/comfy-prompt-gen.html` (CSS+structure) and the relevant chunks of `app.js`
- **Reference images** if there's a target aesthetic — competitor screenshots, mood-board stuff, anything visual we want it to lean toward
- **Design constraints** — what must stay (e.g. "Send-to-ComfyUI flow can't break"), what's negotiable, what's hard requirements

**What it hands back:**
- Standalone HTML mockup (interactive, click-through)
- Optionally: handoff package straight to Claude Code (this session) for implementation
- Inline-commentable canvas — Daniel can mark spots and say "make this padding bigger" without retyping prompts

**Iteration patterns:**
- **Chat for broad changes** — "darken the palette", "tighten everything by 20%", "kill the right column"
- **Inline comments for targeted ones** — click a button, type "this should be subtler"

**Tips that apply to our project:**
- Start simple; layer complexity. Don't dump the whole feature list in turn 1
- Reference our actual design tokens by name — `var(--orange)`, Space Mono, `var(--surface)` etc — so the output drops into our CSS without translation work
- Link specific subdirectories of the codebase, not the whole thing (large repos slow it down)
- The output HTML should be treated as a design spec, not the final code — Claude Code (this session) translates it into our existing structure / state hookups / event handlers

**Our workflow with it:**
1. Daniel + Claude Code (this session) prep the input package: screenshots, description doc, file pointers, must-haves
2. Daniel takes that into Claude Design and iterates until the canvas feels right
3. Claude Design exports HTML / hands off to Claude Code
4. Claude Code (this session) wires the new design into `comfy-prompt-gen.html` + `app.js`, preserving state, persistence, and existing feature hooks

The current right-panel layout for the Generate tab is an "until the redesign" placeholder — Daniel intends to send Generate through Claude Design next.

---

## Gallery tab — design direction notes (for upcoming Claude Design redesign session)

The gallery tab has been reconceived **away** from the original masonry/Pinterest layout. The word "gallery" was taken too literally — this tab is primarily a **triage and culling tool**, not a display surface.

**Actual user workflow:**
- Bulk select and delete obvious garbage first (majority of usage)
- Individual decisions on the remaining few — approve, flag for review, or delete
- Occasionally browse approved/review-flagged images for prompt inspiration when feeling lazy or indecisive

**Design direction:**
- **Tight, uniform grid.** Equal size cards, dense, scannable in rows. No masonry.
- **A robust Select mode** for fast bulk selection and deletion is the most important interaction in this tab.
- **Single image view** with simple Approve / Review / Delete controls for final individual decisions.
- **Inspiration browsing** is handled by filtering to approved/review collections via the existing Albums sidebar — no separate mode needed.
- **Compare mode:** when exactly 2 images are selected, a Compare button appears in the toolbar. Opens a clean 50/50 split view with decision controls under each image. Useful for same-prompt variant comparison.

**What to kill:**
- Masonry layout entirely
- Any design direction that optimizes for display over decision-making

---

## Session log

**Session: April 2026 (browser version, this chat)**
- Built LoRA browser from scratch
- Evolved from floating popup → slide-in panel
- Added collections, drag reorder (within collections), status system, embeddings plan
- Added edit mode to panel, image badges, lightbox
- Designed full Electron roadmap including Gallery
- Decided to switch to Claude Code for Electron build
- This CONTEXT.md file created as handoff document

**Session: April 12 2026 (Claude Code session 4)**
- Moved suffix box to right of prefix (below notes), no scroll needed
- Packaged Electron .app with electron-builder, new `»` icon
- Built Gallery Phase 1: grid, detail panel, 4-state system, filters, context menu, lightbox, colored borders, 7:9 cards

**Session: April 12 2026 (Claude Code session 5)**
- Gallery Phase 2: bulk select/approve/decline, card size toggle, categories system with sectioned view
- Unified Brut (adult) filter across both tabs with `⍜` icon, sidebar placement, context menu integration
- Sidebar context-aware: shows gallery controls when on gallery tab, model buttons when on LoRA tab
- Fixed window bounds persistence in Electron (lazy init of userData path)
- Various UX fixes: selection colors, drag handle, context menu click-through, drag-over highlights

**Session: April 12 2026 (Claude Code session 6)**
- Menubar tray app complete: tray icon (`»` template image), ComfyUI start/stop/hide, proxy start/stop, window show/hide, quit
- ComfyUI "Hide" triggers the actual ComfyUI tray menu "Hide" item via AppleScript (clicks menu bar 2) — hides window + dock icon
- Arrow key navigation in gallery detail panel and lightbox (left/right moves between images)
- Phase 2.5 PNG metadata: `GET /gallery/metadata` endpoint reads ComfyUI workflow JSON from PNG tEXt chunks (pure stdlib, no PIL)
- Extracts: positive/negative prompts, checkpoint, LoRAs with strength, seed, steps, CFG, sampler, scheduler, dimensions, denoise
- Smart prompt resolution: follows KSampler positive/negative input links through the node graph to find CLIPTextEncode nodes
- Metadata displayed in accordion panel in gallery detail view — collapsed by default, click to expand
- Large gallery card size reduced from 320px to 270px min-width (tried 220px first, too small)
- Discussed LoRA popover from metadata chips (click LoRA name in metadata to see preview/info) — agreed on popover approach, added to backlog

**Session: April 13 2026 (Claude Code session 7)**
- Added "Hide from Dock" / "Show in Dock" toggle to tray menu — uses `app.dock.hide()` / `app.dock.show()`
- Made Cmd+Q and window close just hide everything (window + dock icon) instead of quitting — tray icon stays alive as always-on control center
- Only the tray menu "Quit" item truly exits the app (sets `forceQuit` flag)
- Learned that `electron-builder` can cache stale asar bundles — must `rm -rf dist/` before rebuild to ensure fresh code
- Added CONTEXT.md reference to Claude memory so it gets read at the start of every session
- **Proxy removed** — replaced Python proxy.py with Node.js server (server.js) running inside Electron main process. No more Python dependency. app.js unchanged — same fetch URLs, same endpoints. Proxy start/stop removed from tray menu since server is built-in.
- Backup of pre-proxy-removal state saved in `_tools/Archive/pre-proxy-removal/`
- Large gallery card size finalized at 270px (was 320→220→270)
- Settings tab added: folder paths (raw output, approved), default card size, ComfyUI app name, LoRA Manager port. Settings stored in `appData.settings`. Currently informational — server doesn't read these yet (hardcoded paths still used).
- Changelog tab added: formatted version history with tagged entries (new/fix/change/removed). Data lives in CHANGELOG array in app.js.
- Sidebar hides nav/collections when on Settings or Changelog tabs

**Session: April 15 2026 (Claude Code session 8)**
- Tray menu reorg: moved Settings into tray (removed from top tab bar), moved Changelog into Settings panel as a section, moved theme toggle + Brut to sidebar bottom
- Collapsed sidebar got its own bottom section with Brut + theme buttons; arrow flips ◀/▶ to reflect state
- Gallery category-level Brut: whole categories can be marked adult and hidden with the Brut filter; blue ⍜ icon stays visible on brut-marked categories
- Brut-marked image cards get a blue badge in bottom-right (not a border — border was overwriting state colors)
- Bulk Brut button in select-mode bar; bulk category assignment via right-click works on whole selection
- Gallery context menu no longer clips at viewport edges (measured after render via rAF)
- External link routing: CivitAI links open in Chrome "Profile 1" (Daniel's alt account) instead of default browser. Uses `setWindowOpenHandler` in main.js to catch `target="_blank"` popups that were getting lost behind the main window. See `openExternalUrl()` in main.js.
- **appData refactor complete**: all the scattered `loraX` maps (`loraNotes`, `loraTriggers`, `loraOverrides`, `loraNames`, `loraImages`, `loraStatus`, `loraFavorites`, `loraAdult`, `loraVerified`) consolidated into a single `loraData[filename]` blob per LoRA. Added `getLora(key)` and `setLora(key, patch)` helpers. Migration runs on load via `migrateLegacyLoraData()` — idempotent, so safe to re-run. `loraVerified` dropped entirely (derivable from `status==='verified'`). Legacy keys deleted from app-data.json after merge. Backup saved as `app-data.backup-20260415-*.json`.
- **LoRA metadata popover** (roadmap's "LoRA popover from metadata" item): click a LoRA chip in the gallery detail panel's metadata accordion to get a floating popover with preview image (340px cover, top-anchored), display name, type, status dot, strength comparison (this image vs. your default when they differ), first lines of notes, and an Open Info button that jumps to the full slide-in detail panel. Popover dismisses on click-outside, Esc, or clicking another chip. Unknown/uninstalled LoRAs show "Not in your library". Functions: `openLoraMetaPopover()` / `closeLoraMetaPopover()` / `lmpopOpenInfo()` in app.js. Styles prefixed `.lmpop-*` in comfy-prompt-gen.html. This is the foundation for the Remix feature.

**Session: April 22 2026 (Claude Code session 9 — Send to ComfyUI / Phase 3)**
- Built the full Send-to-ComfyUI pipeline. Phase 3 complete.
- **Workflow builder**: `buildComfyWorkflow(opts)` in app.js assembles the API-format JSON from scratch per send — node IDs 1 (ckpt), 16 (latent), 29/30 (CLIPSetLastLayer -2), 8/9 (POS/NEG CLIPTextEncode), 17 (KSampler), 32 (VAEDecode), 41 (SaveImage), plus dynamic LoraLoader nodes (IDs 100+, chained model→model and clip→clip). Base template was derived from `ComfyUI_00054_.png`. Denoise fixed at 1.0 (txt2img).
- **Send panel**: new `.send-row` below the out-actions in the footer. Fields: checkpoint select (filtered by model family), W/H, steps, CFG, sampler+scheduler selects (hardcoded lists of ComfyUI-standard names), seed input (blank = random per send), dice button for manual roll, orange Send button.
- **Defaults pipeline**: `initSendPanel()` restores from `appData.settings.lastSend`; falls back to template values. Each field change triggers `saveSendDefaults()` which persists. Checkpoint picker logic in `refreshSendCkpts()`: remix ckpt > previous dropdown value > first active LoRA's `.checkpoint` field > saved default > first in list, with stem-normalization so bare saved names resolve to full path+ext.
- **Name resolution** (the hard part): LoRA Manager returns bare stems (`PlantMilk_walnut`, `Kuroimori-ArtStyle`), ComfyUI's API wants path+ext (`Illustrious/PlantMilk_walnut.safetensors`, `Kuroimori-ArtStyle.safetensors`). Introduced `matchInComfyAuth()` (checkpoints) and `matchLoraInComfyAuth()` (LoRAs) that stem-match against the authoritative `/object_info` lists. Dropdown option values are the ComfyUI-native names, so Send works without further translation. Workflow builder resolves each active LoRA's key via `matchLoraInComfyAuth()` before dropping it into the LoraLoader node.
- **Remix extended**: existing `doRemixFromGallery()` (from session 8) now calls `applyRemixToSendPanel(m)` which matches the PNG's `checkpoint` stem to the dropdown, and sets W/H/steps/CFG/sampler/scheduler/seed from PNG metadata. Tweak and re-send without reopening ComfyUI.
- **Custom checkpoint names**: rename pencil (`✎`) on each Checkpoint card. Stored under `appData.checkpointNotes[filename].displayName`. Used in both the Checkpoint tab card title and the Send dropdown option label. `saveCkpt` now merges instead of replacing, so it doesn't clobber displayName when you save CFG/steps/etc.
- **Toasts**: `showToast(title, sub, type)` in app.js, `.toast-stack` fixed top-right. 9s auto-dismiss for ok, 10s for err, manual × close. Error toasts surface ComfyUI's `node_errors[id].errors[0].details` when present — massive time-saver when debugging validation failures.
- **Server endpoints added**: `/comfy/prompt` (POST forward), `/comfy/queue` (GET), `/comfy/checkpoints` (GET, from ComfyUI `/object_info`), `/comfy/loras` (GET, same). Port constants at top of server.js. Added comment explaining ComfyUI Desktop shares port 8000 with LoRA Manager (since LoRA Manager is a ComfyUI custom node — single process, single port).
- **Gotchas uncovered this session** (added to bitten-us list mentally — worth formalizing if they bite twice):
  - ComfyUI Desktop uses port **8000** not the standalone default 8188. Tried 8188 first and got silent "show everything" fallback — spent a few minutes figuring out why the filter wasn't filtering.
  - Packaged `.app` in `/Applications` uses a bundled `app.asar` — source edits to `server.js` / `main.js` require `rm -rf dist && npm run build` + copy. Editing only app.js/html is fine since those aren't bundled.
  - ComfyUI routes progress websocket events per `client_id`. Submitting with our own id means ComfyUI's UI shows 0%. Proper fix is Phase 3.5 (connect to ws ourselves and pipe progress into the app). Cosmetic-only — the job still runs and saves.
- **Daniel confirmed end-to-end working**: 1 LoRA, Nova Comic XL checkpoint, 896×1152, generated image landed in raw folder and surfaced in gallery with full metadata. Queued several sends without issue.

**Backlog after this session:**
- Phase 3.5: websocket live progress (next)
- "Send log" / history panel (deferred — live progress view will naturally include this)
- Option to not send `client_id` so ComfyUI's own UI shows progress (patch could be optional — user currently OK waiting for Phase 3.5)

**Session: April 22 2026 (Claude Code session 10 — Remix fixes, trigger chips, right-panel layout)**
- Same-day continuation of session 9. Daniel verified Send end-to-end then flagged two issues: remix was locking the checkpoint dropdown, and remixed Illustrious images were flipping the model button to Pony.
- **Remix lock fix** — root cause was `_comfyRemixCkpt` module-level state that `refreshSendCkpts()` kept re-applying on every call (every setModel, every loadComfyCheckpoints). Replaced with a one-shot override inside `applyRemixToSendPanel()`: resolve the ComfyUI-native name, call refreshSendCkpts, then explicitly set `sel.value` to the resolved name. Removed `_comfyRemixCkpt` entirely. Also made `clearAll()` drop `remixNegBase` (was leaving the "remix negative locked" pill stuck).
- **Pony/Illustrious misdetection fix** — `doRemixFromGallery` priority list had `score_9/score_8_up` → pony at the top. But those are shared Illustrious+Pony quality tokens per our own CONTEXT (global Illustrious/Pony positive tokens). Reordered priority to: checkpoint stem lookup → LoRA base-model intersection → checkpoint name heuristic → SDXL fallback. Dropped the score_9 sniff. Added `plantmilk|novacomic|homosimile` to the checkpoint-name heuristic's Illustrious matchers as a safety net.
- **Trigger chip redesign** (big one, resolves "all triggers get jammed into the prompt when enabled, can't pick and choose"):
  - Chose `*` prefix markers over separate fields (user prefers closer-to-current muscle memory + limited UI space).
  - Chose on/off chips over weighted chips (user said weights are rare enough to type manually).
  - Wrote `parseTriggers(raw)` and `resolveTriggerSource(key)` helpers. Added `activeTriggers` Set state keyed by LoRA file_name.
  - Replaced `tw-box` textarea with a div + interactive chips. Required chips render orange pinned with ★, optional chips are dim grey and click-to-toggle-blue.
  - Rewrote `buildPos` loop: per active LoRA, inject prefix → required triggers → active optional triggers (in that order). Legacy `buildTriggers()` kept as a string-form helper for the "Copy triggers" button.
  - `clearAll()` resets `activeTriggers` too.
  - Placeholder on the LoRA panel's Trigger Words field updated to hint at the `*` syntax.
- **Auto-migration for single-trigger LoRAs** — solves the "250 LoRAs, do I have to mark every single-trigger one manually?" problem. `migrateSingleTriggerLoras()` runs inside `loadLoras()` after the favorites-restoration pass. For any LoRA with empty custom `triggers` field and exactly one CivitAI `trainedWord`, sets `triggers = '*' + word`. Saves on any changes. Idempotent because once the field is populated it's considered "touched". Newly installed LoRAs get the same treatment on the next app load.
- **Bulk mark buttons** in the LoRA detail panel — only visible in edit mode. "★ all" prefixes every token with `*`; "all opt" strips every leading `*`. Works on current field value or falls back to CivitAI trainedWords if empty. Massive speed-up for multi-trigger LoRAs — open panel, Edit, ★ all or all opt, Save, next.
- **Right-side panel layout** — the portrait-monitor backlog item from session 6/7 notes was half-done: `.app.layout-right` existed but `.footer{display:none !important}` had been hiding the prompt area entirely in that mode. Rewrote the layout-right CSS block so the footer becomes a real fixed-position 360px right column with flexbox internals. Added a `⬒` toggle button to both the LoRAs-tab and Gallery-tab toolbars. Preference persists in localStorage. Toast stack shifts left to avoid overlap. Trigger chips get more vertical space (240px max-height) which was the actual motivation Daniel cited.
- **Shipping note**: Daniel leaves on a 2-week cruise tomorrow. No rebuild of `/Applications/Prompt Gen.app` was done this session — all changes live in app.js/html, so Cmd+R reload is enough. If server.js ever changes again, need `rm -rf dist && npm run build` before copying over.
- **Deferred discussion for after the cruise**: he's been working with Claude Design on a complete redesign of the app — this current right-panel layout is an "until the redesign" improvement, not a permanent UX decision.

**Session: May 5 2026 (Claude Code session 16 — Phase 3.5 fully working + WS proxy + workflow fix)**
- **Phase 3.5 complete and tested** — WS progress bar fully working. Queue pill shows `generating · N%` during generation; 3px orange bar runs along the bottom edge of the queue-bar (absolutely positioned, much more visible than the old 2px inline flex element). Progress bar was previously invisible due to CSS layout (flex:1 element fighting with the pill).
- **WS 403 fix** — ComfyUI Desktop added WebSocket origin checking; browser connections from `http://127.0.0.1:3000` were getting HTTP 403. Fixed by adding a WebSocket proxy in server.js using the `upgrade` event on the HTTP server. Browser connects to `ws://127.0.0.1:3000/ws` (same-origin, no CORS restriction); server.js proxies to `ws://127.0.0.1:8000/ws?clientId=prompt-gen` using `Origin: http://127.0.0.1:8000` from Node.js context (no browser restrictions). Uses only built-in Node.js APIs (`http`, `crypto`) — no `ws` package needed. Raw TCP pipe after both WS handshakes complete. **Requires rebuild** (server.js change).
- **WS state machine fixed** — `status {queue_remaining: 0}` fires when a job STARTS executing (it leaves the queue), not when it finishes. Old handler was resetting pill to "idle" and hiding the bar at that moment. Added `_wsGenerating` flag; `status {queue_remaining: 0}` only resets to idle if `!_wsGenerating`. Flag is set true on first `executing`/`progress` message, cleared on `executing {node: null}` (true completion). Pill now shows "generating…" between status and first progress message.
- **CLIPSetLastLayer removed from workflow** — `buildComfyWorkflow()` no longer includes nodes 29/30 (CLIPSetLastLayer with stop_at_clip_layer=-2). CLIP goes directly from checkpoint (or last LoRA) to CLIPTextEncode. Illustrious/Pony SDXL models are trained with clip skip 1 and don't benefit from this; it was causing slightly degraded conditioning in some cases. Pre-cruise images that used it still worked, but removing it is cleaner and more compatible.
- **Broken image investigation** — spent significant time diagnosing "pink garbage" output across all checkpoints. Root cause: ComfyUI Desktop accumulated bad session state from trying to load PlantMilk_walnut.safetensors (which seems to produce degraded output) and the model cache got corrupted for the session. Fix: completely quit and restart ComfyUI Desktop (not just hide it). After fresh restart, all checkpoints (WAI, NovaComic, homosimile, PlantMilk Hemp, PlantMilk Walnut) generate correctly. PlantMilk Walnut has a specific 3D-cartoon aesthetic that looks unusual but is not a bug. **This is NOT a code issue** — the workflow JSON was correct throughout. When ComfyUI Desktop gets into a bad state (usually after a long session with many checkpoint switches), quit it completely and reopen.
- **Bitten-us lesson**: ComfyUI Desktop can accumulate model-cache corruption over a long session, especially when loading checkpoints that have issues. Symptoms: pink/salmon flat output, tiny figures, or banded artifacts. Fix is always a full ComfyUI quit+restart, not an app reload.

**Session: May 5 2026 (Claude Code session 14 — ComfyUI auto-launch + sidebar polish)**
- **ComfyUI auto-launches on Prompt Gen startup** — `autoStartComfyUI()` in `main.js` checks if ComfyUI is already running; if not, spawns it via `open -a ComfyUI`, waits up to 15s for the process to appear (500ms poll), then hides the window automatically via the existing `hideComfyUI()` AppleScript after a 2.5s settle delay. Separately polls port 8000 (3s interval, 3 min timeout) to know when models are loaded.
- **Three tray states** for ComfyUI: `◌ Starting...` (process launched, window not hidden yet), `● Loading models...` (process up but port 8000 not responding), `● Ready` (port responding). Replaces the old single `● Running` label.
- **Auto-quit on exit** — `_weStartedComfyUI` flag: set true only if WE launched ComfyUI (not if it was already running when Prompt Gen opened). On real quit (tray Quit), only calls `stopComfyUI()` if the flag is set. This prevents Prompt Gen from killing a ComfyUI instance the user had open independently.
- **Manual Start/Stop in tray** still works — clicking "Start ComfyUI" now calls `autoStartComfyUI()` (same flow as auto-start) rather than just `open -a ComfyUI`. Stop clears the flags.
- **`_comfyReady` refreshed in the 5s status poll** — so if ComfyUI finishes loading models between poll ticks, the tray updates within 5s without needing `autoStartComfyUI` to be running.
- **Requires rebuild** — changes are in `main.js` (bundled into `app.asar`). Need `rm -rf dist && npm run build` before testing packaged version. Dev mode (`npm start`) works immediately.

**Session: May 5 2026 (Claude Code session 13 — sidebar category density)**
- Categories sidebar in the Generate tab was running out of vertical room — the `+ New category` button required scrolling to reach, and two labels ("Physical Descriptors", "Mood / Atmosphere") were wrapping to two lines making it worse.
- **Sidebar widened**: `--sidebar-w-redesign` 220 → 248px. Unwraps both two-line labels. Daniel plans to auto-collapse the sidebar in portrait/vertical-monitor mode anyway, so the extra desktop width doesn't hurt the eventual portrait UX.
- **Tighter rows**: `.nitem` vertical padding 6 → 4px, font-size from inline `13px` to CSS-controlled `12.5px` via a `.sidebar-nav .nitem > span` selector (with `!important` because the LoRA renderer still emits an inline font-size on its label spans). Removed the inline `font-size:13px` on the Generate-tab category label.
- **Sticky + New button**: `position:sticky; bottom:0` on `.sidebar-nav .add-cat-btn` with a matching surface-color background and a soft top-edge shadow so it sits cleanly over content scrolling under it. Works for all three tabs: Generate (`#sidebar-add-btn` external sibling of `#nav`), Gallery (same external button, just different label/handler), LoRAs (button is inserted *inside* `#nav` HTML by `renderLoraNav` — still works because sticky positioning anchors to the nearest scrollable ancestor `.sidebar-nav`, not the immediate parent).
- **Auto-collapse empty categories — TRIED AND REVERTED**: initial implementation shrunk empty rows to a thinner dim strip. Daniel viewed it live and felt the result looked too sparse — with all rows starting empty and the wider sidebar already comfortably fitting everything, the collapse just made the page feel hollow. Reverted both the CSS (`.nitem.cat-empty` rules) and the JS class toggling. Worth keeping in the back pocket as a future option if/when the category list grows past ~15.
- **Add-cat button moved to header**: filled-white version felt too prominent. Replaced with a small `+` button (18×18, transparent with subtle border) sitting next to the "CATEGORIES" / "COLLECTIONS" label in the sidebar header (`.slabel-row`). Removes the entire bottom button area — much cleaner. `#sidebar-add-btn` is now reused across all three tabs (Generate / Gallery / LoRA) by `renderNav()` swapping its `onclick` and `title`. Also removed the inline `+ New collection` button that `renderLoraNav` was appending to the nav HTML — LoRA tab now uses the same header `+` as the others.
- **Recent strip clear button**: small "clear" pill next to the recent thumbs in the right panel. Clicking sets `localStorage.cpg-recent-cutoff` to the current timestamp; `renderRecentStrip()` filters out images with `mtime <= cutoff` so already-shown images disappear and only newer ones replace them. Daniel had assumed the strip was session-scoped; this preserves the auto-pull-from-disk behavior while giving him an explicit "I'm done with these" reset. Server returns mtime in seconds (`stat.mtimeMs/1000`), so the cutoff stores `Date.now()/1000` to match.
- The remaining changes (wider sidebar, tighter rows) all stuck. List now fits without scrolling on Daniel's primary monitor with room to add several more categories before scroll kicks in.
- **LoRA double-toggle bug fixed**: clicking Enable on a card, then clicking Enable a second time appeared to disable the LoRA in `activeLoRAs` but left the original collection card stuck in the green "✓ Enabled" state. Root cause was duplicate IDs: `mkLoraCard` emits `id="lcard-${sl(key)}"` and `id="lcen-${sl(key)}"`, and the Enabled section at the top + the collection section below both render the same LoRA, so two elements share each ID. `getElementById` returns only the first match (DOM order), so when the Enabled section is on top the toggle updates *its* copy and `refreshEnabledSection` then wipes that section, leaving the original collection card with stale state. Fix: switched the three lookups (`ltc-`, `lcard-`, `lcen-`) in `toggleLoraTab()` to `querySelectorAll('[id="..."]')` so all duplicates get updated. `classList.toggle(cls, state)` with an explicit state is idempotent, so updating an already-correct copy is harmless. Pre-existing single-card lookups elsewhere (panel, drag handlers) are fine because they only fire when the panel is open or a card is being dragged — contexts where duplicate IDs don't co-exist.

**Session: May 4 2026 (Claude Code session 12 — v5 Generate tab redesign)**
- Landed the Claude Design v5 redesign of the Generate tab (Tags panel). Full 3-column grid, floating panel cards, all legacy layout-right compatibility shims. Many hours of iterative debugging: missing `</style>` tag (blank black screen), `layout-right` margin eating the grid track (268px dead zone), layers-vs-floating-panels debate (settled on flush shell + floating sidebar/footer cards).
- Shipped a large batch of UX fixes: pencil icon for edit button, collapsed sidebar button overhaul (traffic lights, Pony→PN, add clear-all X, hide stray border box), select dropdown custom chevron, category header cursor removed, scrollbars hidden, locked seed orange styling, extra neg visible.
- Built the paren wrap feature from scratch (two entry points: shift+click + popup button; chip renders `(1boy)` not `1boy ()`; `removeTagFromField` handles all three tag forms).
- Fixed right-click weight → textarea sync bug, paren→weight transition bug, recent strip dependency on Gallery tab.
- LoRA header strip de-clickified (browse link + onclick removed).
- Session ended with app in clean tested state. No rebuild of `.app` needed (all changes in app.js / html).

**Session: April 22 2026 (Claude Code session 11 — post-v3.9 polish before the cruise)**
- Same-day continuation of session 10. Daniel ran through a testing pass and flagged several real issues plus a few UX asks.
- **Gallery auto-refresh fix**: longstanding intermittent behavior — "generation finishes, file lands in /output, sometimes gallery updates, sometimes it doesn't." Root cause: `loadGallery()` only ran on `switchTab('gallery')`. If you were already on the Gallery tab when the new file appeared, nothing reloaded. Fix is a 3-second poll of `/gallery/list?folder=raw` while the Gallery tab is active; only re-renders if newest mtime bumps. Baseline is updated inside `loadGallery` itself so the tick doesn't fire twice on the same fresh data. Stops on tab-switch via existing switchTab logic.
- **Gallery design direction notes** captured in CONTEXT.md for the upcoming Claude Design redesign session — Daniel's actual workflow is triage-first (bulk delete garbage, then individual approve/review on the remainder), with occasional inspiration browsing. Masonry is OUT, tight uniform grid + robust Select mode is the direction. Compare mode (2 selected → split view with decision controls) added as a spec item.
- **Layout toggle relocation**: was in lora-toolbar + gallery-toolbar (wrong — those are hidden on Tags where the prompt area actually lives). Moved to `.out-actions` row next to Clear all. Much more discoverable since it sits with what it controls.
- **Right-panel critical bugs found during testing**:
  - Clicking the toggle opened a blank 360px gap and the prompt area stayed at the bottom. Root cause: all my layout-right CSS used descendant selectors (`.app.layout-right .footer`) but `<div id="footer">` is a **sibling** of `<div class="app">`, not a child. The selectors silently matched nothing. Switched to sibling combinators (`.app.layout-right ~ .footer .X`). Added a multi-line CSS comment warning future-me not to fall into this again.
  - After that fix, the right panel showed on every tab, not just Tags. My `display:flex !important` was overriding `switchTab`'s inline `display:none`. Dropped `!important` — inline styles win naturally, so the panel is only visible when on Tags (where `switchTab` clears the inline display).
  - After THAT fix, the 420px gap was still reserved on non-Tags tabs because `.main` had `margin-right:420px` whenever `.app.layout-right` was set. Scoped to `:not(.footer-hidden)` using the existing `footer-hidden` class `switchTab` already toggles.
- **Right-panel layout tightening**: Daniel showed a mockup wanting no scrolling in the prompt area unless triggers are huge. Width bumped 360 → 420px; textareas, buttons, send-fields all tightened. The ask was explicitly a "TINY bit more space"; settled on 420px as the balance point.
- **Why this didn't require a .app rebuild**: every change this session is in app.js or comfy-prompt-gen.html, both of which are loaded live from `_tools/` (not bundled into `app.asar`). Cmd+R in the app window is enough. Any future server.js change will still need `rm -rf dist && npm run build`.
- **Handoff state for the cruise**: app is in a solid working state. Phase 3 (Send) + trigger chips + auto-migration + bulk mark + right panel + gallery poll all ship-ready and tested. Next session's backlog remains Phase 3.5 (websocket live progress) and whatever Claude Design produces during the cruise.

**Session: May 13 2026 (Claude Code session 26 — Wave 2 complete: gallery renaming, tags, search, compare)**
- **Wave 2 fully built and tested** — all four items from the roadmap shipped.
- **Image renaming**: ✎ button in gallery detail header, inline input with Save/Cancel. Character validation (letters, numbers, dash, underscore, space only via `/^[a-zA-Z0-9_\- ]+$/`). Extension auto-preserved. Duplicate check against BOTH raw and approved folders. Updates all filename-keyed maps: galleryState, galleryAdult, galleryTags, galleryCats, galleryImages array, grid card attributes + media src. New server endpoint `POST /gallery/rename` in server.js (**requires rebuild**).
- **Gallery tags**: freeform multi-tag per image, stored in `appData.galleryTags[filename]`. Tag chips in detail panel with ✕ to remove. + button to add, comma-separated batch add supported. Lowercase normalized, deduplicated. Tags migrate on rename. Persist in appData.
- **Gallery search**: search bar in gallery toolbar (160px, matches LoRA search width). Searches filename and tags. `applyGallerySearchFilter()` integrates into both sectioned and flat render paths, combining with state/time/brut filters. Clear ✕ button.
- **Compare mode**: select exactly 2 images → blue Compare button in bulk bar. Opens fullscreen 50/50 split overlay (z-index 500). Each side shows image (or video with controls), filename, state badge with colors, and Approve/Review/Decline buttons. All three states toggle back to unreviewed on second click. Buttons light up with their state color (`cmp-active` class). Approve handles files already in approved folder (skips server move). Escape or ✕ to close, exits select mode.
- **UX polish**: removed ⠿ drag handles from gallery + LoRA toolbars (top bar `-webkit-app-region: drag` handles window dragging). LoRA search moved to right side, narrowed to 160px. Back-to-top ▲ button (fixed bottom-right, appears on scroll >400px, smooth scroll to top).
- **Electron `-webkit-app-region` bug**: gallery detail header buttons (close, rename cancel) were unclickable because the header overlapped the `.tabs` element which has `-webkit-app-region: drag`. The drag region operates at the compositor level — z-index and position have no effect. Fixed by adding `-webkit-app-region: no-drag` to `.gallery-detail-header` and `.compare-header`.
- **Rebuilt .app** — server.js changed (rename endpoint). `rm -rf dist && npm run build`.
- **All app.js + HTML changes are live** — Cmd+R to reload.

**Session: May 12 2026 (Claude Code session 25 — menu bar progress + testing blitz)**
- **Menu bar queue/progress display**: generation percentage and queue count now show next to the `»` tray icon in the macOS menu bar. Shows `45% | +2` during generation (percentage + queued count), `…` when generation starts before first progress tick, `+3` when items are queued but not generating, and clears to empty when idle.
- **IPC bridge**: new `preload.js` uses `contextBridge.exposeInMainWorld` to expose `window.promptGen.updateTrayProgress(text)`. main.js listens via `ipcMain.on('tray-progress')` and calls `tray.setTitle()`. `_trayOwnedByRenderer` flag prevents the 5s status poll in `rebuildTrayMenu` from wiping progress text mid-generation.
- **app.js changes**: `_trayProgress(text)` helper calls `window.promptGen?.updateTrayProgress(text)` (safe no-op in browser). Called at every state transition in `handleComfyWSMessage` — progress, executing (start/finish), and status messages.
- **Build fix**: `preload.js` initially missing from `package.json` `files` array — tray progress silently failed because the preload wasn't bundled into `app.asar`. Added to the files list and rebuilt.
- **Rebuilt .app** — main.js and preload.js are bundled, requires rebuild. Rebuilt and deployed to `/Applications/`.
- **NSFW filter research**: investigated claim that ComfyUI Desktop has a built-in content filter that mosaics images. **Confirmed false** — no such filter exists in ComfyUI Desktop (core code, config, custom nodes all checked). GitHub issue #6470 is an unimplemented feature request. Mosaic/broken output is the same MPS memory corruption issue — fix is full Cmd+Q restart of ComfyUI.
- **Testing blitz** — confirmed passing: Tab visibility in Settings, Embeddings (core toggle/prompt/clear/persist), Gallery time filters, Checkpoint display name in metadata, Gallery JPG/WebP support, Gallery video playback, Gallery external media badges. Remaining untested: Collection-level Brut, Checkpoint prefix with multi-checkpoint.
- **Video gen research saved**: `_tools/video-gen-research.md` — notes on Wan2.1/2.2 vs LTX-Video, image-to-video workflow, Apple Silicon compatibility, app integration ideas. Intentionally deferred (Wave 4).

**Session: May 12 2026 (Claude Code session 24 — queue stop/clear buttons)**
- Diagnosed pink/mosaic broken generation issue — root cause is ComfyUI Desktop's Python server persisting after window close, so "restart" reconnects to dirty state. Not a code bug; fix is full Cmd+Q quit of ComfyUI, not just hide.
- Added ■ stop and ✕ clear buttons to the queue bar. Stop = interrupt current gen, Clear = flush pending queue. Both always visible, turn red on hover.
- Added two new server.js proxy routes: `POST /comfy/interrupt` and `POST /comfy/queue/clear`.
- Requires rebuild (server.js changed).

**Session: May 11 2026 (Claude Code session 23 — embeddings + roadmap update)**
- **Embeddings feature built**: on/off chips for textual inversions (`lazypos`, `lazyneg`) in the right panel. Each embedding has a `target` field (`pos` or `neg`) that determines which prompt it injects into. Syntax: `embedding:name` added to the appropriate prompt string in `buildPos()` / `buildNeg()`. Chips sit pinned to the bottom of the triggers section via `margin-top:auto` in the flex column panel-body. + button inline with chips to add new embeddings (name + pos/neg selector). Right-click a chip to remove it. State persisted in `appData.embeddings` array — active state survives app restarts. `clearAll()` deactivates all embeddings. `initEmbeddings()` seeds `lazypos`/`lazyneg` on first run.
- **Layout iterations**: started as a separate "EMBEDDINGS" section with its own header. Moved inside triggers section to save space. Removed the header label entirely and went label-free with just a thin divider + inline chips. Tightened triggers-section padding (14→10px) and section-label margin (10→8px) to eliminate scrollbar with 3 active LoRAs. Final layout: embed-row is a direct child of panel-body with `margin-top:auto` so it always pins to the bottom regardless of trigger count above.
- **Roadmap updated**: added img2img to Wave 3 (high priority), created Wave 4 for video generation (prompt guidance → workflow templates → generation UI), bumped redesign to Wave 5. Embeddings marked complete in Wave 1.
- **Discussion captured**: img2img vs remix (remix copies settings, img2img uses the actual image pixels as starting point), video generation approach (one-time ComfyUI workflow setup per model, then app parameterizes and sends), agreed to nag Daniel about LoRA library cleanup progress periodically.
- **Gallery time filters**: cycle button in gallery toolbar ("All time" → "Today" → "7 days" → "30 days"). `galleryTimeFilter` state variable, `applyGalleryTimeFilter()` in the filter chain, `cycleGalleryTimeFilter()` handler. Button pushed to right side of toolbar via `margin-left:auto`. Works alongside existing state filters (e.g. "Unreviewed + 7 days"). Uses `img.mtime` from server response.
- **Checkpoint display names in metadata**: gallery detail panel now shows custom `displayName` from `checkpointNotes` instead of raw filename stem. Lookup by stem-matching. Remix unaffected — still uses raw name for checkpoint matching.
- **All changes in app.js + comfy-prompt-gen.html only** — no server.js changes, no rebuild needed.

**Session: May 11 2026 (Claude Code session 22 — collection brut + tab visibility)**
- **Collection-level Brut**: ⍜ button on LoRA collections in sidebar nav (hover to see, same pattern as gallery categories). Marking a collection as brut hides it from the sidebar nav AND filters its LoRAs out of the grid when brut is off. Stored in `appData.loraColBrut`. `toggleLoraColBrut(colId)` / `isColBrut(colId)` helpers. Hiding respects both the per-tab `showAdult` toggle and the Settings-level `hide-brut` demo mode. Fixed `toggleAdult()` to also call `renderLoraNav()` so the sidebar updates when toggling brut on/off.
- **Tab visibility in Settings**: new "Tabs" section with checkboxes for Checkpoints, History, and Presets. Generate/LoRAs/Gallery always visible. Persisted in `appData.settings.hiddenTabs` (default: `['history','presets']` matching pre-existing behavior). `applyTabVisibility()` called on init and on change, toggles `display:none` on the tab elements by index.
- **Gallery tab moved to last position** in the tab bar — always appears rightmost regardless of which other tabs are visible. Tab index array in `switchTab` and `applyTabVisibility` updated to match new DOM order.
- **Gallery video + external media support**: gallery now handles jpg/jpeg/webp/gif/mp4/webm/mov files in addition to PNG. Video thumbnails use `<video muted preload="metadata">` (shows first frame). Detail panel swaps to `<video controls>` for video files. Lightbox skips for videos (play inline in detail panel). Server MIME types added for mp4/webm/mov. Metadata endpoint returns `{has_metadata:false}` for non-PNG files instead of 404.
- **External source ↗ badge**: grey circle badge on bottom-right of any non-PNG gallery card. Shifts left when brut badge is also present (`.gbrut-badge+.gext-badge{right:30px}`). Non-PNG = definitely not from ComfyUI (which always outputs PNG). Covers Grok images/video and any other external media dropped into the output folder.
- **Video lightbox**: `closeLightbox()` pauses video and restores the `<img>` element so LoRA card lightbox still works.
- **Video UX**: play icon (▶ in translucent circle) overlaid on video thumbnails in the gallery grid so they're visually distinct from images. Detail panel video has native controls (play/pause/seek/fullscreen/unmute). Lightbox video autoplays muted with controls.
- **Rebuilt .app** — server.js changes required rebuild. Had to `rm -rf` the old `/Applications/Prompt Gen.app` before copying (running app was blocking overwrite).
- **Gotcha**: running Electron app blocks `cp -R` to `/Applications` — must `rm -rf` the old .app first, then copy fresh.

**Session: May 10 2026 (Claude Code session 21 — roadmap + Wave 1 quick wins)**
- **ROADMAP.md created** in `_tools/` — four waves mixing housekeeping with fun features, plus an ideas bank. Replaces the scattered backlog across CONTEXT.md and memory files.
- **Rebuilt .app** — `rm -rf dist && npm run build` in electron-app/. Picks up WS proxy and ComfyUI auto-launch from sessions 14/16. Daniel confirmed WS progress bar working in packaged app.
- **CivitAI link editing** — editable URL field in LoRA detail panel (visible in edit mode, link in view mode). Stored in `loraData[key].civitUrl`. Falls back to auto-generated civitai.com URL if no custom URL set. Solves civitai.com → civitai.red migration for NSFW LoRAs.
- **Checkpoint prefix tags** — new "Prefix Tags" field on checkpoint cards (Checkpoints tab). Auto-injects into positive prompt when that checkpoint is selected. `getCkptPrefix(comfyName)` helper does stem-matching between ComfyUI-native names and `checkpointNotes` keys. In multi-checkpoint batch sends, each job gets its own checkpoint's prefix prepended. Stored in `appData.checkpointNotes[key].prefix`.
- **Top bar drag region** — `-webkit-app-region: drag` on `.tabs`, `no-drag` on `.tab` buttons, `.lora-toolbar`, and `.gallery-toolbar`. Fixed search box not clickable (toolbar inheriting drag from parent).
- **LoRA panel width** — 700px → 520px. Tabs make the old width wasteful. Panel thumbnail (140px) noted as slightly oversized at new width — added to ideas bank for future Claude Design pass.
- **Process button** — "Send to ComfyUI" → "Process" (and "Send N jobs" → "Process N jobs"). Button and batch input matched to 34px height. Fixed `.send-footer .send-btn` override that was keeping button tall (`height:auto` → `height:34px`).
- **Default tab** — app now opens on Generate tab instead of LoRAs. Replaced manual class setup with `switchTab('tags')` in `init()`.
- **Checkpoint dropdown** — `max-height` bumped from 220px to 400px to fit growing checkpoint list without scrollbar.
- **All changes in app.js + comfy-prompt-gen.html + rebuilt .app** — server.js unchanged from session 16.

**Session: May 9-10 2026 (Claude Code session 20 — brut tag restyle, textarea fix)**
- **Tag Brut visual restyle**: originally blue/indigo (looked like enabled state), then grey/dimmed (still confusing), finally settled on **no color change + ⍜ symbol appended** to the tag text. Brut tags now look identical to normal tags except for the small `⍜` mark. Category color styling re-enabled for brut tags (was being skipped). `.brut-mark` span styled at `.75em` with `.45` opacity. All the blue/grey CSS overrides removed.
- **Textarea scrollbar corner fix**: the white box in the bottom-right of subject/extra-neg textareas when a scrollbar appeared. `color-scheme:dark` (added in session 19) fixed the scrollbar track but not the corner piece. Added `::-webkit-scrollbar-corner{background:transparent}` and `::-webkit-resizer{background:transparent}` to both `.compose-cell.compose-subj .sinput` and `.compose-scroll .xneg-input`.
- **Cleaned flag, cleaned filter, tag brut flagging all confirmed tested** by Daniel — moved to Tested list. No untested items remain.
- **All changes in app.js + comfy-prompt-gen.html only** — no server.js changes, no rebuild needed.

**Session: May 8 2026 (Claude Code session 19 — batch send + multi-model)**
- **Multi-model checkpoint selector**: replaced the single `<select id="cfg-ckpt">` with a custom multi-select dropdown (`ckpt-multi`). Checkboxes next to each checkpoint name. Check multiple to send the same prompt to each. Button label shows "PlantMilk Hemp +2 more" when multiple selected. State tracked in `_selectedCkpts` Set and `_ckptItems` array. Old `<select>` kept hidden for backward compat (applyRemixToSendPanel still sets it as a fallback).
- **Batch count**: `×N` input (`cfg-batch`) in the send footer, left of the Send button. Multiplies with checkpoint count — 3 checkpoints × 2 batch = 6 jobs. Persists in `appData.settings.lastSend.batch`. Range 1–20.
- **Send button label updates live**: shows "→ Send 6 jobs" when total > 1, "→ Send to ComfyUI" for single. `updateSendBtnLabel()` called on any checkpoint toggle or batch count change.
- **Seed behavior in batch**: unlocked seed rolls a fresh random for each individual job (variations). Locked seed uses the same seed for all jobs (model comparison). `sendToComfy()` loops sequentially through checkpoints × batch count, firing one `/comfy/prompt` POST per job.
- **Toast summary**: single sends show seed as before. Batch sends show "N queued" with "same seed" note if locked.
- **Remix resets batch**: `applyRemixToSendPanel` sets batch count back to 1 and clears multi-select to just the remixed checkpoint.
- **New functions**: `toggleCkptDropdown()`, `toggleCkptOption()`, `updateCkptMultiLabel()`, `renderCkptMultiList()`, `getSelectedCkpts()`, `updateSendBtnLabel()`. `refreshSendCkpts()` rewritten to populate the multi-select instead of the old `<select>`.
- **All changes in app.js + comfy-prompt-gen.html only** — no server.js changes, no rebuild needed.

**Session: May 8 2026 (Claude Code session 18 — LoRA tab redesign + demo mode)**
- Implemented the Claude Design LoRA tab redesign handoff from `design_handoff_lora_tab/`. Card Style A (overlay, 2:3 aspect-ratio), tabbed detail panel (Overview/Notes/Settings), sidebar with rounded right edge. Triggers button removed from cards per design brief.
- Debugging session: the `\"` HTML escaping bug in `mkLoraCard`'s `onerror` attribute broke all cards after the first — took careful HTML parser tracing to identify. Fixed by removing quotes from the class value in the onerror handler. Also fixed `var(--radius)` undefined → hardcoded `10px`. Added `position:absolute;inset:0` to `.lora-card-img` so it fills the aspect-ratio container.
- Added demo-mode toggle to Settings (LoRAs section) — hides all adult/brut UI and content via `body.hide-brut` CSS class. Quick flip before presenting to colleagues.
- **All changes in app.js + comfy-prompt-gen.html only** — no server.js changes, no rebuild needed.

**Session: May 5 2026 (Claude Code session 17 — right panel polish, gallery multiselect, remix + queue fixes)**
- Continued from session 16 (same day). Daniel was doing a testing pass and flagging issues alongside new asks.
- **Right panel strip reorder**: Queue → Recent → LoRAs. Visual cleanup: transparent backgrounds, white labels, full-width sidebar HR, separator below categories removed.
- **UX fixes**: auto-lock seed on remix, extra neg clears on reload, strength slider auto-confirm on mouseup (Apply button removed).
- **LoRA remove from Generate panel**: ✕ button in trigger chip blocks. Strips prefix/suffix/triggers from subject-input via same comma-regex as tag removal.
- **Prefix/suffix cleanup**: both in `disableLoraFromPanel` (remove from right panel) and in `doRemixFromGallery` (prevent double-print on remix). Two-part fix for original bug.
- **Copy image to clipboard**: right-click context menu on gallery thumbnails + detail panel image. ClipboardItem API.
- **Queue strip**: progress bar sits ON separator (bottom:-3px, no layout impact). "Queue · N" count label driven by debounced API fetch (not WS message composition — eliminates ordering race conditions that caused off-by-one counts). Toast position fixed (right:438px always). Toast lifetimes 3.5s/8s.
- **Gallery multiselect**: Cmd/Ctrl/Shift+click enter select mode. All actions exit select mode. `exitGallerySelectMode()` shared helper. `_galleryLastClicked` for Shift range.
- **Remix LoRA UI fix**: `doRemixFromGallery` now calls `updateLoraStats()` (fixes "0 active" badge), closes gallery detail, and switches to Generate tab so user lands directly in remixed state.
- **Category management**: "Set Category" label added to right-click context menu (feature existed but was invisible — no label). Non-bulk path now calls `renderGallery()` so grid updates immediately after category change.
- **Testing checklist**: introduced `project_test_checklist.md` in memory at Daniel's request — tracks built-but-untested features so nothing slips through. Nag protocol: bug Daniel about untested items proactively.
- **All changes in app.js + comfy-prompt-gen.html only** — no server.js changes, no rebuild needed. Cmd+R is enough.

**Session: May 14 2026 (Claude Code session 26 — queue panel, dude button, auto-neg)**
- **Queue management panel**: floating vertical panel that slides out to the left of the right panel when "queue" button is clicked. Shows running job (with ■ stop button) and pending jobs (with ✕ cancel per job). Each job displays checkpoint display name (resolved from `appData.checkpointNotes` via stem match). Auto-refreshes on WS events (executing node=null, status changes). Server endpoints: `GET /comfy/queue/details` (returns jobs with promptIds + checkpoint stems parsed from workflow data), `POST /comfy/queue/delete` (cancels specific jobs by promptId). CSS: `position:absolute;right:100%` on `.footer` (changed to `position:relative;overflow:visible`). Old stop/clear buttons in queue strip replaced with "queue" toggle button.
- **♂ dude button** (male bias toggle): red button right-justified in embeddings row. When ON, injects weighted positive tags (`(male:1.3), (man:1.2), masculine, male focus`) into positive prompt and negative tags (`female, woman, girl, breasts`) into negative prompt. Defaults to ON. Tags are editable in Settings ("Male Bias Tags" section — two textareas for pos/neg). Stored in `appData.maleBias` (boolean), `appData.maleBiasPos`, `appData.maleBiasNeg`. Positive tags that match existing UI tag pills auto-select them (including custom tags); negative tags do NOT sync to pills. `parseBiasTags()` strips weight syntax for matching. `syncMaleBiasPills()` runs on toggle and on settings save.
- **Auto-select negative tags**: negative tags auto-activate on launch based on `appData.autoNegTags` list. Default: all negative tags except "text". Settings section ("Auto-Select Negative Tags") shows checkboxes for every negative tag including custom ones. `getAllNegTags()` merges builtin + `customTags.negative`. `initAutoNeg()` runs early in `init()` before first render.
- **Feminine tags removed from negative category**: `female`, `feminine`, `woman`, `girl`, `feminine facial features` removed from `BUILTIN_CATS` negative category since the dude button's negative list handles this now.
- **Recent button cleanup**: removed `▴`/`▾` triangle that JS was appending to the recent toggle button text.
- **Gallery state toggles** (carried over from session 25 context overflow): approve/review/decline are now independent toggles in both context menu and detail panel. Each button only toggles its own state. Unapprove moves files from approved→raw. Detail panel buttons use filled tint when active instead of disabled style. All three buttons always visible. Server endpoint: `POST /gallery/unapprove`.
- **Age badges + backlog nag** (carried over from session 25): corner ribbons on old unreviewed cards (amber 7-13d, red 14+d), ⏱ count on Gallery tab, 5s-delayed toast on launch.
- **Changes span all three core files** — app.js, comfy-prompt-gen.html, server.js. Electron app rebuilt (server.js has new queue endpoints).

