# Prompt Gen — Design Session Notes
*Claude Design session — May 17, 2026*
*Reference files: `Generate Tab Exploration.html`, `LoRAs Tab Exploration.html`*

---

## What this session covered

Full visual redesign exploration for the Generate and LoRAs tabs. Gallery tab is next. The goal: make the app feel like a real Mac app (Craft/Things aesthetic) rather than a skinned web page. Light mode is now the primary direction.

---

## Design Language Established

### Palette

**P1 — Warm Light (primary)**
```
--bg:        #F5F4F0   /* warm off-white canvas */
--chrome:    #EDEBE6   /* title bar / tab bar */
--panel:     #FFFFFF   /* floating panel surfaces */
--surface:   #E6E4DE   /* inputs, active nav items */
--surface2:  #DFDDDA   /* chip backgrounds, inputs */
--border:    rgba(0,0,0,0.08)
--border2:   rgba(0,0,0,0.14)
--text:      #1A1917
--muted:     #78756E
--muted2:    #B2B0A9
--orange:    #D96A14   /* primary accent — active states, send button */
--green:     #047857   /* ILLUS active, verified status */
--amber:     #92400E
--blue:      #1D4ED8
--red:       #B91C1C
--shadow:    0 0 0 1px rgba(0,0,0,0.06), 0 8px 40px rgba(0,0,0,0.12)
```

**P2 — Midnight (dark)**
```
--bg:        #090909
--chrome:    #0f0f11
--panel:     #131315
--surface:   #161618
--surface2:  #1d1d20
--border:    rgba(255,255,255,0.07)
--border2:   rgba(255,255,255,0.13)
--text:      #E8E8E6
--muted:     #6B6B72
--orange:    #FB923C
--green:     #34D399
--amber:     #F59E0B
--blue:      #818CF8
--red:       #F87171
--shadow:    0 0 0 1px rgba(255,255,255,0.05), 0 8px 48px rgba(0,0,0,0.8)
```

### Type scale
- Poppins 400/500/600 for UI text
- Space Mono for all monospace: labels, badges, counts, metadata, code-adjacent content
- Category/section labels: Space Mono 9px, `letter-spacing: 0.12em`, `text-transform: uppercase`

### Floating panel system
Every panel is a floating card:
```css
border-radius: 12px;
box-shadow: var(--shadow);
border: 1px solid var(--border);
background: var(--panel);
```
Panels use `margin: 10px` to float off the edges. Left panels: `margin: 10px 0 10px 10px`. Right panels: `margin: 10px 10px 10px 0`.

### Panel placement logic
- **LEFT panel** = functional/active tool (Generate tab: triggers + send config)
- **RIGHT panel** = inspector/reader (LoRAs detail, Gallery detail)

---

## Title Bar

Single 46px bar. Contains everything — no separate toolbar row.

**Left side (left to right):**
1. Traffic lights (standard macOS, no pill treatment)
2. 1px divider
3. Tab buttons: Generate | LoRAs ○N | Gallery ○N

**Tab button style (button-style, NOT underline):**
```css
padding: 4px 13px;
border-radius: 6px;
border: 1px solid var(--border2);   /* active only */
background: var(--surface);          /* active only */
color: var(--text);                  /* active */
font-size: 13px;
font-weight: 500;                    /* active */
```
Inactive tabs: `border: transparent`, `background: transparent`, `color: var(--muted)`.

**Right side (right to left, 16px from edge):**
- Portrait view toggle `⊡`
- 1px divider
- `⍜ Brut` button (blue tint when active)
- `☀` theme toggle
- 1px divider
- `IMG` / `VID` mode toggle (button style, IMG active on Generate tab)
- 1px divider
- `SDXL` / `PONY` / `ILLUS` model selector (green border+tint for active)

Right controls align at 16px from right edge (matches queue bar margin).

---

## Generate Tab

### Layout
```
[Title bar — 46px]
[Queue bar — floating strip, 8px 16px margin from edges]
[Main area — flex row]
  [Left panel — 380px floating card]   [Center — full width, no sidebar]
```

No left sidebar. The category nav sidebar is gone entirely — the user never used it on this tab.

