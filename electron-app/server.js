/**
 * Node.js replacement for proxy.py — runs inside Electron's main process.
 * Serves static files, app-data, gallery operations, and scans local models.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const crypto = require('crypto');
const zlib = require('zlib');

const COMFY_HOST = '127.0.0.1';
const COMFY_PORT = 8000;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

let TOOLS_DIR, DATA_FILE, LORA_IMG_DIR, TAG_IMG_DIR, FONT_DIR, RAW_DIR, APPROVED_DIR, LORAS_DIR, CHECKPOINTS_DIR;

function initPaths(toolsDir) {
  TOOLS_DIR = toolsDir;
  DATA_FILE = path.join(TOOLS_DIR, 'app-data.json');
  LORA_IMG_DIR = path.join(TOOLS_DIR, 'lora-images');
  TAG_IMG_DIR = path.join(TOOLS_DIR, 'tag-images');
  FONT_DIR = path.join(TOOLS_DIR, 'fonts');
  RAW_DIR = path.normalize(path.join(TOOLS_DIR, '..', 'output'));
  APPROVED_DIR = path.normalize(path.join(TOOLS_DIR, '..', 'approved'));
  LORAS_DIR = path.normalize(path.join(TOOLS_DIR, '..', 'models', 'loras'));
  CHECKPOINTS_DIR = path.normalize(path.join(TOOLS_DIR, '..', 'models', 'checkpoints'));
}

// ===================== HELPERS =====================

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function getMime(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function sendJson(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function serveFile(res, filepath) {
  try {
    const body = fs.readFileSync(filepath);
    res.writeHead(200, {
      'Content-Type': getMime(filepath),
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
      'Content-Length': body.length,
    });
    res.end(body);
  } catch {
    sendJson(res, { error: 'Not found' }, 404);
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

// ===================== PNG METADATA =====================

function extractPngMetadata(filepath) {
  const buf = fs.readFileSync(filepath);
  // Verify PNG signature
  const sig = buf.slice(0, 8);
  if (sig.toString('hex') !== '89504e470d0a1a0a') {
    return { error: 'Not a valid PNG' };
  }

  const textChunks = {};
  let offset = 8;
  while (offset < buf.length) {
    if (offset + 8 > buf.length) break;
    const length = buf.readUInt32BE(offset);
    const chunkType = buf.slice(offset + 4, offset + 8).toString('ascii');
    const data = buf.slice(offset + 8, offset + 8 + length);
    offset += 8 + length + 4; // skip CRC

    if (chunkType === 'tEXt') {
      const nullIdx = data.indexOf(0);
      const key = data.slice(0, nullIdx).toString('latin1');
      const val = data.slice(nullIdx + 1).toString('utf8');
      textChunks[key] = val;
    } else if (chunkType === 'iTXt') {
      const nullIdx = data.indexOf(0);
      const key = data.slice(0, nullIdx).toString('latin1');
      let rest = data.slice(nullIdx + 1);
      const compFlag = rest[0];
      rest = rest.slice(2); // skip comp flag + method
      const langEnd = rest.indexOf(0);
      rest = rest.slice(langEnd + 1);
      const kwEnd = rest.indexOf(0);
      let textData = rest.slice(kwEnd + 1);
      if (compFlag) {
        textData = zlib.inflateSync(textData);
      }
      textChunks[key] = textData.toString('utf8');
    } else if (chunkType === 'IEND') {
      break;
    }
  }

  if (!textChunks.prompt) {
    return { has_metadata: false };
  }

  let promptData;
  try {
    promptData = JSON.parse(textChunks.prompt);
  } catch {
    return { has_metadata: false };
  }

  const result = {
    has_metadata: true,
    positive: '',
    negative: '',
    checkpoint: '',
    loras: [],
    seed: null,
    steps: null,
    cfg: null,
    sampler: '',
    scheduler: '',
    width: null,
    height: null,
    denoise: null,
  };

  for (const [nodeId, node] of Object.entries(promptData)) {
    const ct = node.class_type || '';

    if (ct === 'CheckpointLoaderSimple') {
      const name = (node.inputs || {}).ckpt_name || '';
      result.checkpoint = name ? name.split('/').pop().replace(/\.[^.]+$/, '') : '';
    } else if (ct === 'KSampler' || ct === 'KSamplerAdvanced') {
      const inp = node.inputs || {};
      result.seed = inp.seed;
      result.steps = inp.steps;
      result.cfg = inp.cfg;
      result.sampler = inp.sampler_name || '';
      result.scheduler = inp.scheduler || '';
      result.denoise = inp.denoise;
    } else if (ct === 'EmptyLatentImage') {
      const inp = node.inputs || {};
      result.width = inp.width;
      result.height = inp.height;
    } else if (ct.toLowerCase().includes('lora') && ct.toLowerCase().includes('loader')) {
      const inp = node.inputs || {};
      const loraName = inp.lora_name || '';
      const loraDisplay = loraName ? loraName.split('/').pop().replace(/\.[^.]+$/, '') : '';
      const strength = inp.strength_model != null ? inp.strength_model : inp.strength;
      const entry = { name: loraDisplay, file: loraName };
      if (strength != null) entry.strength = strength;
      result.loras.push(entry);
    }
  }

  // Resolve positive/negative prompts by following KSampler links
  for (const [nodeId, node] of Object.entries(promptData)) {
    const ct = node.class_type || '';
    if (ct === 'KSampler' || ct === 'KSamplerAdvanced') {
      const inp = node.inputs || {};
      // Follow positive link
      const posRef = inp.positive;
      if (Array.isArray(posRef) && posRef.length === 2) {
        const posNode = promptData[String(posRef[0])] || {};
        if (posNode.class_type === 'CLIPTextEncode') {
          result.positive = (posNode.inputs || {}).text || '';
        } else {
          result.positive = findClipText(promptData, String(posRef[0]), 0);
        }
      }
      // Follow negative link
      const negRef = inp.negative;
      if (Array.isArray(negRef) && negRef.length === 2) {
        const negNode = promptData[String(negRef[0])] || {};
        if (negNode.class_type === 'CLIPTextEncode') {
          result.negative = (negNode.inputs || {}).text || '';
        } else {
          result.negative = findClipText(promptData, String(negRef[0]), 0);
        }
      }
      break; // Only need the first KSampler
    }
  }

  // Fallback: try _meta.title
  if (!result.positive) {
    for (const [nodeId, node] of Object.entries(promptData)) {
      if (node.class_type === 'CLIPTextEncode') {
        const title = ((node._meta || {}).title || '').toLowerCase();
        const text = (node.inputs || {}).text || '';
        if (title.includes('pos') && !result.positive) result.positive = text;
        else if (title.includes('neg') && !result.negative) result.negative = text;
      }
    }
  }

  return result;
}

function findClipText(promptData, nodeId, depth) {
  if (depth > 10) return '';
  const node = promptData[nodeId] || {};
  if (node.class_type === 'CLIPTextEncode') {
    return (node.inputs || {}).text || '';
  }
  const inp = node.inputs || {};
  for (const key of ['conditioning', 'positive', 'negative', 'conditioning1', 'conditioning2']) {
    const ref = inp[key];
    if (Array.isArray(ref) && ref.length === 2) {
      const result = findClipText(promptData, String(ref[0]), depth + 1);
      if (result) return result;
    }
  }
  return '';
}

// ===================== MULTIPART PARSING =====================

function parseMultipart(contentType, body) {
  let boundary = null;
  for (const part of contentType.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith('boundary=')) {
      boundary = trimmed.slice(9).trim();
      break;
    }
  }
  if (!boundary) return { fileData: null, fileName: null, key: null };

  const boundaryBuf = Buffer.from('--' + boundary);
  const parts = [];
  let start = 0;
  while (true) {
    const idx = body.indexOf(boundaryBuf, start);
    if (idx === -1) break;
    if (start > 0) parts.push(body.slice(start, idx));
    start = idx + boundaryBuf.length;
  }

  let fileData = null, fileName = null, keyValue = null;

  for (const part of parts) {
    if (part.indexOf(Buffer.from('Content-Disposition')) === -1) continue;
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd === -1) continue;
    const headersRaw = part.slice(0, headerEnd).toString('utf8');
    let content = part.slice(headerEnd + 4);
    if (content.length >= 2 && content[content.length - 2] === 0x0d && content[content.length - 1] === 0x0a) {
      content = content.slice(0, -2);
    }

    if (headersRaw.includes('name="file"')) {
      const match = headersRaw.match(/filename="([^"]+)"/);
      if (match) fileName = match[1];
      fileData = content;
    } else if (headersRaw.includes('name="key"')) {
      keyValue = content.toString('utf8').trim();
    }
  }

  return { fileData, fileName, key: keyValue };
}

// ===================== LOCAL MODEL SCANNING =====================

let _loraCache = null;
let _checkpointCache = null;

function scanModels(baseDir) {
  const results = [];
  if (!fs.existsSync(baseDir)) return results;

  function walk(dir, rel) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === 'ExampleImages' || entry.name === 'recipes') continue;
        walk(path.join(dir, entry.name), rel ? rel + '/' + entry.name : entry.name);
      } else if (entry.name.endsWith('.safetensors')) {
        const stem = entry.name.replace(/\.safetensors$/, '');
        const fullPath = path.join(dir, entry.name);
        const metaPath = path.join(dir, stem + '.metadata.json');
        let meta = null;
        if (fs.existsSync(metaPath)) {
          try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch {}
        }

        const previewExts = ['.jpeg', '.jpg', '.png', '.webp'];
        let previewFile = null;
        for (const ext of previewExts) {
          const p = path.join(dir, stem + ext);
          if (fs.existsSync(p)) { previewFile = p; break; }
        }

        const folder = rel || '';
        const fileName = (meta && meta.file_name) || stem;

        results.push({
          file_name: fileName,
          model_name: (meta && meta.model_name) || stem,
          base_model: (meta && meta.base_model) || '',
          preview_path: previewFile,
          tags: (meta && meta.civitai && meta.civitai.model && meta.civitai.model.tags) || [],
          civitai: (meta && meta.civitai) || null,
          sha256: (meta && meta.sha256) || null,
          folder: folder,
          size: meta ? meta.size : 0,
        });
      }
    }
  }

  walk(baseDir, '');
  return results;
}

function getLoraList() {
  if (!_loraCache) _loraCache = scanModels(LORAS_DIR);
  return _loraCache;
}

function getCheckpointList() {
  if (!_checkpointCache) _checkpointCache = scanModels(CHECKPOINTS_DIR);
  return _checkpointCache;
}

// ===================== CIVITAI INSTALL =====================

let _installProgress = null; // { status, pct, message, error }

function civitaiFetch(urlStr, apiKey) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const opts = {
      hostname: u.hostname, port: 443, path: u.pathname + u.search,
      method: 'GET', headers: {},
    };
    if (apiKey) opts.headers['Authorization'] = 'Bearer ' + apiKey;
    const req = https.request(opts, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        civitaiFetch(res.headers.location, null).then(resolve).catch(reject);
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({ status: res.statusCode, headers: res.headers, body: buf });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.setTimeout(15000);
    req.end();
  });
}

function civitaiDownload(urlStr, destPath, apiKey, expectedSize) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const opts = {
      hostname: u.hostname, port: 443, path: u.pathname + u.search,
      method: 'GET', headers: {},
    };
    if (apiKey) opts.headers['Authorization'] = 'Bearer ' + apiKey;
    const req = https.request(opts, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        civitaiDownload(res.headers.location, destPath, null, expectedSize).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => reject(new Error('HTTP ' + res.statusCode)));
        return;
      }
      const total = expectedSize || parseInt(res.headers['content-length'] || '0', 10);
      let received = 0;
      const tmpPath = destPath + '.tmp';
      const ws = fs.createWriteStream(tmpPath);
      res.on('data', (chunk) => {
        received += chunk.length;
        ws.write(chunk);
        if (total > 0) {
          _installProgress = { status: 'downloading', pct: Math.round((received / total) * 100), message: `${(received / 1048576).toFixed(1)} / ${(total / 1048576).toFixed(1)} MB` };
        }
      });
      res.on('end', () => {
        ws.end(() => {
          fs.renameSync(tmpPath, destPath);
          resolve();
        });
      });
      res.on('error', (e) => { ws.destroy(); reject(e); });
    });
    req.on('error', reject);
    req.end();
  });
}

function parseCivitaiUrl(url) {
  const m = url.match(/models\/(\d+)/);
  if (!m) return null;
  const modelId = parseInt(m[1], 10);
  const vm = url.match(/modelVersionId=(\d+)/);
  const versionId = vm ? parseInt(vm[1], 10) : null;
  const host = url.includes('civitai.red') ? 'civitai.red' : 'civitai.com';
  return { modelId, versionId, host };
}

async function installLora(civitaiUrl, apiKey) {
  _installProgress = { status: 'fetching', pct: 0, message: 'Fetching model info...' };

  const parsed = parseCivitaiUrl(civitaiUrl);
  if (!parsed) throw new Error('Could not parse CivitAI URL');
  const apiBase = 'https://' + parsed.host + '/api/v1';

  let versionData;
  if (parsed.versionId) {
    const r = await civitaiFetch(apiBase + '/model-versions/' + parsed.versionId, apiKey);
    if (r.status !== 200) throw new Error('CivitAI API error: ' + r.status);
    versionData = JSON.parse(r.body.toString('utf8'));
  } else {
    const r = await civitaiFetch(apiBase + '/models/' + parsed.modelId, apiKey);
    if (r.status !== 200) throw new Error('CivitAI API error: ' + r.status);
    const modelData = JSON.parse(r.body.toString('utf8'));
    if (!modelData.modelVersions || !modelData.modelVersions.length) throw new Error('No versions found');
    versionData = modelData.modelVersions[0];
    if (!versionData.model) {
      versionData.model = { name: modelData.name, type: modelData.type, nsfw: modelData.nsfw, poi: modelData.poi, tags: modelData.tags || [] };
    }
  }

  const primaryFile = (versionData.files || []).find(f => f.primary && f.name.endsWith('.safetensors'))
    || (versionData.files || []).find(f => f.name.endsWith('.safetensors'));
  if (!primaryFile) throw new Error('No .safetensors file found');

  const stem = primaryFile.name.replace(/\.safetensors$/, '');
  const destFile = path.join(LORAS_DIR, primaryFile.name);

  if (fs.existsSync(destFile)) throw new Error('Already installed: ' + primaryFile.name);

  const fileSizeBytes = (primaryFile.sizeKB || 0) * 1024;
  _installProgress = { status: 'downloading', pct: 0, message: 'Starting download...' };
  const downloadUrl = primaryFile.downloadUrl || ('https://' + parsed.host + '/api/download/models/' + versionData.id);
  await civitaiDownload(downloadUrl, destFile, apiKey, fileSizeBytes);

  _installProgress = { status: 'saving', pct: 100, message: 'Saving metadata...' };

  // Download preview image
  let previewLocalPath = null;
  if (versionData.images && versionData.images.length) {
    const imgUrl = versionData.images[0].url;
    const ext = imgUrl.match(/\.(jpe?g|png|webp)/i);
    const previewExt = ext ? '.' + ext[1].toLowerCase().replace('jpg', 'jpeg') : '.jpeg';
    const previewDest = path.join(LORAS_DIR, stem + previewExt);
    try {
      const imgResp = await civitaiFetch(imgUrl, null);
      if (imgResp.status === 200) {
        fs.writeFileSync(previewDest, imgResp.body);
        previewLocalPath = previewDest;
      }
    } catch {}
  }

  // Write .metadata.json sidecar (matching LoRA Manager format)
  const stats = fs.statSync(destFile);
  const sidecar = {
    file_name: stem,
    model_name: (versionData.model && versionData.model.name) || stem,
    file_path: destFile,
    size: stats.size,
    modified: stats.mtimeMs / 1000,
    sha256: (primaryFile.hashes && primaryFile.hashes.SHA256) ? primaryFile.hashes.SHA256.toLowerCase() : null,
    base_model: versionData.baseModel || '',
    preview_url: previewLocalPath || '',
    preview_nsfw_level: (versionData.images && versionData.images[0]) ? versionData.images[0].nsfwLevel : 1,
    notes: '',
    from_civitai: true,
    civitai: versionData,
  };
  fs.writeFileSync(path.join(LORAS_DIR, stem + '.metadata.json'), JSON.stringify(sidecar, null, 2));

  _loraCache = null;
  _installProgress = { status: 'done', pct: 100, message: 'Installed: ' + (sidecar.model_name || stem) };
  return { ok: true, file_name: stem, model_name: sidecar.model_name, source_url: civitaiUrl };
}

// ===================== REQUEST HANDLER =====================

async function handleRequest(req, res) {
  const parsedUrl = new URL(req.url, 'http://localhost');
  const urlPath = parsedUrl.pathname;
  const params = parsedUrl.searchParams;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    });
    res.end();
    return;
  }

  // ---- GET routes ----
  if (req.method === 'GET') {
    // App data
    if (urlPath === '/app-data') {
      sendJson(res, loadData());
      return;
    }

    // Serve lora-images
    if (urlPath.startsWith('/lora-images/')) {
      const file = urlPath.slice('/lora-images/'.length).split('?')[0];
      const filepath = path.join(LORA_IMG_DIR, file);
      if (fs.existsSync(filepath)) serveFile(res, filepath);
      else sendJson(res, { error: 'Not found' }, 404);
      return;
    }

    // Serve tag-images
    if (urlPath.startsWith('/tag-images/')) {
      const file = urlPath.slice('/tag-images/'.length).split('?')[0];
      const filepath = path.join(TAG_IMG_DIR, file);
      if (fs.existsSync(filepath)) serveFile(res, filepath);
      else sendJson(res, { error: 'Not found' }, 404);
      return;
    }

    // Serve fonts
    if (urlPath.startsWith('/fonts/')) {
      const file = urlPath.slice('/fonts/'.length).split('?')[0];
      const filepath = path.join(FONT_DIR, file);
      if (fs.existsSync(filepath)) serveFile(res, filepath);
      else sendJson(res, { error: 'Not found' }, 404);
      return;
    }

    // Gallery — list images
    if (urlPath === '/gallery/list') {
      const folder = params.get('folder') || 'raw';
      const base = folder === 'raw' ? RAW_DIR : APPROVED_DIR;
      const other = folder === 'raw' ? APPROVED_DIR : RAW_DIR;
      ensureDir(base);
      try {
        const files = fs.readdirSync(base);
        const images = [];
        for (let f of files) {
          if (/\.(png|jpg|jpeg|webp|gif|mp4|webm|mov)$/i.test(f)) {
            if (fs.existsSync(path.join(other, f))) {
              const ext = path.extname(f);
              const stem = path.basename(f, ext);
              const newName = `${stem}_${Math.floor(Date.now() / 1000)}${ext}`;
              fs.renameSync(path.join(base, f), path.join(base, newName));
              f = newName;
            }
            const fp = path.join(base, f);
            const stat = fs.statSync(fp);
            images.push({ name: f, mtime: stat.mtimeMs / 1000, size: stat.size });
          }
        }
        images.sort((a, b) => b.mtime - a.mtime);
        sendJson(res, images);
      } catch (e) {
        sendJson(res, { error: e.message }, 500);
      }
      return;
    }

    // Gallery — serve image
    if (urlPath === '/gallery/image') {
      const folder = params.get('folder') || 'raw';
      const filename = params.get('file') || '';
      if (!filename || filename.includes('..')) {
        sendJson(res, { error: 'Invalid filename' }, 400);
        return;
      }
      const base = folder === 'raw' ? RAW_DIR : APPROVED_DIR;
      const filepath = path.join(base, filename);
      if (fs.existsSync(filepath)) serveFile(res, filepath);
      else sendJson(res, { error: 'Not found' }, 404);
      return;
    }

    // Gallery — PNG metadata
    if (urlPath === '/gallery/metadata') {
      const folder = params.get('folder') || 'raw';
      const filename = params.get('file') || '';
      if (!filename || filename.includes('..')) {
        sendJson(res, { error: 'Invalid filename' }, 400);
        return;
      }
      const base = folder === 'raw' ? RAW_DIR : APPROVED_DIR;
      const filepath = path.join(base, filename);
      if (!fs.existsSync(filepath)) {
        sendJson(res, { error: 'Not found' }, 404);
        return;
      }
      if (!filepath.toLowerCase().endsWith('.png')) {
        sendJson(res, { has_metadata: false });
        return;
      }
      try {
        const meta = extractPngMetadata(filepath);
        sendJson(res, meta);
      } catch (e) {
        sendJson(res, { error: e.message }, 500);
      }
      return;
    }

    // Local LoRA list (replaces LoRA Manager API)
    if (urlPath === '/local/loras/list') {
      try {
        const items = getLoraList().map(l => ({
          ...l,
          preview_url: l.preview_path ? '/local/preview/loras/' + encodeURIComponent(path.basename(l.preview_path)) : null,
        }));
        sendJson(res, { items, total_pages: 1 });
      } catch (e) {
        sendJson(res, { error: e.message }, 500);
      }
      return;
    }

    // Local checkpoint list (replaces LoRA Manager API)
    if (urlPath === '/local/checkpoints/list') {
      try {
        const items = getCheckpointList().map(c => ({
          ...c,
          preview_url: c.preview_path ? '/local/preview/checkpoints/' + c.folder + '/' + encodeURIComponent(path.basename(c.preview_path)) : null,
        }));
        sendJson(res, { items, total_pages: 1 });
      } catch (e) {
        sendJson(res, { error: e.message }, 500);
      }
      return;
    }

    // Serve LoRA preview images from filesystem
    if (urlPath.startsWith('/local/preview/loras/')) {
      const file = decodeURIComponent(urlPath.slice('/local/preview/loras/'.length));
      if (file.includes('..')) { sendJson(res, { error: 'Invalid path' }, 400); return; }
      const filepath = path.join(LORAS_DIR, file);
      if (fs.existsSync(filepath)) serveFile(res, filepath);
      else sendJson(res, { error: 'Not found' }, 404);
      return;
    }

    // Serve checkpoint preview images from filesystem
    if (urlPath.startsWith('/local/preview/checkpoints/')) {
      const file = decodeURIComponent(urlPath.slice('/local/preview/checkpoints/'.length));
      if (file.includes('..')) { sendJson(res, { error: 'Invalid path' }, 400); return; }
      const filepath = path.join(CHECKPOINTS_DIR, file);
      if (fs.existsSync(filepath)) serveFile(res, filepath);
      else sendJson(res, { error: 'Not found' }, 404);
      return;
    }

    // CivitAI install progress polling
    if (urlPath === '/local/loras/install-progress') {
      sendJson(res, _installProgress || { status: 'idle', pct: 0, message: '' });
      return;
    }

    // CivitAI model info preview (before installing)
    if (urlPath === '/local/loras/preview-info') {
      const civitUrl = params.get('url');
      if (!civitUrl) { sendJson(res, { error: 'Missing url param' }, 400); return; }
      try {
        const appDataRaw = fs.readFileSync(path.join(TOOLS_DIR, 'app-data.json'), 'utf8');
        const appDataObj = JSON.parse(appDataRaw);
        const apiKey = (appDataObj.settings && appDataObj.settings.civitaiApiKey) || '';
        const parsed = parseCivitaiUrl(civitUrl);
        if (!parsed) { sendJson(res, { error: 'Could not parse CivitAI URL' }, 400); return; }
        const apiBase = 'https://' + parsed.host + '/api/v1';
        let versionData;
        if (parsed.versionId) {
          const r = await civitaiFetch(apiBase + '/model-versions/' + parsed.versionId, apiKey);
          if (r.status !== 200) { sendJson(res, { error: 'CivitAI API error: ' + r.status }, r.status === 404 ? 404 : 502); return; }
          versionData = JSON.parse(r.body.toString('utf8'));
        } else {
          const r = await civitaiFetch(apiBase + '/models/' + parsed.modelId, apiKey);
          if (r.status !== 200) { sendJson(res, { error: 'CivitAI API error: ' + r.status }, r.status === 404 ? 404 : 502); return; }
          const modelData = JSON.parse(r.body.toString('utf8'));
          if (!modelData.modelVersions || !modelData.modelVersions.length) { sendJson(res, { error: 'No versions found' }, 404); return; }
          versionData = modelData.modelVersions[0];
          if (!versionData.model) {
            versionData.model = { name: modelData.name, type: modelData.type, nsfw: modelData.nsfw, poi: modelData.poi, tags: modelData.tags || [] };
          }
        }
        const primaryFile = (versionData.files || []).find(f => f.primary && f.name.endsWith('.safetensors'))
          || (versionData.files || []).find(f => f.name.endsWith('.safetensors'));
        const alreadyInstalled = primaryFile && fs.existsSync(path.join(LORAS_DIR, primaryFile.name));
        sendJson(res, {
          name: (versionData.model && versionData.model.name) || 'Unknown',
          versionName: versionData.name || '',
          baseModel: versionData.baseModel || '',
          fileName: primaryFile ? primaryFile.name : null,
          sizeMB: primaryFile ? Math.round((primaryFile.sizeKB || 0) / 1024) : 0,
          previewUrl: (versionData.images && versionData.images[0]) ? versionData.images[0].url : null,
          trainedWords: versionData.trainedWords || [],
          type: (versionData.model && versionData.model.type) || 'LORA',
          tags: (versionData.model && versionData.model.tags) || [],
          alreadyInstalled: !!alreadyInstalled,
          downloadUrl: (primaryFile && primaryFile.downloadUrl) || ('https://' + parsed.host + '/api/download/models/' + versionData.id),
        });
      } catch (e) {
        sendJson(res, { error: e.message }, 500);
      }
      return;
    }

    // Refresh local model caches
    if (urlPath === '/local/refresh') {
      _loraCache = null;
      _checkpointCache = null;
      sendJson(res, { ok: true });
      return;
    }

    // ComfyUI — list of LoRAs ComfyUI can actually load (authoritative, with path+ext)
    if (urlPath === '/comfy/loras') {
      const proxyReq = http.request(
        { host: COMFY_HOST, port: COMFY_PORT, path: '/object_info/LoraLoader', method: 'GET', timeout: 5000 },
        (pr) => {
          const chunks = [];
          pr.on('data', (c) => chunks.push(c));
          pr.on('end', () => {
            try {
              const j = JSON.parse(Buffer.concat(chunks).toString('utf8'));
              const info = j.LoraLoader || {};
              const req = (info.input && info.input.required) || {};
              const def = req.lora_name || [];
              const names = Array.isArray(def) && Array.isArray(def[0]) ? def[0] : [];
              sendJson(res, { loras: names });
            } catch (e) {
              sendJson(res, { error: 'Bad response from ComfyUI' }, 502);
            }
          });
        }
      );
      proxyReq.on('error', () => sendJson(res, { error: 'ComfyUI not running' }, 502));
      proxyReq.on('timeout', () => { proxyReq.destroy(); sendJson(res, { error: 'ComfyUI timeout' }, 504); });
      proxyReq.end();
      return;
    }

    // ComfyUI — list of checkpoints ComfyUI can actually load (authoritative)
    if (urlPath === '/comfy/checkpoints') {
      const proxyReq = http.request(
        { host: COMFY_HOST, port: COMFY_PORT, path: '/object_info/CheckpointLoaderSimple', method: 'GET', timeout: 5000 },
        (pr) => {
          const chunks = [];
          pr.on('data', (c) => chunks.push(c));
          pr.on('end', () => {
            try {
              const j = JSON.parse(Buffer.concat(chunks).toString('utf8'));
              const info = j.CheckpointLoaderSimple || {};
              const req = (info.input && info.input.required) || {};
              const ckptDef = req.ckpt_name || [];
              // ComfyUI returns [ [list of names], {...opts} ] — we want index 0
              const names = Array.isArray(ckptDef) && Array.isArray(ckptDef[0]) ? ckptDef[0] : [];
              sendJson(res, { checkpoints: names });
            } catch (e) {
              sendJson(res, { error: 'Bad response from ComfyUI' }, 502);
            }
          });
        }
      );
      proxyReq.on('error', () => sendJson(res, { error: 'ComfyUI not running' }, 502));
      proxyReq.on('timeout', () => { proxyReq.destroy(); sendJson(res, { error: 'ComfyUI timeout' }, 504); });
      proxyReq.end();
      return;
    }

    // ComfyUI — queue status (count of running + pending prompts)
    if (urlPath === '/comfy/queue') {
      const proxyReq = http.request(
        { host: COMFY_HOST, port: COMFY_PORT, path: '/queue', method: 'GET', timeout: 4000 },
        (pr) => {
          const chunks = [];
          pr.on('data', (c) => chunks.push(c));
          pr.on('end', () => {
            try {
              const j = JSON.parse(Buffer.concat(chunks).toString('utf8'));
              sendJson(res, {
                running: (j.queue_running || []).length,
                pending: (j.queue_pending || []).length,
              });
            } catch (e) {
              sendJson(res, { error: 'Bad response from ComfyUI' }, 502);
            }
          });
        }
      );
      proxyReq.on('error', () => sendJson(res, { error: 'ComfyUI not running' }, 502));
      proxyReq.on('timeout', () => { proxyReq.destroy(); sendJson(res, { error: 'ComfyUI timeout' }, 504); });
      proxyReq.end();
      return;
    }

    // Queue details — full job list with prompt IDs
    if (urlPath === '/comfy/queue/details') {
      const proxyReq = http.request(
        { host: COMFY_HOST, port: COMFY_PORT, path: '/queue', method: 'GET', timeout: 4000 },
        (pr) => {
          const chunks = [];
          pr.on('data', (c) => chunks.push(c));
          pr.on('end', () => {
            try {
              const j = JSON.parse(Buffer.concat(chunks).toString('utf8'));
              function extractCheckpoint(item) {
                try {
                  const prompt = item[2];
                  if (!prompt) return null;
                  for (const node of Object.values(prompt)) {
                    if (node.class_type === 'CheckpointLoaderSimple' && node.inputs && node.inputs.ckpt_name) {
                      const full = node.inputs.ckpt_name;
                      const base = full.split('/').pop().replace(/\.\w+$/, '');
                      return base;
                    }
                  }
                } catch (e) {}
                return null;
              }
              const running = (j.queue_running || []).map(item => ({ number: item[0], promptId: item[1], checkpoint: extractCheckpoint(item) }));
              const pending = (j.queue_pending || []).map(item => ({ number: item[0], promptId: item[1], checkpoint: extractCheckpoint(item) }));
              sendJson(res, { running, pending });
            } catch (e) {
              sendJson(res, { error: 'Bad response from ComfyUI' }, 502);
            }
          });
        }
      );
      proxyReq.on('error', () => sendJson(res, { error: 'ComfyUI not running' }, 502));
      proxyReq.on('timeout', () => { proxyReq.destroy(); sendJson(res, { error: 'ComfyUI timeout' }, 504); });
      proxyReq.end();
      return;
    }

    // Serve static files
    let filePath = urlPath === '/' ? '/comfy-prompt-gen.html' : urlPath;
    const fullPath = path.join(TOOLS_DIR, filePath.replace(/^\//, ''));
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      serveFile(res, fullPath);
    } else {
      sendJson(res, { error: `Not found: ${filePath}` }, 404);
    }
    return;
  }

  // ---- POST routes ----
  if (req.method === 'POST') {
    const body = await readBody(req);

    // App data save
    if (urlPath === '/app-data') {
      try {
        const data = JSON.parse(body.toString('utf8'));
        saveData(data);
        sendJson(res, { ok: true });
      } catch (e) {
        sendJson(res, { error: e.message }, 400);
      }
      return;
    }

    // CivitAI — install a LoRA by URL
    if (urlPath === '/local/loras/install') {
      try {
        const data = JSON.parse(body.toString('utf8'));
        const civitUrl = data.url;
        if (!civitUrl) { sendJson(res, { error: 'Missing url' }, 400); return; }
        const appDataRaw = fs.readFileSync(path.join(TOOLS_DIR, 'app-data.json'), 'utf8');
        const appDataObj = JSON.parse(appDataRaw);
        const apiKey = (appDataObj.settings && appDataObj.settings.civitaiApiKey) || '';
        if (!apiKey) { sendJson(res, { error: 'CivitAI API key not set — add it in Settings' }, 400); return; }
        const result = await installLora(civitUrl, apiKey);
        sendJson(res, result);
      } catch (e) {
        _installProgress = { status: 'error', pct: 0, message: e.message };
        sendJson(res, { error: e.message }, 500);
      }
      return;
    }

    // CivitAI — uninstall a LoRA (delete files from disk)
    if (urlPath === '/local/loras/uninstall') {
      try {
        const data = JSON.parse(body.toString('utf8'));
        const fileName = data.file_name;
        if (!fileName || fileName.includes('..') || fileName.includes('/')) {
          sendJson(res, { error: 'Invalid file_name' }, 400); return;
        }
        const safetensors = path.join(LORAS_DIR, fileName + '.safetensors');
        const metaJson = path.join(LORAS_DIR, fileName + '.metadata.json');
        if (!fs.existsSync(safetensors)) {
          sendJson(res, { error: 'File not found: ' + fileName + '.safetensors' }, 404); return;
        }
        fs.unlinkSync(safetensors);
        if (fs.existsSync(metaJson)) fs.unlinkSync(metaJson);
        const previewExts = ['.jpeg', '.jpg', '.png', '.webp'];
        for (const ext of previewExts) {
          const p = path.join(LORAS_DIR, fileName + ext);
          if (fs.existsSync(p)) fs.unlinkSync(p);
        }
        _loraCache = null;
        sendJson(res, { ok: true, deleted: fileName });
      } catch (e) {
        sendJson(res, { error: e.message }, 500);
      }
      return;
    }

    // Gallery — approve (move raw → approved, or confirm if already there)
    if (urlPath === '/gallery/approve') {
      try {
        const data = JSON.parse(body.toString('utf8'));
        const filename = data.file || '';
        if (!filename || filename.includes('..')) {
          sendJson(res, { error: 'Invalid filename' }, 400);
          return;
        }
        ensureDir(APPROVED_DIR);
        const rawSrc = path.join(RAW_DIR, filename);
        const approvedSrc = path.join(APPROVED_DIR, filename);
        if (fs.existsSync(approvedSrc)) {
          sendJson(res, { ok: true });
          return;
        }
        if (!fs.existsSync(rawSrc)) {
          sendJson(res, { error: 'File not found' }, 404);
          return;
        }
        let dst = approvedSrc;
        fs.renameSync(rawSrc, dst);
        sendJson(res, { ok: true });
      } catch (e) {
        sendJson(res, { error: e.message }, 500);
      }
      return;
    }

    // Gallery — unapprove (move approved → raw)
    if (urlPath === '/gallery/unapprove') {
      try {
        const data = JSON.parse(body.toString('utf8'));
        const filename = data.file || '';
        if (!filename || filename.includes('..')) {
          sendJson(res, { error: 'Invalid filename' }, 400);
          return;
        }
        const src = path.join(APPROVED_DIR, filename);
        if (!fs.existsSync(src)) {
          sendJson(res, { error: 'File not found in approved' }, 404);
          return;
        }
        ensureDir(RAW_DIR);
        let dst = path.join(RAW_DIR, filename);
        if (fs.existsSync(dst)) {
          const ext = path.extname(filename);
          const base = path.basename(filename, ext);
          dst = path.join(RAW_DIR, `${base}_${Math.floor(Date.now() / 1000)}${ext}`);
        }
        fs.renameSync(src, dst);
        sendJson(res, { ok: true });
      } catch (e) {
        sendJson(res, { error: e.message }, 500);
      }
      return;
    }

    // Gallery — decline (move to Trash)
    if (urlPath === '/gallery/decline') {
      try {
        const data = JSON.parse(body.toString('utf8'));
        const filename = data.file || '';
        const folder = data.folder || 'raw';
        if (!filename || filename.includes('..')) {
          sendJson(res, { error: 'Invalid filename' }, 400);
          return;
        }
        const base = folder === 'raw' ? RAW_DIR : APPROVED_DIR;
        const filepath = path.join(base, filename);
        if (!fs.existsSync(filepath)) {
          sendJson(res, { error: 'File not found' }, 404);
          return;
        }
        const trashDir = path.join(require('os').homedir(), '.Trash');
        let trashPath = path.join(trashDir, filename);
        if (fs.existsSync(trashPath)) {
          const ext = path.extname(filename);
          const baseName = path.basename(filename, ext);
          trashPath = path.join(trashDir, `${baseName}_${Math.floor(Date.now() / 1000)}${ext}`);
        }
        fs.renameSync(filepath, trashPath);
        sendJson(res, { ok: true });
      } catch (e) {
        sendJson(res, { error: e.message }, 500);
      }
      return;
    }

    // Gallery — rename file
    if (urlPath === '/gallery/rename') {
      try {
        const data = JSON.parse(body.toString('utf8'));
        const oldName = data.file || '';
        const newName = data.newName || '';
        const folder = data.folder || 'raw';
        if (!oldName || !newName || oldName.includes('..') || newName.includes('..') || newName.includes('/')) {
          sendJson(res, { error: 'Invalid filename' }, 400);
          return;
        }
        // Preserve the original extension
        const origExt = path.extname(oldName);
        const newExt = path.extname(newName);
        const finalName = newExt ? newName : newName + origExt;
        const baseDir = folder === 'approved' ? APPROVED_DIR : RAW_DIR;
        const src = path.join(baseDir, oldName);
        if (!fs.existsSync(src)) {
          sendJson(res, { error: 'File not found' }, 404);
          return;
        }
        // Check for conflicts in BOTH folders — gallery shows files from raw + approved
        const dst = path.join(baseDir, finalName);
        if (finalName !== oldName) {
          const rawConflict = fs.existsSync(path.join(RAW_DIR, finalName));
          const approvedConflict = fs.existsSync(path.join(APPROVED_DIR, finalName));
          if (rawConflict || approvedConflict) {
            sendJson(res, { error: 'A file with that name already exists' }, 409);
            return;
          }
        }
        fs.renameSync(src, dst);
        sendJson(res, { ok: true, newName: finalName });
      } catch (e) {
        sendJson(res, { error: e.message }, 500);
      }
      return;
    }

    // ComfyUI — submit prompt workflow
    if (urlPath === '/comfy/prompt') {
      const proxyReq = http.request(
        {
          host: COMFY_HOST,
          port: COMFY_PORT,
          path: '/prompt',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
          timeout: 10000,
        },
        (pr) => {
          const chunks = [];
          pr.on('data', (c) => chunks.push(c));
          pr.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            res.writeHead(pr.statusCode || 200, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            });
            res.end(raw);
          });
        }
      );
      proxyReq.on('error', () => sendJson(res, { error: 'ComfyUI not running' }, 502));
      proxyReq.on('timeout', () => { proxyReq.destroy(); sendJson(res, { error: 'ComfyUI timeout' }, 504); });
      proxyReq.write(body);
      proxyReq.end();
      return;
    }

    // ComfyUI — upload a gallery image to ComfyUI's input folder for img2img
    if (urlPath === '/comfy/upload-gallery') {
      const parsed = JSON.parse(body.toString('utf8'));
      const folder = parsed.folder === 'approved' ? APPROVED_DIR : RAW_DIR;
      const filename = parsed.file;
      if (!filename || filename.includes('..')) {
        sendJson(res, { error: 'Invalid filename' }, 400);
        return;
      }
      const filepath = path.join(folder, filename);
      if (!fs.existsSync(filepath)) {
        sendJson(res, { error: 'File not found' }, 404);
        return;
      }
      const fileData = fs.readFileSync(filepath);
      const boundary = '----PromptGen' + crypto.randomBytes(8).toString('hex');
      const parts = [];
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`));
      parts.push(fileData);
      parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
      const multipartBody = Buffer.concat(parts);
      const proxyReq = http.request(
        {
          host: COMFY_HOST, port: COMFY_PORT,
          path: '/upload/image', method: 'POST',
          headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': multipartBody.length },
          timeout: 30000,
        },
        (pr) => {
          const chunks = [];
          pr.on('data', c => chunks.push(c));
          pr.on('end', () => {
            res.writeHead(pr.statusCode || 200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(Buffer.concat(chunks).toString('utf8'));
          });
        }
      );
      proxyReq.on('error', () => sendJson(res, { error: 'ComfyUI not running' }, 502));
      proxyReq.on('timeout', () => { proxyReq.destroy(); sendJson(res, { error: 'ComfyUI timeout' }, 504); });
      proxyReq.write(multipartBody);
      proxyReq.end();
      return;
    }

    // ComfyUI — interrupt current generation
    if (urlPath === '/comfy/interrupt') {
      const proxyReq = http.request(
        { host: COMFY_HOST, port: COMFY_PORT, path: '/interrupt', method: 'POST', timeout: 5000 },
        (pr) => { pr.resume(); sendJson(res, { ok: true }); }
      );
      proxyReq.on('error', () => sendJson(res, { error: 'ComfyUI not running' }, 502));
      proxyReq.on('timeout', () => { proxyReq.destroy(); sendJson(res, { error: 'ComfyUI timeout' }, 504); });
      proxyReq.end();
      return;
    }

    // ComfyUI — clear pending queue items
    if (urlPath === '/comfy/queue/clear') {
      const clearBody = Buffer.from('{"clear":true}');
      const proxyReq = http.request(
        { host: COMFY_HOST, port: COMFY_PORT, path: '/queue', method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': clearBody.length },
          timeout: 5000 },
        (pr) => { pr.resume(); sendJson(res, { ok: true }); }
      );
      proxyReq.on('error', () => sendJson(res, { error: 'ComfyUI not running' }, 502));
      proxyReq.on('timeout', () => { proxyReq.destroy(); sendJson(res, { error: 'ComfyUI timeout' }, 504); });
      proxyReq.write(clearBody);
      proxyReq.end();
      return;
    }

    // ComfyUI — delete specific queue items by prompt ID
    if (urlPath === '/comfy/queue/delete') {
      try {
        const data = JSON.parse(body.toString('utf8'));
        const ids = data.delete || [];
        if (!ids.length) { sendJson(res, { error: 'No IDs provided' }, 400); return; }
        const deleteBody = Buffer.from(JSON.stringify({ delete: ids }));
        const proxyReq = http.request(
          { host: COMFY_HOST, port: COMFY_PORT, path: '/queue', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': deleteBody.length },
            timeout: 5000 },
          (pr) => { pr.resume(); sendJson(res, { ok: true }); }
        );
        proxyReq.on('error', () => sendJson(res, { error: 'ComfyUI not running' }, 502));
        proxyReq.on('timeout', () => { proxyReq.destroy(); sendJson(res, { error: 'ComfyUI timeout' }, 504); });
        proxyReq.write(deleteBody);
        proxyReq.end();
      } catch (e) {
        sendJson(res, { error: e.message }, 500);
      }
      return;
    }

    // LoRA custom image upload
    if (urlPath === '/lora-image') {
      try {
        ensureDir(LORA_IMG_DIR);
        const ct = req.headers['content-type'] || '';
        const { fileData, fileName, key } = parseMultipart(ct, body);
        if (!fileData || !key) {
          sendJson(res, { error: 'Missing file or key' }, 400);
          return;
        }
        let ext = path.extname(fileName || '').toLowerCase();
        if (ext === '.jpeg') ext = '.jpg';
        if (!['.jpg', '.png', '.webp', '.gif'].includes(ext)) ext = '.jpg';
        const safeKey = key.replace(/[/\\:]/g, '_');
        const outName = safeKey + ext;
        fs.writeFileSync(path.join(LORA_IMG_DIR, outName), fileData);
        console.log(`  Saved lora image: ${outName} (${fileData.length} bytes)`);
        sendJson(res, { ok: true, url: `/lora-images/${outName}` });
      } catch (e) {
        sendJson(res, { error: e.message }, 500);
      }
      return;
    }

    sendJson(res, { error: 'Not found' }, 404);
  }
}

// ===================== SERVER =====================

let server = null;

// ===================== WEBSOCKET PROXY =====================
// Browser can't connect directly to ComfyUI WS (403 — origin check).
// We proxy at the socket level: browser → us → ComfyUI.
// Uses only built-in Node.js APIs; no ws package needed.

function computeWsAccept(key) {
  return crypto.createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');
}

function handleWsUpgrade(req, clientSocket) {
  const clientKey = req.headers['sec-websocket-key'];
  if (!clientKey) { clientSocket.destroy(); return; }

  // Accept the browser's upgrade immediately with the correct handshake
  clientSocket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${computeWsAccept(clientKey)}\r\n` +
    '\r\n'
  );

  // Open a fresh WS connection to ComfyUI from Node (no browser Origin restriction)
  const proxyKey = crypto.randomBytes(16).toString('base64');
  const comfyReq = http.request({
    host: COMFY_HOST,
    port: COMFY_PORT,
    path: '/ws?clientId=prompt-gen',
    headers: {
      'Connection': 'Upgrade',
      'Upgrade': 'websocket',
      'Sec-WebSocket-Version': '13',
      'Sec-WebSocket-Key': proxyKey,
      'Host': `${COMFY_HOST}:${COMFY_PORT}`,
      'Origin': `http://${COMFY_HOST}:${COMFY_PORT}`,
    },
  });

  comfyReq.on('upgrade', (_res, comfySocket, head) => {
    if (head && head.length) comfySocket.unshift(head);
    // Pipe frames bidirectionally — browser ↔ ComfyUI
    clientSocket.pipe(comfySocket);
    comfySocket.pipe(clientSocket);
    clientSocket.on('error', () => comfySocket.destroy());
    comfySocket.on('error', () => clientSocket.destroy());
    clientSocket.on('close', () => comfySocket.destroy());
    comfySocket.on('close', () => clientSocket.destroy());
  });

  comfyReq.on('error', (e) => {
    console.error('[ws-proxy] ComfyUI connect error:', e.message);
    clientSocket.destroy();
  });

  comfyReq.end();
}

function startServer(toolsDir, port = 3000) {
  return new Promise((resolve) => {
    initPaths(toolsDir);
    server = http.createServer((req, res) => {
      handleRequest(req, res).catch((e) => {
        console.error('[server] error:', e);
        try { sendJson(res, { error: e.message }, 500); } catch {}
      });
    });

    // Intercept WS upgrade requests — proxy to ComfyUI from Node context
    server.on('upgrade', (req, socket, head) => {
      if (req.url && req.url.startsWith('/ws')) {
        handleWsUpgrade(req, socket);
      } else {
        socket.destroy();
      }
    });

    server.listen(port, '127.0.0.1', () => {
      console.log(`\n  Prompt Gen server (Node.js)`);
      console.log(`  http://127.0.0.1:${port}/comfy-prompt-gen.html`);
      console.log(`  LoRAs: ${LORAS_DIR}`);
      console.log(`  Checkpoints: ${CHECKPOINTS_DIR}`);
      console.log(`  Data file: ${DATA_FILE}`);
      console.log(`  Gallery raw: ${RAW_DIR}`);
      console.log(`  Gallery ok:  ${APPROVED_DIR}\n`);
      resolve();
    });
  });
}

function stopServer() {
  if (server) {
    server.close();
    server = null;
  }
}

module.exports = { startServer, stopServer };
