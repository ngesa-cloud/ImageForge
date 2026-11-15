import {
  AspectRatio,
  ChainMode,
  GenerationItem,
  ModelId,
  ProviderName,
  StylePreset,
  UpscaleFactor,
  UpscalerName,
} from '../types/forge';

export const STORAGE_KEY = 'forge_history_v2';
export const LOCAL_SERVER_STORAGE_KEY = 'forge_local_server_url';
export const DEFAULT_LOCAL_SERVER_URL = 'http://127.0.0.1:8000/generate';
export const MAX_HISTORY = 50;

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'cinematic',
    name: 'Cinematic',
    suffix: ', cinematic lighting, shallow depth of field, film grain, 35mm',
  },
  {
    id: 'anime',
    name: 'Anime',
    suffix: ', anime key visual, clean lineart, vibrant colors, studio quality',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    suffix: ', cyberpunk, neon reflections, rain-slick streets, high contrast',
  },
  {
    id: 'oil-paint',
    name: 'Oil Paint',
    suffix: ', oil on canvas, thick impasto brushstrokes, museum lighting',
  },
  {
    id: '3d-render',
    name: '3D Render',
    suffix: ', octane render, subsurface scattering, volumetric light, 8k',
  },
  {
    id: 'studio',
    name: 'Studio',
    suffix: ', studio product photography, softbox lighting, crisp detail',
  },
  {
    id: 'watercolor',
    name: 'Watercolor',
    suffix: ', loose watercolor wash, cold press paper texture, soft edges',
  },
  {
    id: 'editorial',
    name: 'Editorial',
    suffix: ', documentary editorial photography, natural window shadows, Leica 35mm',
  },
];

export const ASPECT_DIMENSIONS: Record<
  AspectRatio,
  { width: number; height: number; label: string }
> = {
  '1:1': { width: 768, height: 768, label: '1:1 Square' },
  '3:4': { width: 576, height: 768, label: '3:4 Portrait' },
  '4:3': { width: 768, height: 576, label: '4:3 Landscape' },
  '9:16': { width: 512, height: 896, label: '9:16 Vertical' },
  '16:9': { width: 896, height: 512, label: '16:9 Wide' },
};

export const STARTER_PROMPTS = [
  'Brutalist concrete observatory overlooking a misty alpine valley at dawn',
  'Macro studio shot of translucent amber resin enclosing copper clockwork gears',
  'Rain-slicked Tokyo side street at midnight, warm lantern glow on wet asphalt',
  'Minimalist botanical study of silver eucalyptus leaves on travertine stone',
];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickPalette(
  prompt: string,
  rng: () => number
): [string, string, string, string] {
  const lower = prompt.toLowerCase();
  if (lower.includes('cyber') || lower.includes('neon') || lower.includes('tokyo')) {
    return ['#0B0F1E', '#1E1B4B', '#38BDF8', '#F472B6'];
  }
  if (
    lower.includes('forest') ||
    lower.includes('botanical') ||
    lower.includes('valley') ||
    lower.includes('eucalyptus')
  ) {
    return ['#0B1712', '#1B3B2B', '#6EE7B7', '#D9E4DD'];
  }
  if (
    lower.includes('gold') ||
    lower.includes('amber') ||
    lower.includes('sunset') ||
    lower.includes('dawn')
  ) {
    return ['#140F0D', '#3F2316', '#F59E0B', '#FDE68A'];
  }
  if (
    lower.includes('ocean') ||
    lower.includes('sea') ||
    lower.includes('water') ||
    lower.includes('rain')
  ) {
    return ['#08131E', '#102A43', '#38BDF8', '#BAE6FD'];
  }
  const palettes: [string, string, string, string][] = [
    ['#0D111A', '#1E293B', '#6366F1', '#C7D2FE'],
    ['#13111C', '#2E1F47', '#A78BFA', '#F3E8FF'],
    ['#11181C', '#1F2F38', '#38BDF8', '#E0F2FE'],
    ['#181310', '#382A22', '#FB923C', '#FFEDD5'],
  ];
  return palettes[Math.floor(rng() * palettes.length)];
}

