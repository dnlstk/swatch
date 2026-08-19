# Prompt Gen Roadmap
*Updated: July 2, 2026*

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
- [x] **LoRA tab design review (CD round 2)** ✓ — implemented all 19 edits from CD's second review pass. Card visual polish (status badges, brut borders, frosted glass buttons, cleaned indicator). Detail panel button row redesigned to overlay on portrait image. Status dropdown replaced 3 buttons with compact single-button + dropdown. Collection tabs with drag reorder. Vibe-based collections (151/193 sorted). Section headers restyled.
- [x] **Gallery tab design review** ✓ — full redesign shipped (sessions 37-39). Sidebar removed, horizontal album tabs, 170px cards, 400px detail panel with right-click status, fav star + brut overlay on detail image, tag autocomplete, PNG metadata accordion. 5 rounds of polish with Daniel: back-to-top restyled, queue bar height matched, brut border tuned, drag lock, user-select disabled.
- [x] **Full app redesign via Claude Design** ✓ — full visual pass across all tabs completed

---

## Wave 6 — CivitAI Direct Integration

Remove the LoRA Manager dependency entirely and manage models from within the app.

- [x] **Phase 1: Data source swap** ✓ — server.js now scans the filesystem directly for .safetensors files + .metadata.json sidecars instead of hitting LoRA Manager's API. New `/local/` endpoints for listing and preview serving. In-memory caching with `/local/refresh`. LoRA Manager Port removed from Settings. All 234 LoRAs and 16 checkpoints loading correctly.
- [x] **Phase 2: Install/uninstall LoRAs** ✓ — CivitAI API key in Settings, install dialog with URL input + preview, streaming download with progress bar, atomic .tmp→final rename, .metadata.json sidecar written on install, preview image downloaded. Uninstall button in detail panel Settings tab with confirm dialog. Auto-scroll to newly installed LoRA + opens detail panel. Handles both civitai.com and civitai.red domains (separate model IDs). New endpoints: `/local/loras/install`, `/local/loras/uninstall`, `/local/loras/install-progress`, `/local/loras/preview-info`.
- [x] **Phase 3: Browse CivitAI** ✓ — search CivitAI from within the app. Library/Browse mode toggle on LoRA tab, search with base model filter + sort + NSFW toggle, browse card grid, detail panel with version selector + image carousel + install button. Cursor-based pagination, race condition prevention, CivitAI CDN referrerpolicy fix. 31 checklist items tested and passing.
- [x] **Handle LoRAs without metadata** ✓ — auto-detect on load, SHA256 hash, CivitAI by-hash API lookup, write sidecar. Minimal sidecar on miss to prevent re-hashing.
- [x] **Share to CivitAI** ✓ — direct CivitAI API upload (presigned S3 + tRPC post creation). Resource detection via .metadata.json sidecar SHA256 hashes + modelVersionId. ComfyUI tool attribution via `image.addTools` (toolId 86). NSFW flag for Brut images. Gallery shared indicator (green ↗ badge on cards, tracked in `appData.galleryShared`). Fully tested: basic flow, metadata pre-fill, NSFW, resources, tool, non-PNG rejection, no-metadata images.

---

## Wave 7 — LoRA Training (IN PROGRESS, session 51)

Train LoRAs from inside the app. Starting with **style/aesthetic** LoRAs. The app owns the tedious 80% (curate → caption → surface the result); a training engine does the crunch. Building engine-neutral first — engine choice (Draw Things vs in-app Kohya) deferred.

