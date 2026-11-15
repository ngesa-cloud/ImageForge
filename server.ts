import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 24000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'User-Agent': 'ImageForge/1.0',
        ...(init.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function resolveImageAsBase64(imageUrl: string): Promise<{
  base64: string;
  dataUrl: string;
}> {
  if (imageUrl.startsWith('data:')) {
    const commaIdx = imageUrl.indexOf(',');
    if (commaIdx === -1) throw new Error('Invalid data URL');
    return {
      base64: imageUrl.slice(commaIdx + 1),
      dataUrl: imageUrl,
    };
  }

  const res = await fetchWithTimeout(imageUrl, {}, 20000);
  if (!res.ok) {
    throw new Error(`Unable to fetch source image (HTTP ${res.status})`);
  }
  const ct = (res.headers.get('content-type') || 'image/png').split(';')[0];
  const buf = Buffer.from(await res.arrayBuffer());
  const base64 = buf.toString('base64');
  return {
    base64,
    dataUrl: `data:${ct};base64,${base64}`,
  };
}

async function tryAirforceUpstream(params: {
  fullPrompt: string;
  width: number;
  height: number;
  seed: number;
  model: string;
}): Promise<{ url: string; provider: 'Airforce' }> {
  const afModel = params.model === 'turbo' ? 'flux' : params.model;
  const endpoint = `https://api.airforce/imagine2?prompt=${encodeURIComponent(
    params.fullPrompt
  )}&model=${encodeURIComponent(afModel)}&width=${params.width}&height=${
    params.height
  }&seed=${params.seed}`;

  const res = await fetchWithTimeout(endpoint, {}, 24000);
  if (!res.ok) {
    throw new Error(`Airforce HTTP ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.startsWith('image/')) {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 256) throw new Error('Airforce returned empty image');
    return {
      url: `data:${contentType.split(';')[0]};base64,${buf.toString('base64')}`,
      provider: 'Airforce',
    };
  }

  const data = (await res.json()) as { url?: string; b64_json?: string };
  if (data && typeof data.url === 'string' && data.url.startsWith('http')) {
    try {
      const resolved = await resolveImageAsBase64(data.url);
      return { url: resolved.dataUrl, provider: 'Airforce' };
    } catch {
      return { url: data.url, provider: 'Airforce' };
    }
  }
  if (data && typeof data.b64_json === 'string') {
    return {
      url: `data:image/png;base64,${data.b64_json}`,
      provider: 'Airforce',
    };
  }

  throw new Error('Airforce returned unexpected payload');
}

async function tryPollinationsUpstream(params: {
  fullPrompt: string;
  negative: string;
  width: number;
  height: number;
  seed: number;
  model: string;
}): Promise<{ url: string; provider: 'Pollinations' }> {
  const combined = params.negative
    ? `${params.fullPrompt} | avoid: ${params.negative}`
    : params.fullPrompt;

  const u = new URL(
    `https://image.pollinations.ai/prompt/${encodeURIComponent(combined)}`
  );
  u.searchParams.set('width', String(params.width));
  u.searchParams.set('height', String(params.height));
  u.searchParams.set('seed', String(params.seed));
  u.searchParams.set(
    'model',
    params.model === 'flux-realism' ? 'flux' : params.model
  );
  u.searchParams.set('nologo', 'true');

  const res = await fetchWithTimeout(u.toString(), {}, 26000);
  if (res.status === 402) {
    throw new Error('Pollinations returned 402');
  }
  if (!res.ok) {
    throw new Error(`Pollinations HTTP ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    throw new Error('Pollinations returned non-image response');
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 256) throw new Error('Pollinations returned empty image');

  return {
    url: `data:${contentType.split(';')[0]};base64,${buf.toString('base64')}`,
    provider: 'Pollinations',
  };
}

async function tryMagnificUpscale(params: {
  imageBase64: string;
  scaleFactor: 2 | 4;
  prompt?: string;
}): Promise<{ url: string; upscaler: 'Magnific' }> {
  const apiKey = (
    process.env.MAGNIFIC_API_KEY ||
    process.env.FREEPIK_API_KEY ||
    ''
  ).trim();
  if (!apiKey) {
    throw new Error('MAGNIFIC_API_KEY not configured');
  }

  const createRes = await fetchWithTimeout(
    'https://api.freepik.com/v1/ai/image-upscaler',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-freepik-api-key': apiKey,
      },
      body: JSON.stringify({
        image: params.imageBase64,
        scale_factor: `${params.scaleFactor}x`,
        optimized_for: 'standard',
        prompt: params.prompt || undefined,
        creativity: 0,
        hdr: 0,
        resemblance: 1,
      }),
    },
    25000
  );

  if (!createRes.ok) {
    throw new Error(`Magnific HTTP ${createRes.status}`);
  }

  const createJson = (await createRes.json()) as {
    data?: {
      task_id?: string;
      status?: string;
      generated?: string[];
    };
  };

  const directUrl = createJson?.data?.generated?.[0];
  if (directUrl) {
    const resolved = await resolveImageAsBase64(directUrl);
    return { url: resolved.dataUrl, upscaler: 'Magnific' };
  }

  const taskId = createJson?.data?.task_id;
  if (!taskId) {
    throw new Error('Magnific did not return a task ID');
  }

  for (let attempt = 0; attempt < 24; attempt++) {
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetchWithTimeout(
      `https://api.freepik.com/v1/ai/image-upscaler/${encodeURIComponent(taskId)}`,
      {
        headers: {
          'x-freepik-api-key': apiKey,
        },
      },
      15000
    );
    if (!pollRes.ok) {
      throw new Error(`Magnific poll HTTP ${pollRes.status}`);
    }
    const pollJson = (await pollRes.json()) as {
      data?: {
        status?: string;
        generated?: string[];
      };
    };
    const status = String(pollJson?.data?.status || '').toUpperCase();
    if (status === 'COMPLETED' && pollJson?.data?.generated?.[0]) {
      const resolved = await resolveImageAsBase64(pollJson.data.generated[0]);
      return { url: resolved.dataUrl, upscaler: 'Magnific' };
    }
    if (status === 'FAILED' || status === 'ERROR') {
      throw new Error('Magnific upscale task failed');
    }
  }

  throw new Error('Magnific upscale timed out');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '16mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      magnificConfigured: Boolean(
        (process.env.MAGNIFIC_API_KEY || process.env.FREEPIK_API_KEY || '').trim()
      ),
    });
  });

  // Pass-through auto-chain proxy: does not inspect or filter prompt text
  app.post('/api/forge', async (req, res) => {
    const body = req.body ?? {};
    const fullPrompt = String(body.fullPrompt || body.prompt || '').trim();
    const negative = String(body.negative || '').trim();
    const width = Math.min(1280, Math.max(256, Number(body.width) || 768));
    const height = Math.min(1280, Math.max(256, Number(body.height) || 768));
    const seed = Number.isFinite(Number(body.seed))
      ? Number(body.seed)
      : Math.floor(Math.random() * 1e9);
    const model = String(body.model || 'flux');
    const chainMode = String(body.chainMode || 'auto');

    if (!fullPrompt) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }

    const errors: string[] = [];

    if (chainMode === 'auto' || chainMode === 'airforce') {
      try {
        const result = await tryAirforceUpstream({
          fullPrompt,
          width,
          height,
          seed,
          model,
        });
        res.json({ ...result, fallback: false });
        return;
      } catch (err) {
        errors.push((err as Error).message || 'Airforce unavailable');
        if (chainMode === 'airforce') {
          res.json({ fallback: true, isolatedError: errors[0], errors });
          return;
        }
      }
    }

    if (chainMode === 'auto' || chainMode === 'pollinations') {
      try {
        const result = await tryPollinationsUpstream({
          fullPrompt,
          negative,
          width,
          height,
          seed,
          model,
        });
        res.json({
          ...result,
          fallback: false,
          note: errors.length ? `Fallback after ${errors[0]}` : undefined,
        });
        return;
      } catch (err) {
        errors.push((err as Error).message || 'Pollinations unavailable');
        if (chainMode === 'pollinations') {
          res.json({ fallback: true, isolatedError: errors[0], errors });
          return;
        }
      }
    }

    // Never return a 402 on the auto route; allow client to try local Python server or Local Synth
    res.json({ fallback: true, errors });
  });

  // Magnific upscaling endpoint with graceful fallback + CORS-safe DataURL resolution
  app.post('/api/upscale', async (req, res) => {
    const body = req.body ?? {};
    const imageUrl = String(body.imageUrl || '').trim();
    const scaleFactor: 2 | 4 = Number(body.scaleFactor) === 4 ? 4 : 2;
    const prompt = body.prompt ? String(body.prompt) : undefined;

    if (!imageUrl) {
      res.status(400).json({ error: 'imageUrl is required' });
      return;
    }

    let resolvedSource: { base64: string; dataUrl: string } | null = null;
    try {
      resolvedSource = await resolveImageAsBase64(imageUrl);
    } catch (err) {
      res.json({
        fallback: true,
        reason: (err as Error).message || 'Source resolution failed',
      });
      return;
    }

    try {
      const result = await tryMagnificUpscale({
        imageBase64: resolvedSource.base64,
        scaleFactor,
        prompt,
      });
      res.json({
        ...result,
        scaleFactor,
        fallback: false,
      });
    } catch (err) {
      res.json({
        fallback: true,
        sourceDataUrl: resolvedSource.dataUrl,
        reason: (err as Error).message || 'Magnific unavailable',
      });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ImageForge server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