### Global Queue Bar
Full-width floating strip between title bar and content. Same floating card treatment as other panels but rectangular:
```
Queue  3 · generating · 45%  [progress bar]  [■ stop]  [✕ clear]  [jobs ▴]
```
When idle: hidden or shows "0 jobs · ready".

### Left Panel
Floating card, 380px wide. Top to bottom:

1. **Recent strip** — 3 small thumbnails (34×44px, 7:9 ratio), clear button
2. **LoRAs / Triggers section** (scrollable, `flex: 1`)
   - "LoRAs" label + "N active" orange pill + green connection dot
   - "Triggers" label with orange dot
   - Per-LoRA block: name + strength on one row, trigger chips on next row
   - Required triggers: `★` prefix, orange border/tint, non-interactive
   - Optional triggers: dim by default, blue when active
   - "Options N/N ▾" button for optional triggers popup
   - Spacer (`flex: 1`) pushes embeddings to bottom
   - **Embeddings + Dude row (bottom-justified):** `+ lazypos` / `− lazyneg` / `♂ dude`
3. **Send config — always visible:**
   - Checkpoint dropdown (always visible, never collapsed)
   - Seed input + 🎲 dice + 🔒 lock buttons (always visible)
   - Dimensions accordion: collapsed = single summary line "896×1152 · 30 steps · CFG 5 · euler ▾", expanded = W/H/Steps/CFG/Sampler/Scheduler fields
4. **Send footer:**
   - `×N` batch count + `→ Process N jobs` orange button (full width)
   - Status line: "● ComfyUI connected · ready" in green (replaces the old dimensions meta — that info is already visible in the panel)

### Center Area
Full width (no sidebar). Content:
1. `IMAGE` / `VIDEO` toggle buttons (Space Mono, 11px)
2. **Subject** — sticky top area. Label row + expand button. Textarea.
3. **Extra Neg** — non-sticky, scrolls with content. Red label. Monospace textarea.
4. **Tag categories** — each has:
   - Header: colored dot + category name pill + management controls (`+ tag`, `✎ edit`, `— delete` buttons always visible)
   - Tag chips: `flex-wrap` grid, 18px border-radius, colored border+tint when active (using category color, not white)
   - Edit mode: chips show `⠿` drag handle + `×` delete button. Dashed `+ add tag…` chip at end.
   - Right-click on active chip: weight popup with `( ) wrap` button + slider + quick presets (0.5/0.8/1.0/1.2/1.5)
   - `+ Add category` dashed button at bottom of all sections

---

## LoRAs Tab

### Layout
```
[Title bar — 46px]
[Filter bar — floating strip]
[Collection tabs — lightweight tab strip, no sidebar]
[Card grid — full width]           [Detail panel — 440px floating card, right]
```

### Filter Bar
Floating strip (same treatment as queue bar):
```
[⌕ search loras…]  [All · Favs]  |  [Verified: All ▾]  [Cleaned: All ▾]  →  [234 loaded]
```

### Collection Tabs
Lightweight tab strip below filter bar. NOT a sidebar:
```
[All LoRAs 234]  [Stylish 8]  [Uncategorized 223]       [+ collection]
```
Active tab: `border: 1px solid var(--border2)`, `background: var(--surface)`, `font-weight: 500`.

### LoRA Card Design
2:3 aspect ratio. Single container — **all elements absolutely positioned over the image**. No solid bar below the image.

**Card structure (layers top to bottom):**
1. Image fill (`object-fit: cover; object-position: top`)
2. Gradient texture overlay (subtle diagonal stripe: `repeating-linear-gradient(45deg, rgba(255,255,255,0.018)...)`)
3. Bottom gradient: `linear-gradient(to top, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.55) 40%, transparent 100%)`, height 68%
4. **Status badge (top-left):** Square pill, `border-radius: 5px`, colored bg, white text
   - Verified: `#22C55E` bg, `✓`
   - Testing: `#F59E0B` bg, `T`
   - Bad: `#EF4444` bg, `✗`
5. **Top-right:** Adult `⍜` icon (purple, if flagged) + fav `★` (gold+glow if active, dim if not)
6. **Name + type row (bottom:36):**
   - LoRA name: white text, 11px, ellipsis overflow, text-shadow
   - Type pill: square (`border-radius: 5px`), type color at 66% opacity bg + 88% opacity border — **more opaque than before**
   - P badge: inline right of type pill, small square pill with white-glass treatment
