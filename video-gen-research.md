# Video Generation — Research Notes
*For future integration into the Prompt Gen / Electron app*

---

## Overview

ComfyUI supports local video generation via a handful of open-source models. This is a future phase feature — not currently planned for immediate development. These notes capture the landscape so we can make informed decisions when we get there.

---

## The Main Models

### Wan2.1 / Wan2.2 (Alibaba)
- Best overall quality among open-source video models, particularly for human subjects — skin, hair, facial detail
- Motion feels physically grounded and weighty, not floaty
- Slow: 12–18 minutes per clip on an RTX 4090 (longer on Apple Silicon)
- Supports LoRAs via a dedicated `WanVideoLoRA Select` node — uses `LoraLoaderModelOnly`, NOT the standard LoRA loader node
- Wan2.2's dual high/low noise architecture means LoRAs must be loaded on both paths separately — silently breaks if you get this wrong (similar to the Bob's Loader issue we already dealt with)
- Video LoRAs are motion/effect focused (camera moves, physics effects) — not style LoRAs like our Illustrious ones
- Supports text-to-video and image-to-video

### LTX-Video / LTX-2.3 (Lightricks)
- Most accessible in terms of speed — roughly 10–14x faster than Wan in practice
- Naturally suited to stylized, animated, artistic content — slightly floaty motion that can actually work for supernatural/surreal material
- Less strong on photorealism, faces, and fine detail in complex scenes
- Has its own LoRA loader node (standard ComfyUI LoRA loader won't work correctly)
- Also supports text-to-video and image-to-video

### Others (noted, not prioritised)
- **HunyuanVideo** — strong on multi-character scenes and physics, very VRAM heavy
- **LTX-2** — 19B params, native 4K, synchronized audio, but requires extreme hardware
- **Grok video nodes** — cloud/API based, not local, costs money per generation

---

## How Generation Works

### Text-to-Video
Prompt-based, but works better with natural descriptive sentences than booru-style tags. These models were trained on video captions, not image tags.

### Image-to-Video (most relevant for our workflow)
Feed a generated still image into the model and it animates it — camera drift, smoke, fabric movement, breathing, etc. This is the more powerful path for us because:
- We already control the look at the image stage using our Illustrious checkpoints + LoRAs
- The video model just adds motion on top
- Style is baked in before video gen even starts

---

## Output Characteristics
- Clips are short — realistically 5–10 seconds per generation
- Output is genuine video (not flipbook/cartoon), photorealistic in intent
- Both models output at ~24fps
- Standard output formats are compatible with iMovie and DaVinci Resolve

---

## Stitching Clips Together
Within ComfyUI:
- **VideoHelperSuite** (`VHS_VideoCombine` node) — merges sequences/clips, control over FPS, looping, format. Likely already installed if using Wan or LTX workflows.
- **ComfyUI-VideoDirCombiner** — batch combines a whole folder of clips, optional transitions and music

Realistically, ComfyUI's stitching is mechanical (no overlap/blend). Better to generate clips in ComfyUI and arrange/transition them in a proper editor. Both iMovie and DaVinci Resolve (free) handle this easily. Output format to target: MP4/H.264 — iMovie can be fussy about other formats like .webm.

---

## Apple Silicon Notes
- Most models are optimised for CUDA (NVIDIA) — Apple Silicon (MPS/Metal) support is hit or miss
- Wan2.1 1.3B and LTX-Video have the best MPS support and are the most realistic options to try locally on our M4 Pro right now
- 48GB unified memory is a genuine asset when support matures

---

## Aesthetic Fit
For our dark surreal, body horror, comic-influenced work:
- Image-to-video is the strongest path — generate the styled still with Illustrious LoRAs, animate with Wan or LTX
- Subtle motion suits the aesthetic better than dramatic action — slow drift, smoke, a figure breathing, light shifting
- LTX's slightly "floaty" quality could work in our favour for supernatural material
- Wan's heavier, more physically grounded motion suits weight and presence

---

## Potential App Integration (Future Phase)

### What makes sense
- A simple **"Animate this"** button on an approved/generated image in the Gallery tab
- Hands the image off to a Wan or LTX workflow in ComfyUI directly
- Minimal prompt input — maybe just a motion description field
- A **Video tab** in the Electron app with a basic player and the same triage states (Unreviewed / Approved / Rejected)

### What doesn't make sense
- Deep integration with the tag/prompt system — video prompts work differently (natural language, not tags)
- Batch video generation — too slow to iterate like stills
- Video gen as part of the main generation loop — it's a finishing step, not an exploratory one

### Recommendation
Don't build this yet. Get reps in with video gen manually in ComfyUI first to understand how it actually fits into the workflow. Then the app integration requirements will be much clearer. Flag for a future phase once the core app is solid.