export function generateLocalSynth(params: {
  prompt: string;
  width: number;
  height: number;
  seed: number;
}): string {
  const { prompt, width, height, seed } = params;
  const combinedSeed = (seed ^ hashString(prompt)) >>> 0;
  const rng = mulberry32(combinedSeed);
  const [bg1, bg2, accent1, accent2] = pickPalette(prompt, rng);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const baseGrad = ctx.createLinearGradient(0, 0, width * 0.85, height);
  baseGrad.addColorStop(0, bg1);
  baseGrad.addColorStop(0.55, bg2);
  baseGrad.addColorStop(1, bg1);
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 4; i++) {
    const cx = rng() * width;
    const cy = rng() * height;
    const r = Math.max(width, height) * (0.28 + rng() * 0.35);
    const orb = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    const color = i % 2 === 0 ? accent1 : accent2;
    orb.addColorStop(0, `${color}55`);
    orb.addColorStop(0.45, `${color}1A`);
    orb.addColorStop(1, 'transparent');
    ctx.fillStyle = orb;
    ctx.fillRect(0, 0, width, height);
  }

  const layers = 4;
  for (let l = 0; l < layers; l++) {
    const baseY = height * (0.42 + l * 0.14);
    ctx.beginPath();
    ctx.moveTo(0, height);
    const amp = 18 + rng() * 38;
    const freq = 0.004 + rng() * 0.007;
    const phase = rng() * Math.PI * 2;
    for (let x = 0; x <= width; x += 12) {
      const y =
        baseY +
        Math.sin(x * freq + phase) * amp +
        Math.cos(x * freq * 1.9 - phase) * (amp * 0.4);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = l % 2 === 0 ? `${bg1}CC` : `${bg2}99`;
    ctx.fill();
  }

  ctx.save();
  const focusX = width * (0.35 + rng() * 0.3);
  const focusY = height * (0.32 + rng() * 0.25);
  const mainRadius = Math.min(width, height) * (0.14 + rng() * 0.1);

  const discGrad = ctx.createLinearGradient(
    focusX - mainRadius,
    focusY - mainRadius,
    focusX + mainRadius,
    focusY + mainRadius
  );
  discGrad.addColorStop(0, `${accent2}DD`);
  discGrad.addColorStop(1, `${accent1}22`);
  ctx.beginPath();
  ctx.arc(focusX, focusY, mainRadius, 0, Math.PI * 2);
  ctx.fillStyle = discGrad;
  ctx.fill();

  ctx.strokeStyle = `${accent2}44`;
  ctx.lineWidth = 1.25;
  for (let r = 0; r < 3; r++) {
    ctx.beginPath();
    ctx.ellipse(
      focusX,
      focusY,
      mainRadius * (1.35 + r * 0.35),
      mainRadius * (0.45 + r * 0.18),
      (rng() - 0.5) * 0.8,
      0,
      Math.PI * 2
    );
    ctx.stroke();
  }
  ctx.restore();

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (rng() - 0.5) * 14;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL('image/jpeg', 0.9);
}

async function blobToPersistentUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to encode image'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read image blob'));
    reader.readAsDataURL(blob);
  });
}

function createRequestSignal(
  parentSignal?: AbortSignal,
  timeoutMs = 22000
): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error('Request timed out')),
    timeoutMs
  );
  const onParentAbort = () => controller.abort(parentSignal?.reason);
  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort(parentSignal.reason);
    } else {
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }
  }
  const cleanup = () => {
    clearTimeout(timer);
    if (parentSignal) {
      parentSignal.removeEventListener('abort', onParentAbort);
    }
  };
  return { signal: controller.signal, cleanup };
}

