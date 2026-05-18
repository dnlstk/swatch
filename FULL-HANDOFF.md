# Prompt Gen — Full UI Redesign Handoff
*Claude Design session — May 2026*
*Covers: Generate Tab · LoRAs Tab · Gallery Tab*

---

## How to use this doc

Read the **Shared Design System** section first — it covers the token set, font stack, and floating panel system that every tab uses. Then read each tab's section before implementing that tab. The design HTML files are the pixel-level source of truth; this doc explains decisions and provides the wiring guide.

**Reference files:**
| File | Tab |
|------|-----|
| `Generate Tab Redesign v5.html` | Generate |
| `LoRA Tab Redesign.html` | LoRAs |
| `Gallery Tab Exploration.html` (artboard A + E) | Gallery |

---

## Part 0 — Shared Design System

### Palette

**P1 — Warm Light (primary / light mode)**
```css
body.light {
  --bg:        #F5F4F0;   /* warm off-white canvas */
  --chrome:    #EDEBE6;   /* title bar, tab bar */
  --panel:     #FFFFFF;   /* floating panel surfaces */
  --surface:   #E6E4DE;   /* inputs, active nav items */
  --surface2:  #DFDDDA;   /* chip backgrounds */
  --border:    rgba(0,0,0,0.08);
  --border2:   rgba(0,0,0,0.14);
  --text:      #1A1917;
  --muted:     #78756E;
  --muted2:    #B2B0A9;
  --orange:    #D96A14;   /* primary accent */
  --green:     #047857;
  --amber:     #92400E;
  --blue:      #1D4ED8;
  --red:       #B91C1C;
  --purple:    #6D28D9;
  --shadow:    0 0 0 1px rgba(0,0,0,0.06), 0 8px 40px rgba(0,0,0,0.12);
  --shadow-sm: 0 0 0 1px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.07);
}
```

**P2 — Midnight (dark mode, existing)**
```css
:root {   /* existing dark values — unchanged */
  --bg:        #090909;
  --chrome:    #0f0f11;
  --panel:     #131315;
  --surface:   #161618;
  --surface2:  #1d1d20;
  --border:    rgba(255,255,255,0.07);
  --border2:   rgba(255,255,255,0.13);
  --text:      #E8E8E6;
  --muted:     #6B6B72;
  --orange:    #FB923C;
  --green:     #34D399;
  --amber:     #F59E0B;
  --blue:      #818CF8;
  --red:       #F87171;
  --shadow:    0 0 0 1px rgba(255,255,255,0.05), 0 8px 48px rgba(0,0,0,0.8);
}
```

### Typography
- **Poppins 400/500/600** — all UI text, labels, buttons
- **Space Mono 400/700** — all monospace: badges, counts, metadata, filenames, category labels
- Section labels: `font-family: Space Mono; font-size: 9px; letter-spacing: 0.11em; text-transform: uppercase; color: var(--muted2)`

### Floating panel system
Every panel, sidebar, and filter bar is a floating card:
```css
.floating-card {
  border-radius: 12px;
  box-shadow: var(--shadow);
  border: 1px solid var(--border);
  background: var(--panel);
}
```
Panels float with `margin: 10px` off edges:
- Left panels: `margin: 0 0 10px 10px`
- Right panels: `margin: 0 10px 10px 0`
- Full-width strips: `margin: 0 10px`

### Title bar
Single `46px` bar. All three tabs share the same bar structure:

```
[Traffic lights] | [Generate] [LoRAs ●N] [Gallery ●N]          [☀] | [⊡] | right controls
```

Tab button style (active):
```css
padding: 4px 13px; border-radius: 6px;
border: 1px solid var(--border2); background: var(--surface);
font-size: 13px; font-weight: 500; color: var(--text);
```
Inactive: `border: transparent; background: transparent; color: var(--muted)`.

Tab count badges (LoRAs = orange, Gallery = blue):
```css
background: COLOR; color: #fff; border-radius: 8px;
font-family: Space Mono; font-size: 9px; padding: 1px 5px; font-weight: 700;
```

### Light/dark toggle
`☀/🌙` button in the right controls group of the title bar. Toggles `body.light` class. Existing implementation unchanged — just move the button into the title bar right-controls group.

