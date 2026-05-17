# Prompt Gen Roadmap
*Updated: May 17, 2026*

Everything through Phase 3.5 is shipped and tested. This is what's next.

---

## Wave 1 — Tighten Up + Quick Wins

Get the house in order and knock out a couple satisfying small builds.

- [x] **Rebuild the .app** ✓
- [x] **Top bar drag region** ✓
- [x] **Fix CivitAI links** ✓ — editable URL field in LoRA panel (edit mode)
- [x] **Collection-level Brut** ✓ — mark a LoRA collection as Brut to hide it from sidebar nav and grid when brut is off. ⍜ button on hover in sidebar, stored in `appData.loraColBrut`.
- [x] **Tab visibility in Settings** ✓ — checkboxes for Checkpoints/History/Presets in Settings. Persists in `appData.settings.hiddenTabs`.
- [x] **Embeddings** ✓ — on/off chips in the right panel (pinned to bottom of triggers section). Each has a pos/neg target flag. `embedding:name` syntax injected into the appropriate prompt. + button to add new ones, right-click to remove. State persists in `appData.embeddings`.
- [ ] **LoRA library cleanup** (medium, housekeeping) — go through all LoRAs, clean up display names, set trigger word markers, fill in missing notes. Not a code task, just a grind session with the app open.

---

## Wave 2 — Gallery Gets Smart

The gallery works for triage. Now make it good for thinking.

- [x] **Time filters** ✓ — cycle button in gallery toolbar: All time → Today → 7 days → 30 days. Works alongside state filters.
- [x] **Image renaming** ✓ — rename files from gallery detail panel. Updates galleryState, galleryCats, galleryAdult, galleryTags everywhere. Character validation (letters, numbers, dash, underscore, space only). Duplicate check across both raw + approved folders.
- [x] **Gallery tags** ✓ — multiple freeform tags per image (separate from categories). Stored in `appData.galleryTags`. Tag chips in detail panel, + button to add, click ✕ to remove. Comma-batch add, lowercase normalized, dedup. Tags survive rename.
- [x] **Gallery search** ✓ — search bar in gallery toolbar, matches filename and tags. Integrates with all existing filters (state, time, brut). Clear button. Consistent 160px width with LoRA search.
- [x] **Compare mode** ✓ — select exactly 2 images, Compare button appears in bulk bar. Opens fullscreen 50/50 split with images side by side, state badges, and Approve/Review/Decline controls under each. Escape to close. Video file support.

---

## Wave 3 — Power User

Features for when you're in the zone and generating fast.

- [x] **Unreviewed age badges + backlog nagging** ✓ — corner ribbons on old unreviewed cards (amber 7–13d, red 14d+), ⏱ count on Gallery tab, toast on launch. Plus gallery state toggle rework (context menu + detail panel).
- [x] **Queue management panel** ✓ — floating vertical panel slides out left of right panel. Shows running + pending jobs with checkpoint display names, per-job cancel, auto-refreshes on WS events. "queue" button in queue strip toggles it.
- [x] **Generation timing** ✓ — time each generation via websocket (start on first executing message, stop on completion). Duration stored in `appData.galleryTiming[filename]`, shown in gallery detail (⏱ badge next to file size + Time row in metadata params grid). Survives renames.
- [x] **img2img** ✓ — use a gallery image as a starting point. img2img button on gallery detail loads remix settings + sets source image. Cyan strip in Generate tab with thumbnail, denoise slider (default 0.75), clear button. Server uploads gallery image directly to ComfyUI input folder. Workflow swaps EmptyLatentImage for LoadImage→VAEEncode, KSampler uses slider denoise.
- [x] **Auto-tagging from metadata** ✓ — parse PNG metadata to auto-tag gallery images by LoRA used and checkpoint. Runs on generation completion + when viewing detail panel (catches existing images). Tracked in `appData.galleryAutoTagged` to avoid re-adding user-removed tags.
- [ ] ~~**Generation history**~~ — deprioritized, gallery + remix already covers this workflow
- [ ] ~~**LoRA combos / recipes**~~ — deprioritized, not a pain point yet. Revisit if Daniel starts reusing the same LoRA stacks frequently

---

## Wave 4 — Video Generation

Build prompt-crafting support for video models, then generate-and-preview.

- [x] **Video prompt guidance** ✓ — motion hint chips (14 camera/motion terms), video-specific prompt textarea with motion-oriented placeholder. Separate from image prompt.
- [x] **Video workflow templates** ✓ — Wan 2.2 5B TI2V workflow built and working. `buildVideoWorkflow()` constructs full node graph: UNETLoader → ModelSamplingSD3(shift:8) → KSampler(euler/simple), CLIPLoader(wan) → pos/neg encode, VAELoader → Wan22ImageToVideoLatent + VAEDecode → CreateVideo → SaveVideo. Successfully generating from the app.
- [x] **Video generation UI** ✓ — Image|Video sub-tab toggle, video send config panel (model/W/H/frames/fps/steps/cfg/seed with dice+lock), mode persists across reload, meta bar live-updates on input. Gallery already supports mp4 playback.
- [ ] **Image-to-video** (medium) — drop zone UI exists but not wired. Needs: gallery picker or file drop, CLIP vision encoder model download, pass start_image through Wan22ImageToVideoLatent node.
- [ ] **Video in gallery** (small) — verify generated videos appear in gallery grid, test video playback from gallery detail. Gallery code already handles mp4/webm/mov but needs confirmation with app-generated videos.
- [ ] **Additional video models** (future) — UI has a model dropdown ready for more entries. Each model would need its own workflow builder function.