async function tryExpressProxy(params: {
  fullPrompt: string;
  negative: string;
  width: number;
  height: number;
  seed: number;
  model: ModelId;
  chainMode: ChainMode;
  signal?: AbortSignal;
}): Promise<{
  url?: string;
  provider?: ProviderName;
  note?: string;
  fallback?: boolean;
  isolatedError?: string;
  errors?: string[];
}> {
  const req = createRequestSignal(params.signal, 35000);
  try {
    const res = await fetch('/api/forge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullPrompt: params.fullPrompt,
        negative: params.negative,
        width: params.width,
        height: params.height,
        seed: params.seed,
        model: params.model,
        chainMode: params.chainMode,
      }),
      signal: req.signal,
    });
    if (!res.ok) {
      throw new Error(`Proxy HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    req.cleanup();
  }
}

async function tryAirforceDirect(
  fullPrompt: string,
  width: number,
  height: number,
  seed: number,
  model: ModelId,
  signal?: AbortSignal
): Promise<{ url: string; provider: ProviderName }> {
  const afModel = model === 'turbo' ? 'flux' : model;
  const endpoint = `https://api.airforce/imagine2?prompt=${encodeURIComponent(
    fullPrompt
  )}&model=${encodeURIComponent(afModel)}&width=${width}&height=${height}&seed=${seed}`;

  const req = createRequestSignal(signal, 22000);
  try {
    const res = await fetch(endpoint, { signal: req.signal });
    if (!res.ok) {
      throw new Error(`Airforce HTTP ${res.status}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.startsWith('image/')) {
      const blob = await res.blob();
      if (blob.size < 256) throw new Error('Airforce returned empty image');
      const url = await blobToPersistentUrl(blob);
      return { url, provider: 'Airforce' };
    }

    const data = await res.json();
    if (data && typeof data.url === 'string' && data.url.startsWith('http')) {
      return { url: data.url, provider: 'Airforce' };
    }
    if (data && typeof data.b64_json === 'string') {
      return { url: `data:image/png;base64,${data.b64_json}`, provider: 'Airforce' };
    }
    throw new Error('Airforce returned unexpected payload');
  } finally {
    req.cleanup();
  }
}