### Scrollbars
Hidden everywhere:
```css
scrollbar-width: none;
&::-webkit-scrollbar { display: none; }
```

---

## Part 1 — Generate Tab

**Reference:** `Generate Tab Redesign v5.html`

### 1.1 Layout overview

```
[Title bar — 46px]
[Main area — flex row, height: calc(100vh - 46px)]
  [Left panel — 380px floating card]   [Center main — flex:1, overflow-y:auto]
```

No standalone toolbar row. Queue bar lives inside the left panel. No left sidebar (category nav sidebar is gone — never used on Generate tab).

### 1.2 Key decisions

**Window shell:** Wrap `.app` in `.window-shell` (`padding: 10px; background: #050506`). The app element gets `border-radius: 12px; overflow: hidden; box-shadow: var(--shadow)`. This gives the floating native-window feel.

**Subject only sticky:** `.compose-sticky` contains ONLY the Subject field. Extra neg is `.compose-scroll` (non-sticky, scrolls with tags). The `.main` area must be the scroll container (`overflow-y: auto; min-height: 0`) or sticky won't work.

**Per-category collapse:** Global Tags accordion removed. Each category has its own `▾` collapse toggle. Persisted in `localStorage['cpg-collapsed-cats']` (catId → boolean).

**Tag chip colors:** Active chips glow in their category color, not white:
```js
chip.style.borderColor = cat.color;
chip.style.color = cat.color;
chip.style.background = cat.color + '18';
chip.style.boxShadow = '0 0 0 1px ' + cat.color + '30';
```

**Queue bar:** Moved OUT of the send footer. Now lives as a thin strip near the top of the right panel, between the LoRAs strip and the recent strip.

**Recent strip:** 3 small thumbnails (36×46px, 7:9). Toggle show/hide via "recent ▴▾" button on the queue bar. Thumbnails come from `galleryImages.slice(0,3)`.

**Unified triggers:** Required triggers = always-visible orange `★` chips. Optional triggers = collapsed behind "Options ▾" button per LoRA. Active optionals surface inline. No separate tinted boxes.

**Send CTA:** Full-width button at very bottom of right panel. Below it: `Model · W×H · steps · seed` summary line.

### 1.3 Right panel structure (top to bottom)

```
1. LoRAs strip (lora-strip) — existing, unchanged
2. Queue bar (queue-bar) — NEW, thin status row
3. Recent strip (recent-strip) — NEW, toggleable 3-thumbnail row
4. Triggers section (triggers-section) — RESTRUCTURED
5. Send config (send-config) — same fields, new wrapper
6. Send footer (send-footer) — full-width CTA + meta row
```

### 1.4 New JS functions

**Per-category collapse:**
```js
function toggleCatCollapse(catId) {
  const saved = JSON.parse(localStorage.getItem('cpg-collapsed-cats') || '{}');
  saved[catId] = !saved[catId];
  localStorage.setItem('cpg-collapsed-cats', JSON.stringify(saved));
  document.getElementById('cat-' + catId)?.classList.toggle('collapsed', !!saved[catId]);
}
// Call applySavedCollapseState() at end of renderTagSections()
function applySavedCollapseState() {
  const saved = JSON.parse(localStorage.getItem('cpg-collapsed-cats') || '{}');
  Object.entries(saved).forEach(([id, v]) => {
    if (v) document.getElementById('cat-' + id)?.classList.add('collapsed');
  });
}
```

