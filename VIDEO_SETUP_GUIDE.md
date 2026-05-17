# Video Generation Setup Guide
*For Daniel's M4 Pro Mac (48GB) + ComfyUI Desktop*

---

## TL;DR

You're going to download ~10GB of model files, drop them in the right ComfyUI folders, and load a built-in workflow template. No custom nodes required for the basic setup.

---

## Which model?

**Start with: Wan 2.1 T2V 1.3B** — small, fast, great for learning the workflow. Generates 480p video in a few minutes on your hardware.

**Then try: Wan 2.1 T2V 14B GGUF Q4_K_S** — much better quality, still fits comfortably in your 48GB. Slower (15-30 min per clip) but worth it for real output.

**Also worth knowing:** Wan 2.2 is out with a 5B model that's a nice middle ground. Same setup process, nearly identical workflows. We can try it after getting 2.1 working.

---

## Step 1: Download model files

You need 3 files to start (text-to-video):

| File | Size | Download from |
|------|------|---------------|
| `wan2.1_t2v_1.3B_fp16.safetensors` | ~2.8 GB | [Comfy-Org/Wan_2.1_ComfyUI_repackaged](https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged) → `split_files/diffusion_models/` |
| `umt5_xxl_fp8_e4m3fn_scaled.safetensors` | ~6.7 GB | Same repo → `split_files/text_encoders/` |
| `wan_2.1_vae.safetensors` | ~254 MB | Same repo → `split_files/vae/` |

**Optional — for the 14B quality upgrade later:**

| File | Size | Download from |
|------|------|---------------|
| `wan2.1-t2v-14b-Q4_K_S.gguf` | ~9.2 GB | [city96/Wan2.1-T2V-14B-gguf](https://huggingface.co/city96/Wan2.1-T2V-14B-gguf) |

**Optional — for image-to-video later:**

| File | Size | Download from |
|------|------|---------------|
| `wan2.1_i2v_480p_14B_fp16.safetensors` (or GGUF) | ~32 GB (or ~9 GB GGUF) | Same Comfy-Org repo or city96 GGUF repo |
| `clip_vision_h.safetensors` | ~1.3 GB | Comfy-Org repo → `split_files/clip_vision/` |

---

## Step 2: Put files in the right folders

Drop each downloaded file into its matching folder inside your ComfyUI installation:

```
ComfyUI/
  models/
    diffusion_models/
      wan2.1_t2v_1.3B_fp16.safetensors      ← the video model
    text_encoders/
      umt5_xxl_fp8_e4m3fn_scaled.safetensors ← understands your prompts
    vae/
      wan_2.1_vae.safetensors                ← converts latent → video frames
```

---

## Step 3: Load the built-in workflow

ComfyUI has Wan 2.1 templates built in:

1. Open ComfyUI
2. Go to **Workflows → Workflow Templates → Video → Wan2.1 T2V**
3. The workflow loads with all the right nodes already connected

---

## Step 4: Configure and generate

In the loaded workflow:
- **Load Diffusion Model** node → select `wan2.1_t2v_1.3B_fp16.safetensors`
- **Load CLIP** node → select `umt5_xxl_fp8_e4m3fn_scaled.safetensors`
- **Load VAE** node → select `wan_2.1_vae.safetensors`
- **Positive prompt** → describe what you want to see (include motion/camera descriptions!)
- **EmptyWanLatentVideo** → set resolution (832×480) and frame count (81 = ~5 sec)
- Hit **Queue Prompt**

---

## Key parameters to know

| Parameter | Good starting value | Notes |
|-----------|-------------------|-------|
| Resolution | 832×480 | Must be multiples of 16 |
| Frame count | 81 | ~5 sec at 16fps. Valid values: 17, 33, 49, 65, 81, 97 (formula: 4n+1) |
| Steps | 30 | More = better but slower. 50-80 for final output |
| CFG | 5-7 | Lower = more creative, higher = stricter prompt following |
| Sampler | euler | Standard for Wan |
| Scheduler | normal | Standard for Wan |

---

## Video prompting tips

Video prompts are different from image prompts — you want to describe **motion** and **camera movement**:
- "A man walking through a foggy forest, camera slowly tracking forward"
- "Close-up of hands sculpting clay, fingers pressing into wet surface"
- "Aerial shot of ocean waves crashing on rocks, camera pulling back"

Words like "slow motion", "timelapse", "handheld camera", "dolly zoom" etc. help guide the motion.

---

## Mac-specific gotchas

- **FP8 models don't work on Mac** — use fp16 or GGUF. The fp8 text encoder is fine though (it gets converted during loading)
- **Close other apps** when generating video — it uses a lot of memory
- **Don't let Mac sleep** during generation
- **Generate one at a time** (batch_size = 1)
- **Start small** — 480p, 33-49 frames while learning, then scale up

---

## For GGUF models (14B quality upgrade)

If you want to use the GGUF quantized 14B model, you need one custom node:
- **ComfyUI-GGUF** — install via ComfyUI Manager → search "GGUF" → install → restart

---

## For MP4 output (recommended)

By default ComfyUI outputs individual frames. To get actual video files:
- **ComfyUI-VideoHelperSuite** — install via ComfyUI Manager → search "VideoHelperSuite" → install → restart
- Replace the output node with **VHS_VideoCombine** to get MP4 files

---

## What we'll build in the app

Once you have a working workflow in ComfyUI, we'll:
1. Capture the workflow structure
2. Add video-specific controls to the Generate tab (frame count, fps, resolution, motion hints)
3. Parameterize it just like txt2img — prompt + settings → Process → video appears in gallery
4. Gallery already supports mp4/webm/mov playback from session 22