async function tryPollinationsDirect(
  fullPrompt: string,
  negative: string,
  width: number,
  height: number,
  seed: number,
  model: ModelId,
  signal?: AbortSignal
): Promise<{ url: string; provider: ProviderName }> {
  const combinedPrompt = negative
    ? `${fullPrompt} | avoid: ${negative}`
    : fullPrompt;
  const u = new URL(
    `https://image.pollinations.ai/prompt/${encodeURIComponent(combinedPrompt)}`
  );
  u.searchParams.set('width', String(width));
  u.searchParams.set('height', String(height));
  u.searchParams.set('seed', String(seed));
  u.searchParams.set('model', model === 'flux-realism' ? 'flux' : model);
  u.searchParams.set('nologo', 'true');

  const req = createRequestSignal(signal, 25000);
  try {
    const res = await fetch(u.toString(), { signal: req.signal });
    if (res.status === 402) {
      throw new Error('Pollinations refused prompt (402)');
    }
    if (!res.ok) {
      throw new Error(`Pollinations HTTP ${res.status}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      throw new Error('Pollinations returned non-image response');
    }

    const blob = await res.blob();
    if (blob.size < 256) throw new Error('Pollinations returned empty image');
    const url = await blobToPersistentUrl(blob);
    return { url, provider: 'Pollinations' };
  } finally {
    req.cleanup();
  }
}

async function tryLocalPythonServer(params: {
  serverUrl: string;
  fullPrompt: string;
  negative: string;
  width: number;
  height: number;
  seed: number;
  model: ModelId;
  signal?: AbortSignal;
}): Promise<{ url: string; provider: ProviderName }> {
  const trimmedUrl = params.serverUrl.trim();
  if (!trimmedUrl) {
    throw new Error('No local server URL configured');
  }

  const req = createRequestSignal(params.signal, 15000);
  try {
    const res = await fetch(trimmedUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: params.fullPrompt,
        negative_prompt: params.negative,
        width: params.width,
        height: params.height,
        seed: params.seed,
        model: params.model,
      }),
      signal: req.signal,
    });
    if (!res.ok) {
      throw new Error(`Local server HTTP ${res.status}`);
    }

    const ct = res.headers.get('content-type') || '';
    if (ct.startsWith('image/')) {
      const blob = await res.blob();
      const url = await blobToPersistentUrl(blob);
      return { url, provider: 'Local Synth' };
    }

    const data = await res.json();
    if (data && typeof data.url === 'string') {
      return { url: data.url, provider: 'Local Synth' };
    }
    if (data && typeof data.image === 'string') {
      const prefix = data.image.startsWith('data:')
        ? ''
        : 'data:image/png;base64,';
      return { url: `${prefix}${data.image}`, provider: 'Local Synth' };
    }
    if (data && Array.isArray(data.images) && typeof data.images[0] === 'string') {
      const first = data.images[0];
      const prefix = first.startsWith('data:') ? '' : 'data:image/png;base64,';
      return { url: `${prefix}${first}`, provider: 'Local Synth' };
    }
    throw new Error('Unexpected local server payload');
  } finally {
    req.cleanup();
  }
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for upscaling'));
    img.src = src;
  });
}

async function upscaleCanvasSuperRes(
  sourceUrl: string,
  scaleFactor: 2 | 4
): Promise<{ url: string; width: number; height: number; upscaler: UpscalerName }> {
  const img = await loadHtmlImage(sourceUrl);
  const srcW = img.naturalWidth || img.width || 768;
  const srcH = img.naturalHeight || img.height || 768;

  // Cap max edge to 2560px so browser canvas & storage stay responsive
  const maxDim = 2560;
  let targetW = Math.round(srcW * scaleFactor);
  let targetH = Math.round(srcH * scaleFactor);
  if (Math.max(targetW, targetH) > maxDim) {
    const clampRatio = maxDim / Math.max(targetW, targetH);
    targetW = Math.round(targetW * clampRatio);
    targetH = Math.round(targetH * clampRatio);
  }

  // Progressive stepped bicubic upscaling
  let currentCanvas = document.createElement('canvas');
  currentCanvas.width = srcW;
  currentCanvas.height = srcH;
  const baseCtx = currentCanvas.getContext('2d');
  if (!baseCtx) throw new Error('Canvas 2D unavailable');
  baseCtx.drawImage(img, 0, 0, srcW, srcH);

  let curW = srcW;
  let curH = srcH;
  while (curW < targetW || curH < targetH) {
    const nextW = Math.min(targetW, Math.round(curW * 1.5));
    const nextH = Math.min(targetH, Math.round(curH * 1.5));
    const stepCanvas = document.createElement('canvas');
    stepCanvas.width = nextW;
    stepCanvas.height = nextH;
    const stepCtx = stepCanvas.getContext('2d');
    if (!stepCtx) break;
    stepCtx.imageSmoothingEnabled = true;
    stepCtx.imageSmoothingQuality = 'high';
    stepCtx.drawImage(currentCanvas, 0, 0, nextW, nextH);
    currentCanvas = stepCanvas;
    curW = nextW;
    curH = nextH;
    if (curW === targetW && curH === targetH) break;
  }

  // Subtle 3x3 unsharp-mask edge crispness pass
  const finalCtx = currentCanvas.getContext('2d');
  if (finalCtx) {
    try {
      const imgData = finalCtx.getImageData(0, 0, curW, curH);
      const src = imgData.data;
      const out = new Uint8ClampedArray(src.length);
      const amount = 0.34;
      for (let y = 0; y < curH; y++) {
        for (let x = 0; x < curW; x++) {
          const idx = (y * curW + x) * 4;
          if (x === 0 || y === 0 || x === curW - 1 || y === curH - 1) {
            out[idx] = src[idx];
            out[idx + 1] = src[idx + 1];
            out[idx + 2] = src[idx + 2];
            out[idx + 3] = src[idx + 3];
            continue;
          }
          const up = idx - curW * 4;
          const down = idx + curW * 4;
          const left = idx - 4;
          const right = idx + 4;
          for (let c = 0; c < 3; c++) {
            const center = src[idx + c];
            const blur =
              (src[up + c] + src[down + c] + src[left + c] + src[right + c]) * 0.25;
            const sharpened = center + (center - blur) * amount;
            out[idx + c] = sharpened < 0 ? 0 : sharpened > 255 ? 255 : sharpened;
          }
          out[idx + 3] = src[idx + 3];
        }
      }
      imgData.data.set(out);
      finalCtx.putImageData(imgData, 0, 0);
    } catch {
      // If image came from CORS-restricted URL without proxy, keep smooth upscaled canvas
    }
  }

  return {
    url: currentCanvas.toDataURL('image/jpeg', 0.91),
    width: curW,
    height: curH,
    upscaler: 'Super-Res',
  };
}

export async function upscaleImageWithChain(
  params: {
    imageUrl: string;
    scaleFactor: 2 | 4;
    prompt?: string;
    localServerUrl?: string;
  },
  callbacks: {
    signal?: AbortSignal;
    onStage?: (stage: string) => void;
  } = {}
): Promise<{
  url: string;
  width: number;
  height: number;
  upscaler: UpscalerName;
  note?: string;
}> {
  const { imageUrl, scaleFactor, prompt, localServerUrl } = params;
  const { signal, onStage } = callbacks;

  let resolvedSource = imageUrl;

  // 1. Magnific API via Express /api/upscale proxy
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  onStage?.(`Upscaling ${scaleFactor}× via Magnific...`);
  const proxyReq = createRequestSignal(signal, 60000);
  try {
    const res = await fetch('/api/upscale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl,
        scaleFactor,
        prompt,
      }),
      signal: proxyReq.signal,
    });
    if (res.ok) {
      const data = (await res.json()) as {
        url?: string;
        upscaler?: UpscalerName;
        fallback?: boolean;
        sourceDataUrl?: string;
        reason?: string;
      };
      if (data.url && !data.fallback) {
        const img = await loadHtmlImage(data.url);
        return {
          url: data.url,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          upscaler: data.upscaler || 'Magnific',
        };
      }
      if (data.sourceDataUrl) {
        resolvedSource = data.sourceDataUrl;
      }
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError' && signal?.aborted) throw err;
    // Continue down upscale chain
  } finally {
    proxyReq.cleanup();
  }

  // 2. Optional Local Python Upscaler endpoint
  if (localServerUrl?.trim()) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const upscaleEndpoint = localServerUrl
      .trim()
      .replace(/\/generate\/?$/, '/upscale');
    if (upscaleEndpoint !== localServerUrl.trim()) {
      onStage?.(`Trying local ${scaleFactor}× upscaler...`);
      const localReq = createRequestSignal(signal, 25000);
      try {
        const res = await fetch(upscaleEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: resolvedSource,
            scale: scaleFactor,
            prompt,
          }),
          signal: localReq.signal,
        });
        if (res.ok) {
          const ct = res.headers.get('content-type') || '';
          let upscaledUrl = '';
          if (ct.startsWith('image/')) {
            upscaledUrl = await blobToPersistentUrl(await res.blob());
          } else {
            const data = await res.json();
            if (typeof data?.url === 'string') upscaledUrl = data.url;
            else if (typeof data?.image === 'string') {
              upscaledUrl = data.image.startsWith('data:')
                ? data.image
                : `data:image/png;base64,${data.image}`;
            }
          }
          if (upscaledUrl) {
            const img = await loadHtmlImage(upscaledUrl);
            return {
              url: upscaledUrl,
              width: img.naturalWidth || img.width,
              height: img.naturalHeight || img.height,
              upscaler: 'Local Upscaler',
            };
          }
        }
      } catch {
        // Fall through to Super-Res canvas upscaling
      } finally {
        localReq.cleanup();
      }
    }
  }

  // 3. Progressive Bicubic + Unsharp-Mask Super-Resolution
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  onStage?.(`Upscaling ${scaleFactor}× via Super-Res...`);
  const superRes = await upscaleCanvasSuperRes(resolvedSource, scaleFactor);
  return {
    ...superRes,
    note: `Upscaled ${scaleFactor}× (${superRes.upscaler})`,
  };
}

async function generateBaseImage(
  params: {
    fullPrompt: string;
    negative: string;
    width: number;
    height: number;
    seed: number;
    model: ModelId;
    chainMode: ChainMode;
    localServerUrl?: string;
  },
  callbacks: {
    signal?: AbortSignal;
    onStage?: (stage: string) => void;
  }
): Promise<{
  url: string;
  provider: ProviderName;
  note?: string;
}> {
  const {
    fullPrompt,
    negative,
    width,
    height,
    seed,
    model,
    chainMode,
    localServerUrl,
  } = params;
  const { signal, onStage } = callbacks;
  const errors: string[] = [];

  if (chainMode === 'local') {
    if (localServerUrl?.trim()) {
      onStage?.('Querying local inference server...');
      try {
        const localRes = await tryLocalPythonServer({
          serverUrl: localServerUrl,
          fullPrompt,
          negative,
          width,
          height,
          seed,
          model,
          signal,
        });
        return {
          ...localRes,
          note: 'Generated by local Python server',
        };
      } catch {
        // Degrade cleanly to deterministic canvas synthesis
      }
    }
    onStage?.('Synthesizing locally...');
    const url = generateLocalSynth({ prompt: fullPrompt, width, height, seed });
    return { url, provider: 'Local Synth' };
  }

  // 1. Express pass-through proxy (zero prompt inspection, zero CORS issues)
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  onStage?.(
    chainMode === 'auto'
      ? 'Running auto-chain (Airforce → Pollinations)...'
      : `Querying ${chainMode}...`
  );
  let proxyFailedHard = false;
  try {
    const proxyRes = await tryExpressProxy({
      fullPrompt,
      negative,
      width,
      height,
      seed,
      model,
      chainMode,
      signal,
    });
    if (proxyRes.url && proxyRes.provider && !proxyRes.fallback) {
      return {
        url: proxyRes.url,
        provider: proxyRes.provider,
        note: proxyRes.note,
      };
    }
    if (Array.isArray(proxyRes.errors)) {
      errors.push(...proxyRes.errors);
    }
    if (proxyRes.isolatedError && chainMode !== 'auto') {
      errors.push(proxyRes.isolatedError);
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError' && signal?.aborted) throw err;
    proxyFailedHard = true;
  }

  // If Express proxy was absent, unreachable, or hit server-IP rate limits, try direct browser chain
  if (proxyFailedHard && (chainMode === 'auto' || chainMode === 'airforce')) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    onStage?.('Querying Airforce directly...');
    try {
      const af = await tryAirforceDirect(
        fullPrompt,
        width,
        height,
        seed,
        model,
        signal
      );
      return af;
    } catch (afErr) {
      if ((afErr as Error).name === 'AbortError' && signal?.aborted) throw afErr;
      errors.push((afErr as Error).message || 'Airforce unavailable');
      if (chainMode === 'airforce') {
        throw new Error(errors.join('; '));
      }
    }
  } else if (chainMode === 'airforce' && errors.length > 0) {
    throw new Error(errors.join('; '));
  }

  if (chainMode === 'auto' || chainMode === 'pollinations') {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    onStage?.('Trying Pollinations from browser...');
    try {
      const poll = await tryPollinationsDirect(
        fullPrompt,
        negative,
        width,
        height,
        seed,
        model,
        signal
      );
      return {
        ...poll,
        note: errors.length ? `Fallback after ${errors[0]}` : undefined,
      };
    } catch (pollErr) {
      if ((pollErr as Error).name === 'AbortError' && signal?.aborted) {
        throw pollErr;
      }
      errors.push((pollErr as Error).message || 'Pollinations unavailable');
      if (chainMode === 'pollinations') {
        throw new Error(errors.join('; '));
      }
    }
  }

  // 2. Local Python server fallback (if running locally)
  if (localServerUrl?.trim()) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    onStage?.('Trying local Python server...');
    try {
      const localRes = await tryLocalPythonServer({
        serverUrl: localServerUrl,
        fullPrompt,
        negative,
        width,
        height,
        seed,
        model,
        signal,
      });
      return {
        ...localRes,
        note: errors.length
          ? `Local server fallback (${errors[0]})`
          : 'Local Python server',
      };
    } catch {
      // Ignore unreachable local server and degrade to canvas synth
    }
  }

  // 3. Final guaranteed placeholder synth (never throws 402 on auto route)
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  onStage?.('Degrading to Local Synth...');
  const url = generateLocalSynth({ prompt: fullPrompt, width, height, seed });
  return {
    url,
    provider: 'Local Synth',
    note: errors.length
      ? `Offline canvas fallback (${errors.join(' · ')})`
      : 'Offline canvas fallback',
  };
}

export async function fetchImageWithChain(
  params: {
    prompt: string;
    activeStyles: string[];
    negative: string;
    width: number;
    height: number;
    seed: number;
    model: ModelId;
    chainMode: ChainMode;
    localServerUrl?: string;
    upscaleFactor?: UpscaleFactor;
  },
  callbacks: {
    signal?: AbortSignal;
    onStage?: (stage: string) => void;
  } = {}
): Promise<{
  url: string;
  width: number;
  height: number;
  provider: ProviderName;
  fullPrompt: string;
  upscaleFactor?: UpscaleFactor;
  upscaler?: UpscalerName;
  note?: string;
}> {
  const {
    prompt,
    activeStyles,
    negative,
    width,
    height,
    seed,
    model,
    chainMode,
    localServerUrl,
    upscaleFactor = 1,
  } = params;
  const { signal, onStage } = callbacks;
  const fullPrompt = `${prompt}${activeStyles.join('')}`;

  const baseResult = await generateBaseImage(
    {
      fullPrompt,
      negative,
      width,
      height,
      seed,
      model,
      chainMode,
      localServerUrl,
    },
    { signal, onStage }
  );

  if (upscaleFactor === 2 || upscaleFactor === 4) {
    try {
      const upscaled = await upscaleImageWithChain(
        {
          imageUrl: baseResult.url,
          scaleFactor: upscaleFactor,
          prompt: fullPrompt,
          localServerUrl,
        },
        { signal, onStage }
      );
      return {
        url: upscaled.url,
        width: upscaled.width,
        height: upscaled.height,
        provider: baseResult.provider,
        fullPrompt,
        upscaleFactor,
        upscaler: upscaled.upscaler,
        note: [baseResult.note, `${upscaleFactor}× ${upscaled.upscaler}`]
          .filter(Boolean)
          .join(' · '),
      };
    } catch (err) {
      if ((err as Error).name === 'AbortError' && signal?.aborted) throw err;
      // If upscale aborts unexpectedly, preserve generated base image
    }
  }

  return {
    url: baseResult.url,
    width,
    height,
    provider: baseResult.provider,
    fullPrompt,
    note: baseResult.note,
  };
}

export function loadHistory(): GenerationItem[] {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) || localStorage.getItem('forge_history');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is GenerationItem =>
        Boolean(item && typeof item.url === 'string' && !item.url.startsWith('blob:'))
    );
  } catch {
    return [];
  }
}

export function saveHistorySafely(items: GenerationItem[]): GenerationItem[] {
  let trimmed = items.slice(0, MAX_HISTORY);
  while (trimmed.length > 0) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      return trimmed;
    } catch {
      trimmed = trimmed.slice(0, trimmed.length - 1);
    }
  }
  try {
    localStorage.setItem(STORAGE_KEY, '[]');
  } catch {
    // Ignore storage lock
  }
  return [];
}

export function loadLocalServerUrl(): string {
  try {
    const stored = localStorage.getItem(LOCAL_SERVER_STORAGE_KEY);
    return stored !== null ? stored : DEFAULT_LOCAL_SERVER_URL;
  } catch {
    return DEFAULT_LOCAL_SERVER_URL;
  }
}

export function saveLocalServerUrl(url: string): void {
  try {
    localStorage.setItem(LOCAL_SERVER_STORAGE_KEY, url);
  } catch {
    // Ignore storage error
  }
}

export async function triggerDownload(url: string, filename: string): Promise<void> {
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Download fetch failed');
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
  } catch {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