**Optional triggers popup:**
```js
let _optPopupLoraKey = null;

function openOptPopup(loraKey, buttonEl) {
  const triggers = parseTriggers(resolveTriggerSource(loraKey));
  const opts = triggers.filter(t => !t.req);
  const popup = document.getElementById('opt-popup');
  const chips = document.getElementById('opt-popup-chips');
  document.getElementById('opt-popup-title').textContent =
    (appData.loraNames?.[loraKey] || loraKey) + ' · optional';
  chips.innerHTML = '';
  opts.forEach(t => {
    const isOn = activeTriggers[loraKey]?.has(t.word);
    const chip = document.createElement('button');
    chip.className = 'trig-chip opt' + (isOn ? ' active' : '');
    chip.textContent = t.word;
    chip.onclick = () => {
      toggleTrigger(loraKey, t.word);
      chip.classList.toggle('active');
      renderTriggerChips();
    };
    chips.appendChild(chip);
  });
  const rect = buttonEl.getBoundingClientRect();
  popup.style.display = 'block';
  popup.style.top = (rect.bottom + 6) + 'px';
  popup.style.right = (window.innerWidth - rect.right) + 'px';
  _optPopupLoraKey = loraKey;
  setTimeout(() => {
    document.addEventListener('click', e => {
      if (!popup.contains(e.target)) closeOptPopup();
    }, { once: true });
  }, 0);
}
function closeOptPopup() {
  document.getElementById('opt-popup').style.display = 'none';
  _optPopupLoraKey = null;
}
```

**Recent strip:**
```js
function renderRecentStrip() {
  const thumbsEl = document.getElementById('recent-thumbs');
  if (!thumbsEl) return;
  const recent = galleryImages.slice(0, 3);
  thumbsEl.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const thumb = document.createElement('div');
    thumb.className = 'recent-thumb' + (recent[i] ? '' : ' empty');
    if (recent[i]) {
      const img = document.createElement('img');
      img.className = 'recent-thumb-img';
      img.src = `/gallery/image?folder=raw&file=${recent[i].name}`;
      img.onclick = () => switchTab('gallery');
      thumb.appendChild(img);
    }
    thumbsEl.appendChild(thumb);
  }
}
function toggleRecentStrip() {
  const strip = document.getElementById('recent-strip');
  const btn = document.getElementById('queue-recent-toggle');
  const hidden = strip.style.display === 'none';
  strip.style.display = hidden ? '' : 'none';
  btn.textContent = 'recent ' + (hidden ? '▴' : '▾');
  btn.classList.toggle('active', hidden);
}
```

**Send meta row:**
```js
function updateSendMeta() {
  document.getElementById('send-meta-model').textContent = currentModel;
  document.getElementById('send-meta-dims').textContent = cfg_w.value + '×' + cfg_h.value;
  document.getElementById('send-meta-steps').textContent = cfg_steps.value + ' steps';
  document.getElementById('send-meta-seed').textContent = 'seed ' + (cfg_seed.value || 'random');
}
// Call updateSendMeta() wherever send fields change
```

### 1.5 What stays unchanged in app.js (Generate)

`buildPos()`, `buildNeg()`, `parseTriggers()`, `resolveTriggerSource()`, `toggleTag()`, `sendToComfy()`, `openPromptExpand()`, `clearAll()` (add `activeTriggers` reset), `doRemixFromGallery()`, `switchTab()`, `loadLoras()`, `renderLoraTab()`, all gallery system.

### 1.6 Implementation order — Generate

1. CSS — all new Generate tokens and layout rules
2. Window shell wrap
3. Sidebar split (sidebar-top / sidebar-nav / sidebar-bottom-wrap)
4. Compose split (subject sticky / extra-neg scroll)
5. Tag categories — remove global accordion, add per-cat collapse headers
6. Right panel restructure: lora-strip → queue-bar → recent-strip → triggers → send-config → send-footer
7. Triggers — update `renderTriggerChips()` to unified layout + optional popup
8. Queue bar → update `pollQueueOnce()` targets
9. Recent strip → wire to gallery data
10. Send meta row → wire to field changes
11. Light mode pass
12. `node --check app.js` → full send + remix + clear test

---

## Part 2 — LoRAs Tab

**Reference:** `LoRA Tab Redesign.html`

### 2.1 Layout overview

```
[Title bar — 46px]
[Filter bar — floating strip, 10px margin]
[Collection tabs — lightweight tab strip]
[Card grid — full width]        [Detail panel — 440px floating card, right, sliding]
```

