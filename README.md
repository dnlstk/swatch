# swatch

A personal desktop tool for working with [ComfyUI](https://github.com/comfyanonymous/ComfyUI): browse and organise LoRAs, build prompts from trigger words, send generations to ComfyUI, and triage the results in a gallery.

**Heads up: this is built for one Mac and one setup.** It is shared so people can read the code and borrow ideas. It is not packaged for anyone else to install, and it will not run out of the box on your machine without some editing.

## What it assumes

- macOS on Apple Silicon.
- This folder lives at `~/Tools/ComfyUI/_tools`.
- A ComfyUI install at `~/ComfyUI-Installs/ComfyUI/ComfyUI`, run with the Python in `~/Tools/ComfyUI/.venv`.
- Model paths come from ComfyUI's `extra_models_config.yaml` and Comfy Desktop's `shared_model_paths.yaml` in `~/Library/Application Support`.

Those paths are set near the top of `electron-app/main.js`. Change them there to point at your own install.

## How it fits together

- `comfy-prompt-gen.html` and `app.js`: the whole front end (one page, plain JS, no framework).
- `electron-app/main.js`: the Electron shell. Opens the window, runs the menu bar icon, and starts ComfyUI.
- `electron-app/server.js`: a small Node server on `localhost:3000` that serves the page, reads and writes app data, scans model folders and talks to ComfyUI.
- `app-data.json`: your LoRA settings, collections and gallery state. Created on first run and kept out of git.
- `CONTEXT.md`, `ROADMAP.md`, `DESIGN_NOTES.md`: working notes from building it. Long, informal, and written for the author and their AI helpers, not as documentation.

## Running it

```bash
cd electron-app
npm install
npm start
```

`npm run build` makes a `.app` in `electron-app/dist/`.

## Fonts

Poppins and Space Mono, both under the SIL Open Font License.