7. **Enable + i bar (bottom:0):** `background: rgba(0,0,0,0.62)`, floating over image
   - Enable button: full flex-1, orange tint+border when enabled
   - i button: fixed 26px, same glass treatment

**Card border:**
- Default: `1.5px solid ${typeColor}33` — subtle type color hint
- Enabled: `1.5px solid ${orange}88` + outer glow

**Type colors:**
```
Character: #0891B2 (light) / #67E8F9 (dark)
Style:     #7C3AED / #A78BFA
Clothing:  #BE185D / #F472B6
Pose:      #059669 / #34D399
Concept:   #D97706 / #FB923C
```

### Detail Panel (right, sliding in)
440px floating card from right side. Tabs: Overview / Notes / Settings.

**Overview tab:**
- Header: LoRA name + type/status/CivitAI badges + ✕ close
- 2-col layout: 120×160px image thumbnail | action buttons (✓/T/✗/★/⍜) + strength slider + filename
- Trigger words (no "click to copy" label — auto-copies to app)
- Notes
- Footer: `✎ Edit` + `Close` buttons

---

## What's Still Needed

### Gallery Tab (next session)
Needs full design. Key characteristics from CONTEXT.md:
- Triage/culling tool, NOT a display surface
- Uniform image grid with colored border states: unreviewed (no border), review (amber), approved (green), declined (red)
- Bulk select (Cmd/Shift+click)
- Compare mode (2 images → 50/50 split)
- Categories with colored dots (sidebar that IS used)
- Search + tag filtering
- Age ribbons on old unreviewed images
- Detail panel (right) with: filename, date, size, status buttons (Review/Approve/Decline), category dropdown, tags, PNG metadata accordion, IMG2IMG button

Design considerations:
- The "colored border" system needs to look good in light mode — currently designed for dark
- The sidebar (gallery categories) IS actually used — keep it, probably as a floating left card like LoRAs collections
- Or: category tabs strip like LoRAs? TBD.
- Compare mode fullscreen overlay needs design

### After Gallery — Implementation Handoff
Write full `DESIGN_HANDOFF.md` with:
- Complete DOM structure for all tabs
- All new CSS tokens
- Changed JS functions
- Implementation order recommendation
- Light/dark toggle implementation (`body.light` class approach already exists)

---

## Reference Files

| File | Contents |
|------|---------|
| `Generate Tab Exploration.html` | 17 artboards across 5 rounds of iteration |
| `LoRAs Tab Exploration.html` | 8 artboards including card states reference + real images |
| `design-canvas.jsx` | Pan/zoom canvas framework (keep in project root) |
| `tweaks-panel.jsx` | Tweaks panel component (keep in project root) |

---

## Key Decisions Log

- **No Generate tab sidebar** — user never used it. Replaced with: tag management inline on category headers, clear all + brut + theme in title bar, model selector in title bar.
- **Light mode is primary** — dark mode exists but light is the designed-first direction.
- **Floating panels everywhere** — every panel is a floating card with shadow + border-radius, floating with 10px margin off edges. Not flush to edges.
- **Panel on LEFT for active tools** (Generate), **panel on RIGHT for inspectors** (LoRAs, Gallery).
- **Queue bar is global** — not inside the panel. Full-width strip between title bar and content.
- **Send config accordion** — checkpoint + seed always visible, dimensions/steps/sampler/scheduler collapsed to single summary line, expandable inline.
- **"ComfyUI connected · ready" replaces dimensions meta** below send button — the old meta text was redundant since all that info is already visible above in the panel.
- **LoRAs collections → tab strip** — no sidebar. Same rationale as Generate: user rarely used it for navigation.
- **Detail panel stays RIGHT on LoRAs** — it's an inspector, not an active tool.
- **LoRA card: all UI floats over image** — no solid bar below the image. Enable + i buttons are a dark semi-transparent overlay at card bottom.
- **Type pill is square (border-radius: 5px)** — matches status badge and all other pills.
- **Portrait view toggle in title bar** — `⊡` icon, rightmost button in right controls group.
- **Scrollbars hidden** — use `scrollbar-width: none` + `::-webkit-scrollbar { display: none }`.