No left sidebar (replaced by collection tab strip — user doesn't nav the sidebar on this tab). Detail panel is an inspector, slides in from right.

### 2.2 Key decisions

**Card style A (Overlay):** Full 2:3 image, gradient overlay at bottom, all UI floats over the image. No solid bar below the image. Name + type pill + Enable + i buttons all live in the overlay. The old Triggers button on the card is removed — triggers live in the right panel on Generate tab.

**Card structure (layers):**
1. Image fill (`object-fit: cover; object-position: top`)
2. Bottom gradient: `linear-gradient(to top, rgba(0,0,0,0.94) 0%, transparent 100%)`, 68% height
3. Status badge top-left: square pill (`border-radius: 5px`), colored bg
   - Verified: `#22C55E` bg + `✓`
   - Testing: `#F59E0B` bg + `T`
   - Bad: `#EF4444` bg + `✗`
4. Top-right: Adult `⍜` (purple) + Fav `★` (gold + glow when active)
5. Name + type pill (bottom:36): `border-radius: 5px` for type pill, P badge inline
6. Enable + i bar (bottom:0): `background: rgba(0,0,0,0.62)`, Enable full flex-1 (orange when enabled), i fixed 26px

**Card borders:**
- Default: `1.5px solid ${typeColor}33` — subtle type-color hint
- Enabled: `1.5px solid ${orange}88` + outer glow

**Type colors:**
```
Character: #0891B2 (light) / #67E8F9 (dark)
Style:     #7C3AED / #A78BFA
Clothing:  #BE185D / #F472B6
Pose:      #059669 / #34D399
Concept:   #D97706 / #FB923C
```

**Filter bar (floating strip, replaces sticky toolbar):**
```
[⌕ search loras…]  [All · Favs]  |  [Verified: All ▾]  [Cleaned: All ▾]  →  [234 loaded]
```
The toolbar search + filter chips move into this floating bar. The drag handle (⠿ for window drag) can stay in the bar or be repurposed as a flex spacer zone.

**Collection tabs (below filter bar, not a sidebar):**
```
[All LoRAs 234]  [Stylish 8]  [Uncategorized 223]       [+ collection]
```
Active tab: `border: 1px solid var(--border2); background: var(--surface); font-weight: 500`.
Inactive: transparent border + muted text.

**Detail panel — Tabbed (right, 440px):**
Slides in from right. Three tabs: Overview / Notes / Settings.

| Tab | Contents |
|-----|----------|
| Overview | Image thumbnail (120×160px) · Status/fav/adult action row · Strength slider · Trigger words |
| Notes | Prompt prefix · Prompt suffix · Notes |
| Settings | CFG · Steps · Sampler · Best checkpoint · Show on models |

Panel header: LoRA name + type/status/CivitAI badges + ✕ close.
Panel footer (view mode): `Close` button. Edit mode: `Discard` / `Save`.
Edit button: `✎ Edit` — neutral color (not orange).

**Brut system:**
- Per-collection Brut flag — `⍜` icon on sidebar item when flagged, hover reveals the toggle
- Per-card Adult flag — `⍜` badge top-right of card image
- `⍜ Brut` toggle in sidebar bottom (or collapsed dot-rail when sidebar is narrow)
- When Brut filter OFF: hide collections with `brut: true` + cards with `adult: true`

**Sidebar (collection nav, collapsible):**
- `←` button collapses to dot-rail (just colored dots per collection), `→` expands
- Per-collection hover reveals: `⍜` brut toggle, `✎` rename, `✕` delete
- Brut-flagged collections show `⍜` badge next to their name

### 2.3 JS — what changed

**Collection Brut toggle:**
```js
// Collections is React state (not const) — each has { id, label, color, brut: boolean }
function toggleCollectionBrut(id) {
  setCollections(cols => cols.map(c => c.id === id ? {...c, brut: !c.brut} : c));
  saveAppData(); // persist via appData.loraCols
}
```

**Brut filter:**
```js
function isLoraVisible(lora) {
  if (!brutVisible && appData.loraData[lora.key]?.adult) return false;
  return true;
}
function isCollectionVisible(col) {
  if (!brutVisible && col.brut) return false;
  return true;
}
```

**Card render — enable button:**
The card body click should NOT enable/disable — only the Enable button. This is existing behavior; make sure it's preserved in the redesign.

### 2.4 What stays unchanged in app.js (LoRAs)

All LoRA data loading (`loadLoras()`), panel open/close/save, CivitAI link handling, drag-to-reorder within collections, search + filter logic, image lightbox, status badge system, context menu system, `parseTriggers()`, `migrateSingleTriggerLoras()`.

### 2.5 Implementation order — LoRAs

1. CSS — card style A (overlay), new filter bar, collection tabs, detail panel tabs
2. Card HTML — update `.lcard` to full-overlay structure
3. Filter bar — replace sticky toolbar with floating bar
4. Collection tabs — replace sidebar nav items with horizontal tab strip
5. Sidebar collapse — update collapse to dot-rail
6. Detail panel — restructure to tabbed layout
7. Brut per-collection — wire `toggleCollectionBrut()`, show ⍜ badge on flagged collections
8. Light mode pass
9. `node --check app.js` → card enable test, drag reorder test, panel save test

---

## Part 3 — Gallery Tab

**Reference:** `Gallery Tab Exploration.html` (artboard A = primary, artboard E = compare mode)

### 3.1 Layout overview

```
[Title bar — 46px]
[Filter bar — floating strip, 8px below title bar]
[Content area — flex row]
  [Left sidebar — 162px floating card]   [Grid + detail overlay — flex:1]
```

Detail panel slides in from the right edge of the grid area (not a separate panel — it overlays the grid via `position: absolute`).

### 3.2 Key decisions

**State indicators — colored borders (not tints, not badges):**
Borders are visible at every card size, don't obscure image content, and read cleanly against the warm bg.

| State | Border | Width |
|-------|--------|-------|
| Unreviewed | `rgba(0,0,0,0.13)` | 1px |
| Review | `#D97706` | 2px |
| Approved | `#16A34A` | 2px |
| Declined | `#DC2626` | 2px |

**Sidebar — Albums + Brut:**
162px floating card. Album/category navigation with colored dots + counts. Footer: `+ New album` button + `⍜ Brut` highlighted button (purple tint when active, plain when inactive — no toggle widget, just a button).

**Filter bar (replaces sticky toolbar):**
Floating strip. Left to right: search input · divider · state filter pills (All / Unreviewed / Review / Approved / Declined / Old 14d+) · spacer · Compare button (only when 2 selected) · Select toggle · Sort dropdown.

**Age filter + section divider:**
Two complementary components:
- `Old 14d+` filter pill in the bar — filters to only unreviewed images > 14 days old
- Section divider injected into the grid when viewing All/Unreviewed — a full-width `gridColumn: 1/-1` row with amber pill: `14+ days · unreviewed · N images`

**Select mode + bulk action bar:**
`Select` button in filter bar (turns orange when active). Selected cards show blue outline + checkbox badge. A floating action bar appears at the grid bottom-center when N > 0: `N selected · Approve · Review · Decline · Deselect all`.

**Detail panel (320px, overlays grid):**
`position: absolute; top:0; right:0; bottom:0` inside `.gallery-grid-wrap`. When open, grid gets `padding-right: 330px` (transition animated). Contents top to bottom: filename/meta header · image preview (7:9) · status buttons · category dropdown · tags · PNG metadata accordion · footer (→ Remix + ⊞ IMG2IMG).

**Compare mode (fullscreen overlay, shown when 2 selected + Compare clicked):**
Covers entire gallery view (sidebar, grid, panel). Dark background (`#1A1917`) — intentionally dark even in light mode so images are evaluated neutrally. 50/50 horizontal split. Corner labels A / B. Per-pane: filename + date + Approve/Review/Decline buttons. Header: "← Back to grid" + title + selection count.

**IMG2IMG button:**
Stub for now — wire to `doRemixFromGallery()` with a flag, or leave as `TODO`. Lives in the detail panel footer alongside Remix.

### 3.3 New CSS tokens

```css
body.light {
  /* Gallery state */
  --gstate-unreviewed-border: rgba(0,0,0,0.13);
  --gstate-review-border:     #D97706;
  --gstate-approved-border:   #16A34A;
  --gstate-declined-border:   #DC2626;
  /* Gallery geometry */
  --gallery-sidebar-w: 162px;
  --gallery-panel-w:   320px;
}
```

### 3.4 Key CSS

```css
/* Card base */
.gcard {
  position: relative; border-radius: 6px; overflow: hidden;
  aspect-ratio: 7 / 9; cursor: pointer;
  border: 1px solid var(--gstate-unreviewed-border);
  transition: border-color 0.12s, outline 0.12s;
}
.gcard.gcard-state-review   { border: 2px solid var(--gstate-review-border);   }
.gcard.gcard-state-approved { border: 2px solid var(--gstate-approved-border); }
.gcard.gcard-state-declined { border: 2px solid var(--gstate-declined-border); }
.gcard.selected             { outline: 2px solid var(--blue); outline-offset: 1px; }

/* Grid — fluid columns */
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 5px;
  align-content: start;
  transition: padding-right 0.2s ease;
}
.gallery-grid.panel-open { padding-right: 330px; }

/* Age divider */
.gallery-age-divider {
  grid-column: 1 / -1;
  display: flex; align-items: center; gap: 8px; margin: 4px 0 2px;
}
.age-divider-pill {
  display: flex; align-items: center; gap: 5px;
  padding: 3px 8px; background: var(--surface2);
  border-radius: 10px; border: 1px solid var(--border2);
  font-family: 'Space Mono', monospace; font-size: 8px;
  color: #92400E; letter-spacing: 0.08em; text-transform: uppercase;
}

/* Brut button (sidebar footer) */
.gallery-brut-btn {
  display: flex; align-items: center; gap: 7px; width: 100%;
  padding: 6px 10px; border-radius: 7px;
  background: transparent; border: 1px solid transparent;
  font-family: 'Poppins', sans-serif; font-size: 12px; font-weight: 500;
  color: var(--muted); cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.gallery-brut-btn[aria-pressed="true"] {
  background: rgba(124,58,237,0.09);
  border-color: rgba(124,58,237,0.30);
  color: #6D28D9;
}

/* Detail panel footer */
.gdp-footer { padding: 8px; display: flex; gap: 6px; flex-shrink: 0; border-top: 1px solid var(--border); }
.gdp-footer-btn {
  flex: 1; padding: 7px; text-align: center; border-radius: 7px;
  background: var(--surface); border: 1px solid var(--border2);
  font-family: 'Poppins', sans-serif; font-size: 11px; font-weight: 500; cursor: pointer;
}
.gdp-remix   { color: var(--orange); }
.gdp-img2img { color: var(--blue);   }

/* Compare overlay */
.gallery-compare-overlay {
  position: absolute; inset: 0;
  background: var(--bg); display: flex; flex-direction: column; z-index: 30;
}
.compare-img-wrap {
  flex: 1; position: relative; overflow: hidden;
  background: #1A1917; /* dark intentionally — see design notes */
}
.compare-img { width: 100%; height: 100%; object-fit: contain; object-position: center top; }
```

### 3.5 New JS functions

**Filter bar:**
```js
function setGalleryFilter(filter) {
  currentGalleryFilter = filter;
  document.querySelectorAll('.gfilter-pill').forEach(pill =>
    pill.classList.toggle('active', pill.dataset.filter === filter));
  renderGalleryGrid();
}
```

**Select mode + bulk bar:**
```js
let gallerySelectMode = false;
let gallerySelected = new Set();

function toggleGallerySelectMode() {
  gallerySelectMode = !gallerySelectMode;
  gallerySelected.clear();
  document.getElementById('gallery-select-btn').classList.toggle('active', gallerySelectMode);
  renderGalleryGrid();
}
function toggleGalleryCardSelect(filename, evt) {
  if (!gallerySelectMode) return;
  if (evt.shiftKey && lastSelectedFile) { rangeSelectGallery(lastSelectedFile, filename); }
  else {
    if (gallerySelected.has(filename)) gallerySelected.delete(filename);
    else gallerySelected.add(filename);
  }
  lastSelectedFile = filename;
  updateGalleryBulkBar();
  renderGalleryGrid();
}
function updateGalleryBulkBar() {
  const count = gallerySelected.size;
  document.getElementById('gallery-bulk-bar').style.display = count > 0 ? 'flex' : 'none';
  document.getElementById('bulk-count').textContent = count + ' selected';
  document.getElementById('gallery-compare-btn').style.display = count === 2 ? '' : 'none';
}
function clearGallerySelection() {
  gallerySelected.clear(); updateGalleryBulkBar(); renderGalleryGrid();
}
async function bulkSetState(state) {
  for (const f of gallerySelected) await setGalleryState(f, state);
  clearGallerySelection();
}
```

**Age divider in grid:**
```js
function renderGalleryGrid() {
  const grid = document.getElementById('gallery-grid');
  grid.innerHTML = '';
  let items = getFilteredGalleryItems();
  const cutoff = Date.now() - (14 * 24 * 60 * 60 * 1000);

  if (currentGalleryFilter === 'all' || currentGalleryFilter === 'unreviewed') {
    const recent = items.filter(img => img.mtime * 1000 >= cutoff || appData.galleryState?.[img.name]);
    const old    = items.filter(img => img.mtime * 1000 < cutoff && !appData.galleryState?.[img.name]);
    recent.forEach(img => grid.appendChild(createGalleryCard(img)));
    if (old.length) {
      grid.appendChild(createAgeDivider(old.length));
      old.forEach(img => grid.appendChild(createGalleryCard(img)));
    }
  } else {
    items.forEach(img => grid.appendChild(createGalleryCard(img)));
  }
}

function createAgeDivider(count) {
  const d = document.createElement('div');
  d.className = 'gallery-age-divider';
  d.innerHTML = `<div class="age-divider-line"></div>
    <div class="age-divider-pill">
      <span class="age-divider-dot"></span>
      14+ days · unreviewed · ${count} image${count !== 1 ? 's' : ''}
    </div>
    <div class="age-divider-line"></div>`;
  return d;
}
```

**Detail panel:**
```js
let currentGalleryFile = null;

function openGalleryDetail(filename) {
  currentGalleryFile = filename;
  document.getElementById('gallery-detail-panel').style.display = 'flex';
  document.getElementById('gallery-grid').classList.add('panel-open');
  populateGalleryDetail(filename);
}
function closeGalleryDetail() {
  document.getElementById('gallery-detail-panel').style.display = 'none';
  document.getElementById('gallery-grid').classList.remove('panel-open');
  currentGalleryFile = null;
}
function populateGalleryDetail(filename) {
  document.getElementById('gdp-filename').textContent = filename;
  document.getElementById('gdp-preview-img').src = `/gallery/image?folder=raw&file=${filename}`;
  const state = appData.galleryState?.[filename] || 'unreviewed';
  document.querySelectorAll('.gdp-state-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.state === state));
  populateGdpCategory(filename);
  renderGdpTags(filename);
  loadAndRenderGdpMetadata(filename);
}
```

**Compare mode:**
```js
function openCompareMode() {
  if (gallerySelected.size !== 2) return;
  const [fileA, fileB] = [...gallerySelected];
  document.getElementById('gallery-compare-overlay').style.display = 'flex';
  document.getElementById('compare-img-a').src = `/gallery/image?folder=raw&file=${fileA}`;
  document.getElementById('compare-img-b').src = `/gallery/image?folder=raw&file=${fileB}`;
  document.getElementById('compare-filename-a').textContent = fileA;
  document.getElementById('compare-filename-b').textContent = fileB;
  document.addEventListener('keydown', compareKeyHandler);
}
function closeCompareMode() {
  document.getElementById('gallery-compare-overlay').style.display = 'none';
  document.removeEventListener('keydown', compareKeyHandler);
}
function compareKeyHandler(e) { if (e.key === 'Escape') closeCompareMode(); }
function compareSetState(pane, state) {
  const [fileA, fileB] = [...gallerySelected];
  setGalleryState(pane === 'a' ? fileA : fileB, state);
}
```

**Brut button:**
```js
function updateGalleryBrutBtn() {
  const btn = document.getElementById('gallery-brut-btn');
  if (!btn) return;
  btn.setAttribute('aria-pressed', galleryBrutVisible ? 'true' : 'false');
  btn.classList.toggle('active', galleryBrutVisible);
}
// Call after every galleryBrutVisible change
```

**IMG2IMG (stub):**
```js
function doImg2ImgFromGallery(filename) {
  // TODO: wire to img2img workflow (future session)
  doRemixFromGallery(filename); // temporary — same as remix
}
```

### 3.6 What stays unchanged in app.js (Gallery)

`loadGallery()`, `galleryImages` array, `setGalleryState()`, `approveGalleryImage()`, `declineGalleryImage()`, `openGalleryLightbox()`, `renderGdpMetadata()`, gallery auto-poll (3s), `appData.galleryState` / `galleryCats` / `galleryTags`, context menu system, arrow-key navigation in detail panel.

### 3.7 Implementation order — Gallery

1. CSS — all new gallery CSS (filter bar, sidebar, cards with state borders, bulk bar, detail panel, compare overlay)
2. DOM structure — replace existing gallery toolbar + sidebar with new structure
3. Filter bar — wire filter pills
4. Sidebar albums nav — update to album-item format + Brut button footer
5. Card state borders — replace existing border/badge rules with new CSS classes
6. Select mode + bulk bar — update to floating bar, wire `toggleGalleryCardSelect()`
7. Detail panel — update to new structure, add Remix + IMG2IMG footer
8. Age section divider — update `renderGalleryGrid()` to inject divider
9. Compare mode — add overlay HTML + `openCompareMode()` / `closeCompareMode()`
10. Light mode pass — verify all gallery elements respond to `body.light`
11. Test — approve batch, decline + process, compare 2, Brut toggle, filter all states, age divider visibility

---

## Part 4 — Cross-Tab Notes

### Implementation order (across all tabs)

Implement in this order to minimize breakage at each step:

1. **Shared CSS tokens** — add all `body.light` vars to `comfy-prompt-gen.html`. Verify dark mode still works.
2. **Title bar** — update to new structure with tab buttons, right controls. All tabs share this.
3. **LoRAs tab** — least dependent on shared state, safest to start. Card overlay + filter bar + collection tabs + detail panel.
4. **Generate tab** — right panel restructure is the riskiest; do this after LoRAs is stable.
5. **Gallery tab** — depends on `galleryImages` data that Generate's recent strip also uses. Do last.
6. **Light/dark toggle** — wire `body.light` class toggle to `☀` button. Test both modes.
7. **Full end-to-end test** — send to ComfyUI → image lands in gallery → remix from gallery → check all three tabs in both modes.

### Shared pitfalls

- **Sticky + scroll:** `position: sticky` requires a scrolling ancestor. If `body`/`html` scroll, sticky breaks. Use explicit scroll containers (`overflow-y: auto; min-height: 0`) on the right elements.
- **Light mode specificity:** Inner panel elements may need `body.light .X { ... !important }` if they have their own `background` set. Check anything inside `.footer`, `.sidebar`, `.gallery-detail-panel`.
- **`node --check app.js`** — run this before every ship. The recurring orphaned-function-body bug (inserting near a function declaration eats the `function` keyword) has bitten us multiple times.
- **Grid column count** — Gallery uses `repeat(auto-fill, minmax(130px, 1fr))`. Do NOT hardcode a column count. The auto-fill handles all viewport sizes.
- **Compare mode dark bg** — `background: #1A1917` in compare panes. Do not invert for light mode — it's intentionally dark for neutral image evaluation.
- **IMG2IMG** — stub only. Wire to `doRemixFromGallery()` temporarily. Full implementation is a future session item.

---

## Part 5 — Files Delivered

| File | What it is |
|------|------------|
| `Generate Tab Exploration.html` | Generate tab — 17 artboards across 5 rounds of iteration. Final direction is the most recent artboards. |
| `LoRAs Tab Exploration.html` | LoRAs tab — 8 artboards including full card states reference and real preview images. |
| `Gallery Tab Exploration.html` | Gallery tab — 5 artboards. **Artboard A** is the primary design (sidebar + colored borders + detail panel). **Artboard E** is compare mode. |
| `FULL-HANDOFF.md` | This document |
| `DESIGN_NOTES.md` | Full session notes: complete palette, type scale, all design decisions with rationale, key decisions log |
| `uploads/CONTEXT.md` | App architecture, data model, full session history — essential reading before touching app.js |

---

*End of handoff.*