---

## Wave 5 — The Redesign

Step back and rethink the whole thing.

- [ ] **Virtual scrolling for gallery** (medium, prep) — performance groundwork for when the image count gets into the thousands. Swap the DOM grid for a virtualized renderer. Do this before the redesign so the new design is built on solid perf foundations.
- [ ] **Portrait monitor UX** (large) — the app is "hit or miss" on the vertical display. Audit all three tabs at narrow-but-tall viewport sizes. Likely needs responsive breakpoints, maybe auto-collapse sidebar, maybe different grid column counts. Bundle with the redesign so Claude Design only has to do it once.
- [ ] **Full app redesign via Claude Design** (large) — take the whole app through Claude Design for a fresh visual pass. The current layouts are functional but grew organically. Input package: screenshots of all tabs, workflow descriptions, design constraints, reference aesthetic. Output: interactive HTML mockup, then Claude Code implements it.

---

## Not scheduled (ideas bank)

Stuff that's come up but isn't committed to a wave yet. Pull from here when a wave needs filling.

- Settings wiring — server.js reads folder paths from appData.settings instead of hardcoded values
- LoRA popover improvements — richer info in the metadata chip popover
- Gallery notification/reminder for old unreviewed backlog
- Workflow templates — save and reuse full generation configs beyond just LoRA combos
- Inpainting support — mask regions of an image and regenerate just those areas
- Export/share approved collections
- **Remix tag pill sync** — when remixing an image, parse the prompt and auto-select matching tag chips in the Generate tab so the pills reflect what's in the prompt
- **LoRA panel overview layout** — thumbnail (140px) feels oversized after panel narrowed to 520px. Rethink the image-beside-controls layout — maybe shrink to 110-120px, or try image-above-controls. Good candidate for Claude Design.
- ~~**img2img denoise hint labels**~~ ✓ — shipped session 28, zone labels (refine/remix/reimagine) + hover tooltip
- **Send config accordion** — collapse W/H/Steps/CFG/Sampler/Scheduler into a collapsible section with a summary line like "896×1152 · 30 steps · CFG 5" when collapsed. Checkpoint stays outside (always visible). State persists in appData.settings. Frees ~80px in the right panel.
- **Remix/img2img tag behavior audit** — review what auto-clears and auto-assigns when entering remix or img2img mode: which tag pills show as enabled, whether LoRA triggers persist in the subject after removing the LoRA, overall consistency of prompt state after remix. Goal: make the behavior predictable and clean.
- **Chaos Sets** — a "Chaos" button in the Generate tab that produces 4-5 intentionally mismatched descriptive words (tension between texture, state, spatial, action, mood) to inject into prompts and see what the model does with them. Individually toggleable chips, re-roll, optional mood steering (horror, organic, glitch, etc). Two-tier approach: built-in word pools for instant offline chaos, optional Claude API integration for infinite generative variety. Inspired by Daniel's old ChatGPT "chaos sets" workflow for stretching models into unexpected territory. Fits the aphantasia workflow perfectly — throw chaos at the model, react to what comes back.

---

## Done

Everything below here is shipped and tested.

- [x] Phase 1 — LoRA browser, collections, status system, detail panel
- [x] Phase 2 — Menubar tray app, ComfyUI start/stop/hide
- [x] Phase 2.5 — PNG metadata reading from ComfyUI PNGs
- [x] Phase 3 — Send to ComfyUI (full workflow builder, multi-LoRA chaining)
- [x] Phase 3.5 — WebSocket live progress bar
- [x] Gallery Phase 1 — grid, detail panel, 4-state review, filters
- [x] Gallery Phase 2 — bulk select, categories, Brut filter, card sizes
- [x] Remix from gallery — load prompt/LoRAs/settings back into Generate
- [x] LoRA metadata popover — click LoRA chip in gallery metadata to preview
- [x] Trigger chip system — required/optional markers, auto-migration
- [x] Batch send + multi-model checkpoints
- [x] v5 Generate tab redesign (CSS Grid 3-column layout)
- [x] LoRA tab redesign (Card Style A, tabbed panel, demo mode)
- [x] ComfyUI auto-launch on startup
- [x] appData consolidation (scattered loraX maps → single loraData blob)
- [x] Proxy removal (Python → Node.js server in Electron)
- [x] Collection-level Brut — hide entire LoRA collections when brut is off
- [x] Tab visibility in Settings — toggle Checkpoints/History/Presets from Settings
- [x] Gallery video + external media — jpg/webp/gif/mp4/webm/mov support, video lightbox, ↗ external source badge
- [x] Embeddings — on/off chips for textual inversions (lazypos/lazyneg), pos/neg target, pinned to bottom of triggers panel
- [x] Queue stop/clear buttons — interrupt current gen + flush pending queue from within the app
- [x] Menu bar progress — generation % and queue count shown next to tray icon via IPC bridge (preload.js → main.js)
- [x] Wave 2 complete — image renaming, gallery tags, gallery search, compare mode, back-to-top button, toolbar cleanup
- [x] Wave 4 core — video generation UI, Wan 2.2 5B workflow, motion hints, video send config, queue self-heal