- [x] **Phase 1 — Dataset + caption builder** ✓ (session 51) — new "Train" tab. "◆ Add to Training" bulk button in gallery. Training sets in `appData.trainingSets`. Per-image caption grid with content-not-style guidance banner. Config (trigger, base ckpt, rank, steps, res). `POST /training/export` writes `_tools/training-sets/<name>/img/` = images + `.txt` caption sidecars (trigger prepended) + `config.json`. Universal handoff folder. **Not yet tested.**
- [ ] **Phase 1b — Auto-caption** (next) — install WD14 tagger node in ComfyUI, caption via a ComfyUI workflow (reuse existing build+queue plumbing), fill the caption boxes automatically. This kills the hand-captioning slog. Button already stubbed in the UI.
- [ ] **Phase 1 polish** — bigger caption-grid preview / lightbox (matters extra with aphantasia — he needs to *see* what he's describing).
- [ ] **Phase 2 — Pick + wire the training engine.** Draw Things (native Metal, recommended, app hands off the folder) OR in-app Kohya sd-scripts (needs fp32 on MPS, slower, but all-in-one). ComfyUI training nodes are CUDA-only — ruled out on Mac.
- [ ] **Phase 3 — Close the loop** — trained `.safetensors` lands in the LoRA folder, app already shows it. Maybe a "training runs" history + one-click retrain.

---

## Not scheduled (ideas bank)

Stuff that's come up but isn't committed to a wave yet. Pull from here when a wave needs filling.

- **CivitAI MCP integration** — CivitAI launched an MCP server (mcp.civitai.com/mcp, 53 tools) and a Generation Skill with cloud compute (Flux, Veo 3, Kling, 11+ video engines). Two angles worth exploring: (1) cloud generation for models you can't run locally — route video tab to CivitAI compute when selecting Veo 3/Kling, same prompt UI different backend, costs credits; (2) rate/comment on LoRAs from the detail panel Settings tab without going to the website. Most of what we do (browse/install/share) already hits their REST API fine — the MCP angle is mainly additive for cloud compute and social actions.
- Settings wiring — server.js reads folder paths from appData.settings instead of hardcoded values
- LoRA popover improvements — richer info in the metadata chip popover
- Gallery notification/reminder for old unreviewed backlog
- Workflow templates — save and reuse full generation configs beyond just LoRA combos
- Inpainting support — mask regions of an image and regenerate just those areas
- Export/share approved collections
- **Remix tag pill sync** — when remixing an image, parse the prompt and auto-select matching tag chips in the Generate tab so the pills reflect what's in the prompt
- **LoRA panel overview layout** — thumbnail (140px) feels oversized after panel narrowed to 520px. Rethink the image-beside-controls layout — maybe shrink to 110-120px, or try image-above-controls. Good candidate for Claude Design.
- ~~**img2img denoise hint labels**~~ ✓ — shipped session 28, zone labels (refine/remix/reimagine) + hover tooltip
- ~~**Send config accordion**~~ ✓ — shipped in redesign
- **Remix/img2img tag behavior audit** — review what auto-clears and auto-assigns when entering remix or img2img mode: which tag pills show as enabled, whether LoRA triggers persist in the subject after removing the LoRA, overall consistency of prompt state after remix. Goal: make the behavior predictable and clean.
- **LoRA detail image carousel** — horizontal scrolling sample images in the library LoRA detail panel, similar to how browse detail already works. Would replace the single static preview.
- ~~**Upscale workflow**~~ ✓ — shipped session 47. One-click 2× upscale from gallery detail using 4x-UltraSharp model. Auto-archives original to `originals/` folder, inherits all properties (status, brut, tags, favorites, categories), preserves metadata for remix/share. HD badge on upscaled cards. Batch upscale still a future option.
- ~~**Upscale + Share integration**~~ ✓ — shipped session 48. Prompt to upscale before sharing, gold shared badge for upscaled+shared, HD badge hidden once shared. Also fixed upscale filename collisions (unique prefix per source image) and added manual Mark Shared in context menu.
- **Originals folder cleanup** — the `originals/` folder is a safety net while upscale is new. Once trusted: either auto-purge files older than 30-60 days, or skip archiving entirely and just delete originals on upscale. No third-party app needed.
- **Batch upscale** — select multiple images → upscale all. Queue them sequentially, toast with progress count.
- **Most Used LoRAs** — small section at the top of the LoRA tab showing 3-5 most frequently used LoRAs. Track a usage counter (bump each time a LoRA is added to a prompt), display as a quick-access row above the main grid.
- **Chaos Sets** — "Chaos" button in the Generate tab that produces 4-5 intentionally mismatched descriptive words to inject into prompts. Picks one word from each of 5 dimensions (texture/material, state/condition, spatial/scale, action/force, mood/tone) to create tension the model has to resolve. Built-in word pools (~10-15 words per dimension, ~150k combinations). Words show as toggleable chips — kill the ones that don't vibe, keep the rest, re-roll for a new set. Mood steering biases the pools toward a feel (horror, organic, glitch, sacred, ethereal) without replacing them. Selected words inject into the prompt alongside existing tags. Start with offline pools only; Claude API tier for infinite generative variety is a future add-on. Pools can be expanded manually over time as we find gaps.
- ~~**Queue panel back to sidebar**~~ ✓ — moved to full-height floating panel on the right edge of the app

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
