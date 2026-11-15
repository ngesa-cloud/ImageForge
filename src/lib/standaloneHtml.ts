export function generateConsolidatedHtml(initialTab: 'reel' | 'image' = 'reel'): string {
  return `<!doctype html>
<!-- file: animereel-studio.html — consolidated single-file AnimeReel Studio + ImageForge (Auto-Chain, Canvas FX, Muxed Web Audio, 2x/4x Super-Res, IndexedDB) -->
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <title>AnimeReel Studio — Reel & Image Forge</title>
  <style>
    :root {
      --bg: #0a0d12;
      --panel: #11151e;
      --panel-hover: #181d29;
      --border: #222938;
      --text: #e8edf5;
      --text-dim: #94a3b8;
      --pink: #ec4899;
      --pink-hover: #db2777;
      --indigo: #6366f1;
      --indigo-hover: #4f46e5;
      --danger: #ef4444;
      --radius: 12px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      height: 100dvh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    header {
      height: 56px;
      padding: 0 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      background: var(--panel);
      flex-shrink: 0;
    }
    .brand { font-size: 16px; font-weight: 700; letter-spacing: -0.02em; white-space: nowrap; }
    .brand span { color: var(--pink); }
    nav { display: flex; gap: 20px; align-items: center; }
    .nav-btn {
      background: none; border: none; border-bottom: 2px solid transparent;
      color: var(--text-dim); font: 600 13px/1 inherit; padding: 6px 2px;
      cursor: pointer; white-space: nowrap; transition: color 0.15s, border-color 0.15s;
    }
    .nav-btn:hover { color: var(--text); }
    .nav-btn.active-reel { color: var(--text); border-bottom-color: var(--pink); }
    .nav-btn.active-image { color: var(--text); border-bottom-color: var(--indigo); }
    .status { font-size: 12px; color: var(--text-dim); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .status.active { color: #f472b6; }

    .mobile-bar {
      display: none; padding: 8px 14px; border-bottom: 1px solid var(--border); background: #0d1017;
    }
    .mobile-switch {
      display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px;
      background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
    }
    .mobile-switch button {
      background: none; border: none; color: var(--text-dim); padding: 6px 10px;
      border-radius: 6px; font: 500 12px/1.2 inherit; cursor: pointer;
    }
    .mobile-switch button.active { background: var(--panel-hover); color: var(--text); }

    main { display: flex; flex: 1; overflow: hidden; }
    .sidebar {
      width: 364px; min-width: 364px; background: var(--panel);
      border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden;
    }
    .sidebar-inner { padding: 16px; flex: 1; overflow-y: auto; }
    .sidebar-foot { padding: 14px 16px; border-top: 1px solid var(--border); background: var(--panel); }

    @media (max-width: 900px) {
      .mobile-bar { display: block; }
      .sidebar, .stage { width: 100% !important; min-width: 0 !important; flex: 1; border-right: none; }
      body[data-mobile-view="stage"] .sidebar { display: none; }
      body[data-mobile-view="controls"] .stage { display: none; }
    }

    .label-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    label, .lbl { display: block; font-size: 12px; font-weight: 500; color: var(--text-dim); margin-bottom: 6px; }
    .label-row label { margin-bottom: 0; }
    .link-btn { background: none; border: none; color: var(--text-dim); font-size: 12px; cursor: pointer; }
    .link-btn:hover { color: var(--text); }

    textarea, input, select {
      width: 100%; background: var(--bg); border: 1px solid var(--border);
      color: var(--text); border-radius: 8px; padding: 9px 11px;
      font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      outline: none; transition: border-color 0.15s;
    }
    textarea:focus, input:focus, select:focus { border-color: var(--pink); }
    body[data-mode="image"] textarea:focus,
    body[data-mode="image"] input:focus,
    body[data-mode="image"] select:focus { border-color: var(--indigo); }
    textarea { resize: vertical; min-height: 82px; }

    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
    .presets { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .preset {
      background: var(--bg); border: 1px solid var(--border); color: var(--text-dim);
      padding: 7px 10px; border-radius: 8px; font-size: 12px; font-weight: 500;
      cursor: pointer; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .preset:hover { background: var(--panel-hover); color: var(--text); }
    .preset.active-reel { background: var(--pink); border-color: var(--pink); color: #fff; }
    .preset.active-image { background: var(--indigo); border-color: var(--indigo); color: #fff; }

    .seg {
      display: grid; gap: 4px; padding: 4px; background: var(--bg);
      border: 1px solid var(--border); border-radius: 8px;
    }
    .seg-3 { grid-template-columns: repeat(3, 1fr); }
    .seg-4 { grid-template-columns: repeat(4, 1fr); }
    .seg-5 { grid-template-columns: repeat(5, 1fr); }
    .seg button {
      background: none; border: none; color: var(--text-dim); padding: 6px 4px;
      border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; white-space: nowrap;
    }
    .seg button.active { background: var(--panel-hover); color: var(--text); }

    .btn-primary {
      width: 100%; border: none; border-radius: 10px; padding: 12px 16px;
      font-weight: 600; font-size: 14px; color: #fff; cursor: pointer;
      background: var(--pink); transition: background 0.15s;
    }
    .btn-primary:hover:not(:disabled) { background: var(--pink-hover); }
    body[data-mode="image"] .btn-primary { background: var(--indigo); }
    body[data-mode="image"] .btn-primary:hover:not(:disabled) { background: var(--indigo-hover); }
    .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }

    .stage { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--bg); }
    .stage-bar {
      padding: 10px 20px; border-bottom: 1px solid var(--border);
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;
    }
    .stage-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .btn-sec {
      background: var(--panel); border: 1px solid var(--border); color: var(--text);
      padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 500;
      cursor: pointer; text-decoration: none; white-space: nowrap;
    }
    .btn-sec:hover { background: var(--panel-hover); border-color: #364156; }
    .btn-dl {
      background: var(--pink); border: none; color: #fff;
      padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600;
      cursor: pointer; text-decoration: none; white-space: nowrap;
    }
    .stage-body { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 22px; }

    .video-stage { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; }
    .video-box {
      width: 100%; max-width: 360px; aspect-ratio: 9 / 16; background: #050608;
      border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden;
      display: flex; align-items: center; justify-content: center; position: relative;
    }
    canvas, video { width: 100%; height: 100%; object-fit: contain; display: block; }
    .placeholder { padding: 24px; text-align: center; font-size: 13px; color: var(--text-dim); max-width: 300px; }

    .section-head {
      display: flex; justify-content: space-between; align-items: center;
      border-top: 1px solid var(--border); padding-top: 16px; margin-bottom: 12px;
      font-size: 12px; font-weight: 500; color: var(--text-dim);
    }
    .kf-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; }
    @media (max-width: 640px) { .kf-grid { grid-template-columns: repeat(3, 1fr); } }
    .kf-card {
      aspect-ratio: 1; border-radius: 8px; overflow: hidden; border: 1px solid var(--border);
      background: var(--panel);
    }
    .kf-card img { width: 100%; height: 100%; object-fit: cover; display: block; }

    .saved-reels { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
    .reel-item {
      display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 8px;
      background: var(--panel); border: 1px solid var(--border); cursor: pointer;
    }
    .reel-item:hover { border-color: var(--pink); background: var(--panel-hover); }
    .reel-thumb { width: 46px; height: 46px; border-radius: 6px; overflow: hidden; background: #050608; flex-shrink: 0; }
    .reel-thumb img { width: 100%; height: 100%; object-fit: cover; }
    .reel-meta { min-width: 0; flex: 1; }
    .reel-title { font-size: 12px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .reel-sub { font-size: 11px; color: var(--text-dim); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .btn-del {
      background: none; border: none; color: var(--text-dim); font-size: 14px;
      padding: 4px 6px; cursor: pointer; border-radius: 4px;
    }
    .btn-del:hover { color: #fca5a5; background: var(--bg); }

    .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 14px; }
    .img-card {
      background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius);
      overflow: hidden; display: flex; flex-direction: column;
    }
    .img-box { aspect-ratio: 1; background: #06080c; display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: hidden; }
    .img-box img { width: 100%; height: 100%; object-fit: cover; }
    .img-info { padding: 10px; border-top: 1px solid var(--border); }
    .img-prompt { font-size: 12px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .img-sub { font-size: 11px; color: var(--text-dim); font-variant-numeric: tabular-nums; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .img-acts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 8px; }
    .img-acts button, .img-acts a {
      background: var(--bg); border: 1px solid var(--border); color: var(--text);
      padding: 5px 4px; border-radius: 6px; font-size: 11px; text-align: center;
      text-decoration: none; cursor: pointer;
    }
    .img-acts button:hover, .img-acts a:hover { background: var(--panel-hover); }

    .spinner {
      width: 24px; height: 24px; border: 2px solid var(--border);
      border-top-color: var(--indigo); border-radius: 50%; animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .modal {
      position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 50;
      display: none; align-items: center; justify-content: center; padding: 20px;
    }
    .modal.open { display: flex; }
    .modal img { max-width: 92vw; max-height: 86dvh; border-radius: 10px; border: 1px solid var(--border); object-fit: contain; }
  </style>
</head>
<body data-mode="${initialTab}" data-mobile-view="controls">

<header>
  <div class="brand">Anime<span>Reel</span></div>
  <nav>
    <button type="button" class="nav-btn ${initialTab === 'reel' ? 'active-reel' : ''}" id="tab-reel">Reel Studio</button>
    <button type="button" class="nav-btn ${initialTab === 'image' ? 'active-image' : ''}" id="tab-image">Image Forge</button>
  </nav>
  <div class="status" id="status">Ready</div>
</header>

<div class="mobile-bar">
  <div class="mobile-switch">
    <button type="button" id="mob-controls" class="active">Prompt & Controls</button>
    <button type="button" id="mob-stage">Stage & Saved</button>
  </div>
</div>

<main>
  <aside class="sidebar">
    <div class="sidebar-inner">
      <div class="label-row">
        <label for="prompt">Prompt</label>
        <div style="display:flex;gap:12px;">
          <button type="button" class="link-btn" id="btn-sample">Sample</button>
          <button type="button" class="link-btn" id="btn-clear">Clear</button>
        </div>
      </div>
      <textarea id="prompt" placeholder="A lone samurai on a neon rooftop, drifting sakura petals..."></textarea>

      <div style="margin-top:14px;">
        <div class="lbl">Style</div>
        <div class="presets" id="presets"></div>
      </div>

      <!-- Reel Controls -->
      <div id="reel-controls">
        <div style="margin-top:14px;">
          <div class="lbl">Reel Format</div>
          <div class="seg seg-3" id="seg-reel-aspect">
            <button type="button" data-val="9:16" class="active">9:16 Reel</button>
            <button type="button" data-val="16:9">16:9 Wide</button>
            <button type="button" data-val="1:1">1:1 Square</button>
          </div>
        </div>

        <div class="grid-2">
          <div>
            <div class="lbl">Scene Cuts</div>
            <div class="seg seg-3" id="seg-cuts">
              <button type="button" data-val="1">1f</button>
              <button type="button" data-val="3" class="active">3f</button>
              <button type="button" data-val="6">6f</button>
            </div>
          </div>
          <div>
            <div class="lbl">Duration</div>
            <div class="seg seg-4" id="seg-dur">
              <button type="button" data-val="4">4s</button>
              <button type="button" data-val="6" class="active">6s</button>
              <button type="button" data-val="8">8s</button>
              <button type="button" data-val="10">10s</button>
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div>
            <label for="motion">Camera Motion</label>
            <select id="motion">
              <option value="dynamic_mix">Dynamic Mix</option>
              <option value="zoom_in">Zoom In</option>
              <option value="zoom_out">Zoom Out</option>
              <option value="pan_right">Pan Right</option>
              <option value="pan_left">Pan Left</option>
            </select>
          </div>
          <div>
            <label for="fx">Atmosphere FX</label>
            <select id="fx">
              <option value="sakura">Sakura Petals</option>
              <option value="embers">Glowing Embers</option>
              <option value="rain">Neon Rain</option>
              <option value="glitch">Cyberpunk Glitch</option>
              <option value="speed_lines">Action Speed Lines</option>
              <option value="none">Clean (No FX)</option>
            </select>
          </div>
        </div>

        <div style="margin-top:12px;">
          <div class="lbl">Audio Track</div>
          <div class="seg seg-3" id="seg-audio">
            <button type="button" data-val="synth" class="active">Synthwave</button>
            <button type="button" data-val="rain">Ambient Rain</button>
            <button type="button" data-val="none">Silent</button>
          </div>
        </div>
      </div>

      <!-- Image Controls -->
      <div id="image-controls" style="display:none;">
        <div style="margin-top:14px;">
          <div class="lbl">Aspect Ratio</div>
          <div class="seg seg-5" id="seg-img-aspect">
            <button type="button" data-val="1:1" class="active">1:1</button>
            <button type="button" data-val="3:4">3:4</button>
            <button type="button" data-val="4:3">4:3</button>
            <button type="button" data-val="9:16">9:16</button>
            <button type="button" data-val="16:9">16:9</button>
          </div>
        </div>

        <div class="grid-2">
          <div>
            <label for="model">Model</label>
            <select id="model">
              <option value="flux">Flux</option>
              <option value="flux-realism">Flux Realism</option>
              <option value="turbo">Turbo</option>
            </select>
          </div>
          <div>
            <div class="lbl">Batch</div>
            <div class="seg seg-3" id="seg-batch">
              <button type="button" data-val="1">1</button>
              <button type="button" data-val="2" class="active">2</button>
              <button type="button" data-val="4">4</button>
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div>
            <label for="upscale">Upscale Pass</label>
            <select id="upscale">
              <option value="1">Off (1×)</option>
              <option value="2">2× Super-Res</option>
              <option value="4">4× Ultra-Res</option>
            </select>
          </div>
          <div>
            <div class="label-row">
              <label for="seed">Seed</label>
              <button type="button" class="link-btn" id="btn-roll">Random</button>
            </div>
            <input type="number" id="seed" placeholder="Random" min="0" />
          </div>
        </div>

        <div style="margin-top:12px;">
          <label for="neg">Negative Prompt</label>
          <input type="text" id="neg" placeholder="blurry, low quality, watermark" />
        </div>
      </div>
    </div>

    <div class="sidebar-foot">
      <button type="button" class="btn-primary" id="btn-gen">Generate Reel</button>
    </div>
  </aside>

  <section class="stage">
    <div class="stage-bar">
      <div class="status" id="stage-info">Ready</div>
      <div class="stage-actions">
        <button type="button" class="btn-sec" id="btn-mute" style="display:none;">Unmute Audio</button>
        <button type="button" class="btn-sec" id="btn-recompile" style="display:none;">Re-Compile</button>
        <a class="btn-dl" id="btn-dl-reel" style="display:none;" download="anime-reel.webm">Download .webm</a>
        <button type="button" class="btn-sec" id="btn-clear-all" style="display:none;">Clear Saved</button>
      </div>
    </div>

    <div class="stage-body">
      <!-- Reel Stage -->
      <div id="reel-stage">
        <div class="video-stage">
          <div class="video-box" id="video-box">
            <div class="placeholder" id="reel-placeholder">Describe an anime scene to synthesize keyframes, animate camera motion, and export a WebM reel with audio.</div>
            <canvas id="canvas" width="540" height="960" style="display:none;"></canvas>
            <video id="player" controls autoplay loop playsinline muted style="display:none;"></video>
          </div>
        </div>

        <div id="kf-section" style="display:none;">
          <div class="section-head"><span>Active Keyframes</span><span id="kf-providers"></span></div>
          <div class="kf-grid" id="kf-grid"></div>
        </div>

        <div id="saved-reels-section" style="display:none;">
          <div class="section-head"><span>Saved Reels (IndexedDB)</span><span id="saved-reels-count"></span></div>
          <div class="saved-reels" id="saved-reels"></div>
        </div>
      </div>

      <!-- Image Stage -->
      <div id="image-stage" style="display:none;">
        <div id="img-empty" class="placeholder" style="margin:60px auto;max-width:400px;">
          Enter any prompt to generate via Airforce → Pollinations → Local Synth + 2×/4× Super-Res.
        </div>
        <div class="gallery" id="gallery"></div>
      </div>
    </div>
  </section>
</main>

<div class="modal" id="modal"><img id="modal-img" alt="Preview" /></div>

<script>
const $ = (id) => document.getElementById(id);

const REEL_STYLES = [
  { name: "Anime", suffix: ", anime key visual, studio quality, vibrant colors, crisp cel shading" },
  { name: "Dark Anime", suffix: ", dark anime, cinematic lighting, dramatic high contrast shadows" },
  { name: "90s Retro", suffix: ", 90s retro anime aesthetic, hand painted cel, vintage palette" },
  { name: "Cyberpunk", suffix: ", cyberpunk anime, neon rain reflections, glowing highlights" },
  { name: "Shonen", suffix: ", dynamic anime battle frame, energy aura, crisp linework" },
  { name: "Scenic Sky", suffix: ", Makoto Shinkai inspired anime background, golden hour clouds" }
];
const IMG_STYLES = [
  { name: "Cinematic", suffix: ", cinematic lighting, shallow depth of field, film grain, 35mm" },
  { name: "Anime", suffix: ", anime key visual, clean lineart, vibrant colors, studio quality" },
  { name: "Cyberpunk", suffix: ", cyberpunk, neon reflections, rain-slick streets, high contrast" },
  { name: "Oil Paint", suffix: ", oil on canvas, thick impasto brushstrokes, museum lighting" },
  { name: "3D Render", suffix: ", octane render, subsurface scattering, volumetric light, 8k" },
  { name: "Studio", suffix: ", studio product photography, softbox lighting, crisp detail" }
];
const SAMPLES = [
  "A lone samurai standing on a crimson torii gate beneath a fractured moon, drifting mist",
  "Magical girl wielding a glowing crystal blade above a neon-lit midnight city",
  "Rain-slicked Tokyo train platform at dusk, warm lantern reflections on puddles",
  "Brutalist concrete observatory overlooking a misty alpine valley at dawn"
];

const state = {
  mode: "${initialTab}",
  busy: false,
  reelAspect: "9:16",
  cuts: 3,
  duration: 6,
  audio: "synth",
  imgAspect: "1:1",
  batch: 2,
  reelStyleSuffix: REEL_STYLES[0].suffix,
  imgStyles: new Set(),
  activeFrames: [],
  activeProviders: [],
  reelUrl: null,
  savedReels: [],
  savedImages: [],
  sampleIdx: 0
};

// --- INDEXEDDB PERSISTENCE ---
const DB_NAME = "animereel_standalone_db";
function openDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("reels")) db.createObjectStore("reels", { keyPath: "id" });
      if (!db.objectStoreNames.contains("images")) db.createObjectStore("images", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbGetAll(store) {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => {
        const res = Array.isArray(req.result) ? req.result : [];
        res.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        db.close();
        resolve(res);
      };
      req.onerror = () => { db.close(); resolve([]); };
    });
  } catch { return []; }
}
async function dbPut(store, item) {
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(item);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
    });
  } catch {}
}
async function dbDelete(store, id) {
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).delete(id);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
    });
  } catch {}
}
async function dbClear(store) {
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).clear();
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
    });
  } catch {}
}

// --- UI BINDINGS ---
function setStatus(txt, active) {
  $("status").textContent = txt;
  $("status").className = "status" + (active ? " active" : "");
  $("stage-info").textContent = txt;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
function bindSeg(id, cb) {
  const wrap = $(id);
  wrap.querySelectorAll("button").forEach((btn) => {
    btn.onclick = () => {
      wrap.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      cb(btn.dataset.val);
    };
  });
}
bindSeg("seg-reel-aspect", (v) => {
  state.reelAspect = v;
  $("video-box").style.aspectRatio = v === "16:9" ? "16 / 9" : v === "1:1" ? "1 / 1" : "9 / 16";
  $("video-box").style.maxWidth = v === "16:9" ? "720px" : v === "1:1" ? "500px" : "360px";
});
bindSeg("seg-cuts", (v) => { state.cuts = parseInt(v, 10); });
bindSeg("seg-dur", (v) => { state.duration = parseInt(v, 10); });
bindSeg("seg-audio", (v) => { state.audio = v; });
bindSeg("seg-img-aspect", (v) => { state.imgAspect = v; });
bindSeg("seg-batch", (v) => { state.batch = parseInt(v, 10); });

function renderStyleButtons() {
  const host = $("presets");
  host.innerHTML = "";
  const list = state.mode === "reel" ? REEL_STYLES : IMG_STYLES;
  list.forEach((s, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    const isActive = state.mode === "reel" ? s.suffix === state.reelStyleSuffix : state.imgStyles.has(s.suffix);
    btn.className = "preset" + (isActive ? (state.mode === "reel" ? " active-reel" : " active-image") : "");
    btn.textContent = s.name;
    btn.onclick = () => {
      if (state.mode === "reel") {
        state.reelStyleSuffix = s.suffix;
      } else {
        if (state.imgStyles.has(s.suffix)) state.imgStyles.delete(s.suffix);
        else state.imgStyles.add(s.suffix);
      }
      renderStyleButtons();
    };
    host.appendChild(btn);
  });
}

function switchMode(mode) {
  state.mode = mode;
  document.body.dataset.mode = mode;
  $("tab-reel").className = "nav-btn" + (mode === "reel" ? " active-reel" : "");
  $("tab-image").className = "nav-btn" + (mode === "image" ? " active-image" : "");
  $("reel-controls").style.display = mode === "reel" ? "block" : "none";
  $("image-controls").style.display = mode === "image" ? "block" : "none";
  $("reel-stage").style.display = mode === "reel" ? "block" : "none";
  $("image-stage").style.display = mode === "image" ? "block" : "none";
  $("btn-gen").textContent = mode === "reel" ? "Generate Reel" : "Generate Images";
  $("btn-mute").style.display = mode === "reel" && state.reelUrl && state.audio !== "none" ? "inline-block" : "none";
  $("btn-recompile").style.display = mode === "reel" && state.activeFrames.length > 0 ? "inline-block" : "none";
  $("btn-dl-reel").style.display = mode === "reel" && state.reelUrl ? "inline-block" : "none";
  $("btn-clear-all").style.display = (mode === "reel" ? state.savedReels.length : state.savedImages.length) > 0 ? "inline-block" : "none";
  renderStyleButtons();
}

$("tab-reel").onclick = () => switchMode("reel");
$("tab-image").onclick = () => switchMode("image");
$("mob-controls").onclick = () => {
  document.body.dataset.mobileView = "controls";
  $("mob-controls").classList.add("active"); $("mob-stage").classList.remove("active");
};
$("mob-stage").onclick = () => {
  document.body.dataset.mobileView = "stage";
  $("mob-stage").classList.add("active"); $("mob-controls").classList.remove("active");
};
$("btn-sample").onclick = () => {
  $("prompt").value = SAMPLES[state.sampleIdx % SAMPLES.length];
  state.sampleIdx++;
  $("prompt").focus();
};
$("btn-clear").onclick = () => { $("prompt").value = ""; $("prompt").focus(); };
$("btn-roll").onclick = () => { $("seed").value = Math.floor(Math.random() * 999999999); };
$("modal").onclick = () => $("modal").classList.remove("open");

// --- AUTO-CHAIN + LOCAL SYNTH + SUPER-RES ---
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
function localSynth(prompt, w, h, seed) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  let a = (seed ^ (prompt.length * 2654435761)) >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#0b0f1e"); g.addColorStop(0.55, "#2b1644"); g.addColorStop(1, "#090b12");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 4; i++) {
    const cx = rng() * w, cy = rng() * h, rad = Math.max(w, h) * 0.42;
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    rg.addColorStop(0, i % 2 ? "rgba(236,72,153,0.4)" : "rgba(56,189,248,0.3)");
    rg.addColorStop(1, "transparent");
    ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
  }
  return c.toDataURL("image/jpeg", 0.9);
}
async function fetchChainImage({ prompt, negative, width, height, seed, model }) {
  const s = seed || Math.floor(Math.random() * 1e9);
  try {
    const afModel = model === "turbo" ? "flux" : model;
    const res = await fetch("https://api.airforce/imagine2?prompt=" + encodeURIComponent(prompt) + "&model=" + encodeURIComponent(afModel) + "&width=" + width + "&height=" + height + "&seed=" + s);
    if (res.ok) {
      const ct = res.headers.get("content-type") || "";
      if (ct.startsWith("image/")) return { url: await blobToDataUrl(await res.blob()), seed: s, provider: "Airforce" };
      const d = await res.json();
      if (d && d.url) return { url: d.url, seed: s, provider: "Airforce" };
    }
  } catch {}
  try {
    const full = negative ? prompt + " | avoid: " + negative : prompt;
    const u = new URL("https://image.pollinations.ai/prompt/" + encodeURIComponent(full));
    u.searchParams.set("width", width); u.searchParams.set("height", height);
    u.searchParams.set("seed", s); u.searchParams.set("model", model === "flux-realism" ? "flux" : model);
    u.searchParams.set("nologo", "true");
    const res = await fetch(u.toString());
    if (res.ok && (res.headers.get("content-type") || "").startsWith("image/")) {
      return { url: await blobToDataUrl(await res.blob()), seed: s, provider: "Pollinations" };
    }
  } catch {}
  return { url: localSynth(prompt, width, height, s), seed: s, provider: "Local Synth" };
}
function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith("data:") && !src.startsWith("blob:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
async function upscaleSuperRes(url, factor) {
  const img = await loadImg(url);
  const sw = img.naturalWidth || 768, sh = img.naturalHeight || 768, maxD = 2560;
  let tw = Math.round(sw * factor), th = Math.round(sh * factor);
  if (Math.max(tw, th) > maxD) { const r = maxD / Math.max(tw, th); tw = Math.round(tw * r); th = Math.round(th * r); }
  let c = document.createElement("canvas"); c.width = sw; c.height = sh;
  c.getContext("2d").drawImage(img, 0, 0, sw, sh);
  let cw = sw, ch = sh;
  while (cw < tw || ch < th) {
    const nw = Math.min(tw, Math.round(cw * 1.5)), nh = Math.min(th, Math.round(ch * 1.5));
    const n = document.createElement("canvas"); n.width = nw; n.height = nh;
    const nctx = n.getContext("2d"); nctx.imageSmoothingEnabled = true; nctx.imageSmoothingQuality = "high";
    nctx.drawImage(c, 0, 0, nw, nh); c = n; cw = nw; ch = nh;
  }
  return { url: c.toDataURL("image/jpeg", 0.91), width: cw, height: ch, upscaler: "Super-Res" };
}

// --- REEL ENGINE & WEB AUDIO ---
function buildAudio(mode, durSec) {
  if (mode === "none" || typeof AudioContext === "undefined") return { stream: null, close: () => {} };
  try {
    const ctx = new AudioContext();
    if (ctx.resume) ctx.resume().catch(() => {});
    const dest = ctx.createMediaStreamDestination();
    const gain = ctx.createGain();
    const now = ctx.currentTime, total = durSec + 0.4;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.3);
    gain.gain.setValueAtTime(0.3, Math.max(now + 0.4, now + total - 0.5));
    gain.gain.linearRampToValueAtTime(0.001, now + total);
    gain.connect(dest);
    if (mode === "synth") {
      const notes = [55, 55, 65.41, 49, 73.42, 65.41, 55, 49];
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(640, now); f.connect(gain);
      const osc = ctx.createOscillator(); osc.type = "sawtooth"; osc.connect(f);
      for (let i = 0; i < Math.ceil(total / 0.5); i++) osc.frequency.setValueAtTime(notes[i % notes.length], now + i * 0.5);
      osc.start(now); osc.stop(now + total);
    } else if (mode === "rain") {
      const len = Math.floor(ctx.sampleRate * total);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.04 * w) / 1.04; d[i] = last * 2.5 + w * 0.14; }
      const src = ctx.createBufferSource(); src.buffer = buf;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1400;
      src.connect(lp); lp.connect(gain); src.start(now); src.stop(now + total);
    }
    return { stream: dest.stream, close: () => { try { ctx.close().catch(() => {}); } catch {} } };
  } catch { return { stream: null, close: () => {} }; }
}

function drawCover(ctx, img, cw, ch, scale, panX, alpha) {
  if (!img) return;
  const iw = img.naturalWidth || cw, ih = img.naturalHeight || ch;
  const bs = Math.max(cw / iw, ch / ih);
  const dw = iw * bs * scale, dh = ih * bs * scale;
  const maxX = Math.max(0, (dw - cw) / 2);
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.drawImage(img, (cw - dw) / 2 + panX * maxX, (ch - dh) / 2, dw, dh);
  ctx.restore();
}

async function compileReel(frames) {
  const v = state.reelAspect;
  const cw = v === "16:9" ? 960 : v === "1:1" ? 720 : 540;
  const ch = v === "16:9" ? 540 : v === "1:1" ? 720 : 960;
  const canvas = $("canvas"); canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext("2d");
  const imgs = await Promise.all(frames.map(loadImg));
  const duration = state.duration, motion = $("motion").value, fx = $("fx").value, audioMode = state.audio;

  $("reel-placeholder").style.display = "none";
  $("player").style.display = "none";
  canvas.style.display = "block";
  setStatus("Compiling anime reel...", true);

  const cStream = canvas.captureStream(30);
  const aBundle = buildAudio(audioMode, duration);
  const hasAudio = aBundle.stream && aBundle.stream.getAudioTracks().length > 0;
  const stream = hasAudio ? new MediaStream([...cStream.getVideoTracks(), ...aBundle.stream.getAudioTracks()]) : cStream;
  const mimes = hasAudio ? ["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm","video/mp4"] : ["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm","video/mp4"];
  const mime = mimes.find((m) => MediaRecorder.isTypeSupported(m)) || "";
  const recorder = mime ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4000000 }) : new MediaRecorder(stream);
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };

  return new Promise((resolve) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      aBundle.close();
      const blob = new Blob(chunks, { type: mime || "video/webm" });
      if (state.reelUrl) URL.revokeObjectURL(state.reelUrl);
      state.reelUrl = URL.createObjectURL(blob);
      showReelPlayer(state.reelUrl, mime.includes("mp4") ? "mp4" : "webm");
      resolve({ blob, mimeType: mime || "video/webm" });
    };
    const parts = Array.from({ length: 34 }, () => ({ x: Math.random() * cw, y: Math.random() * ch, r: 3 + Math.random() * 4, s: 1 + Math.random() * 1.5 }));
    recorder.start(120);
    let start = null;
    const durMs = duration * 1000;
    function tick(now) {
      if (start === null) start = now;
      const p = Math.max(0, Math.min(1, (now - start) / durMs));
      ctx.fillStyle = "#050608"; ctx.fillRect(0, 0, cw, ch);
      const seg = Math.max(0, Math.min(imgs.length - 1, Math.floor(p * imgs.length)));
      const lt = imgs.length === 1 ? p : Math.max(0, Math.min(1, p * imgs.length - seg));
      const e = -(Math.cos(Math.PI * lt) - 1) / 2;
      const m = motion === "dynamic_mix" ? ["zoom_in","pan_right","zoom_out","pan_left"][seg % 4] : motion;
      let sc = 1.02 + e * 0.25, px = 0;
      if (m === "zoom_out") sc = 1.28 - e * 0.25;
      else if (m === "pan_right") { sc = 1.22; px = 0.85 - e * 1.7; }
      else if (m === "pan_left") { sc = 1.22; px = -0.85 + e * 1.7; }
      drawCover(ctx, imgs[seg], cw, ch, sc, px, 1);
      if (seg < imgs.length - 1 && lt > 0.8) drawCover(ctx, imgs[seg + 1], cw, ch, 1.04, 0, (lt - 0.8) / 0.2);

      if (fx === "sakura") {
        ctx.fillStyle = "rgba(249,168,212,0.8)";
        parts.forEach((pt) => { pt.y = (pt.y + pt.s) % (ch + 16); pt.x = (pt.x + 0.8) % (cw + 16); ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2); ctx.fill(); });
      } else if (fx === "embers") {
        ctx.fillStyle = "rgba(251,146,60,0.8)";
        parts.forEach((pt) => { pt.y = (pt.y - pt.s + ch) % ch; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r * 0.8, 0, Math.PI * 2); ctx.fill(); });
      } else if (fx === "rain") {
        ctx.strokeStyle = "rgba(186,230,253,0.45)";
        for (let i = 0; i < 48; i++) { const rx = Math.random() * cw, ry = Math.random() * ch; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 2, ry + 16); ctx.stroke(); }
      } else if (fx === "speed_lines") {
        ctx.strokeStyle = "rgba(255,255,255,0.22)";
        for (let i = 0; i < 24; i++) { const a = Math.random() * Math.PI * 2, r1 = Math.min(cw, ch) * 0.36, r2 = Math.hypot(cw, ch) * 0.6; ctx.beginPath(); ctx.moveTo(cw/2 + Math.cos(a)*r1, ch/2 + Math.sin(a)*r1); ctx.lineTo(cw/2 + Math.cos(a)*r2, ch/2 + Math.sin(a)*r2); ctx.stroke(); }
      } else if (fx === "glitch" && Math.random() > 0.85) {
        try { const sy = Math.floor(Math.random() * (ch - 40)), sh = 14 + Math.floor(Math.random() * 28); ctx.putImageData(ctx.getImageData(0, sy, cw, sh), (Math.random() - 0.5) * 34, sy); } catch {}
      }
      if (p >= 1) { recorder.stop(); return; }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

function showReelPlayer(url, ext) {
  $("canvas").style.display = "none";
  $("reel-placeholder").style.display = "none";
  const player = $("player");
  player.src = url; player.muted = true; player.style.display = "block";
  $("btn-mute").textContent = "Unmute Audio";
  $("btn-mute").style.display = state.audio !== "none" ? "inline-block" : "none";
  $("btn-recompile").style.display = state.activeFrames.length > 0 ? "inline-block" : "none";
  $("btn-dl-reel").href = url; $("btn-dl-reel").download = "anime-reel." + ext;
  $("btn-dl-reel").style.display = "inline-block";
}

$("btn-mute").onclick = () => {
  const player = $("player");
  player.muted = !player.muted;
  if (!player.muted) player.play().catch(() => {});
  $("btn-mute").textContent = player.muted ? "Unmute Audio" : "Sound On";
};

function renderKeyframes() {
  if (!state.activeFrames.length) { $("kf-section").style.display = "none"; return; }
  $("kf-section").style.display = "block";
  $("kf-providers").textContent = state.activeProviders.join(" · ");
  $("kf-grid").innerHTML = "";
  state.activeFrames.forEach((src) => {
    const d = document.createElement("div"); d.className = "kf-card";
    d.innerHTML = '<img src="' + src + '" alt="Keyframe" />';
    $("kf-grid").appendChild(d);
  });
}

function renderSavedReels() {
  const list = state.savedReels;
  $("saved-reels-section").style.display = list.length ? "block" : "none";
  $("saved-reels-count").textContent = list.length + " stored";
  $("btn-clear-all").style.display = state.mode === "reel" && list.length ? "inline-block" : $("btn-clear-all").style.display;
  const host = $("saved-reels"); host.innerHTML = "";
  list.forEach((rec) => {
    const row = document.createElement("div"); row.className = "reel-item";
    row.innerHTML =
      '<div class="reel-thumb"><img src="' + rec.frames[0] + '" alt="" /></div>' +
      '<div class="reel-meta"><div class="reel-title">' + escapeHtml(rec.prompt) + '</div><div class="reel-sub">' + rec.aspect + ' · ' + rec.duration + 's · ' + rec.frames.length + 'f · ' + rec.fx + '</div></div>' +
      '<button type="button" class="btn-del" aria-label="Delete">×</button>';
    row.onclick = async (e) => {
      if (e.target.classList.contains("btn-del")) return;
      state.activeFrames = rec.frames;
      state.activeProviders = rec.providers || [];
      state.audio = rec.audio || "none";
      renderKeyframes();
      if (rec.videoBlob instanceof Blob) {
        if (state.reelUrl) URL.revokeObjectURL(state.reelUrl);
        state.reelUrl = URL.createObjectURL(rec.videoBlob);
        showReelPlayer(state.reelUrl, rec.mimeType && rec.mimeType.includes("mp4") ? "mp4" : "webm");
        setStatus("Reel loaded from IndexedDB", false);
      } else {
        const compiled = await compileReel(rec.frames);
        rec.videoBlob = compiled.blob; rec.mimeType = compiled.mimeType;
        await dbPut("reels", rec);
        setStatus("Reel ready", false);
      }
    };
    row.querySelector(".btn-del").onclick = async () => {
      state.savedReels = state.savedReels.filter((r) => r.id !== rec.id);
      await dbDelete("reels", rec.id);
      renderSavedReels();
    };
    host.appendChild(row);
  });
}

function renderGallery() {
  const host = $("gallery"); host.innerHTML = "";
  $("img-empty").style.display = state.savedImages.length ? "none" : "block";
  if (state.mode === "image") $("btn-clear-all").style.display = state.savedImages.length ? "inline-block" : "none";
  state.savedImages.forEach((item) => {
    const card = document.createElement("div"); card.className = "img-card";
    card.innerHTML =
      '<div class="img-box"><img src="' + item.url + '" alt="' + escapeHtml(item.prompt) + '" loading="lazy" /></div>' +
      '<div class="img-info"><div class="img-prompt">' + escapeHtml(item.prompt) + '</div><div class="img-sub">' + item.width + '×' + item.height + ' · ' + item.provider + '</div>' +
      '<div class="img-acts"><a href="' + item.url + '" download="forge-' + item.seed + '.png">Save</a><button type="button" data-up="1">2×</button><button type="button" data-reuse="1">Reuse</button><button type="button" data-del="1">Del</button></div></div>';
    card.querySelector(".img-box").onclick = () => { $("modal-img").src = item.url; $("modal").classList.add("open"); };
    card.querySelector("[data-up]").onclick = async (e) => {
      e.target.disabled = true; setStatus("Upscaling 2×...", true);
      try {
        const up = await upscaleSuperRes(item.url, 2);
        const upItem = { ...item, id: "img-" + Date.now(), url: up.url, width: up.width, height: up.height, createdAt: Date.now() };
        state.savedImages.unshift(upItem); await dbPut("images", upItem); renderGallery(); setStatus("Upscaled 2×", false);
      } finally { e.target.disabled = false; }
    };
    card.querySelector("[data-reuse]").onclick = () => { $("prompt").value = item.prompt; $("prompt").focus(); };
    card.querySelector("[data-del]").onclick = async () => {
      state.savedImages = state.savedImages.filter((x) => x.id !== item.id);
      await dbDelete("images", item.id); renderGallery();
    };
    host.appendChild(card);
  });
}

$("btn-recompile").onclick = async () => {
  if (state.busy || !state.activeFrames.length) return;
  state.busy = true; $("btn-gen").disabled = true;
  await compileReel(state.activeFrames);
  setStatus("Reel updated", false);
  state.busy = false; $("btn-gen").disabled = false;
};

$("btn-clear-all").onclick = async () => {
  if (state.mode === "reel") {
    state.savedReels = []; await dbClear("reels"); renderSavedReels();
  } else {
    state.savedImages = []; await dbClear("images"); renderGallery();
  }
  $("btn-clear-all").style.display = "none";
};

$("btn-gen").onclick = async () => {
  if (state.busy) return;
  const raw = $("prompt").value.trim();
  if (!raw) { $("prompt").focus(); return; }
  document.body.dataset.mobileView = "stage";
  $("mob-stage").classList.add("active"); $("mob-controls").classList.remove("active");
  state.busy = true; $("btn-gen").disabled = true;

  try {
    if (state.mode === "reel") {
      const v = state.reelAspect;
      const gw = v === "16:9" ? 1024 : v === "1:1" ? 768 : 576;
      const gh = v === "16:9" ? 576 : v === "1:1" ? 768 : 1024;
      const beats = ["", ", wide establishing angle, atmospheric depth", ", dramatic close-up shot, glowing highlights", ", dynamic low-angle action", ", silhouette against vibrant sky", ", drifting particles"];
      const baseSeed = Math.floor(Math.random() * 1e9);
      state.activeFrames = []; state.activeProviders = [];
      for (let i = 0; i < state.cuts; i++) {
        setStatus("Generating keyframe " + (i + 1) + "/" + state.cuts + "...", true);
        const res = await fetchChainImage({
          prompt: raw + (state.cuts > 1 ? beats[i % beats.length] : "") + state.reelStyleSuffix,
          negative: "blurry, watermark, lowres", width: gw, height: gh, seed: baseSeed + i * 7919, model: "flux"
        });
        state.activeFrames.push(res.url); state.activeProviders.push(res.provider);
        renderKeyframes();
      }
      const compiled = await compileReel(state.activeFrames);
      const rec = {
        id: "reel-" + Date.now(), prompt: raw, aspect: state.reelAspect, duration: state.duration,
        fx: $("fx").value, audio: state.audio, frames: [...state.activeFrames], providers: [...state.activeProviders],
        videoBlob: compiled.blob, mimeType: compiled.mimeType, createdAt: Date.now()
      };
      state.savedReels.unshift(rec);
      await dbPut("reels", rec);
      renderSavedReels();
      setStatus("Reel ready", false);
    } else {
      const a = state.imgAspect;
      const w = a === "3:4" ? 576 : a === "9:16" ? 512 : a === "16:9" ? 896 : 768;
      const h = a === "4:3" ? 576 : a === "16:9" ? 512 : a === "9:16" ? 896 : 768;
      const seedVal = $("seed").value.trim();
      const baseSeed = seedVal !== "" ? parseInt(seedVal, 10) : Math.floor(Math.random() * 1e9);
      $("seed").value = baseSeed;
      const factor = parseInt($("upscale").value, 10) || 1;
      const model = $("model").value, neg = $("neg").value.trim();
      const styleStr = [...state.imgStyles].join("");
      for (let i = 0; i < state.batch; i++) {
        setStatus("Generating image " + (i + 1) + "/" + state.batch + "...", true);
        let res = await fetchChainImage({ prompt: raw + styleStr, negative: neg, width: w, height: h, seed: baseSeed + i, model });
        let finalW = w, finalH = h;
        if (factor > 1) {
          setStatus("Upscaling " + factor + "×...", true);
          const up = await upscaleSuperRes(res.url, factor);
          res.url = up.url; finalW = up.width; finalH = up.height;
        }
        const item = { id: "img-" + Date.now() + "-" + i, url: res.url, prompt: raw, seed: res.seed, width: finalW, height: finalH, provider: res.provider, createdAt: Date.now() };
        state.savedImages.unshift(item);
        await dbPut("images", item);
        renderGallery();
      }
      setStatus("Done", false);
    }
  } catch (err) {
    setStatus("Error: " + err.message, false);
  } finally {
    state.busy = false; $("btn-gen").disabled = false;
  }
};

(async function init() {
  switchMode(state.mode);
  state.savedReels = await dbGetAll("reels");
  state.savedImages = await dbGetAll("images");
  renderSavedReels();
  renderGallery();
})();
</script>
</body>
</html>`;
}

export function generateStandaloneReelHtml(): string {
  return generateConsolidatedHtml('reel');
}

export function generateStandaloneHtml(): string {
  return generateConsolidatedHtml('image');
}

export function downloadStandaloneHtml(mode: 'reel' | 'image' = 'reel'): void {
  const html = generateConsolidatedHtml(mode);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'animereel-studio.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
