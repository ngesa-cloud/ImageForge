import {
  AnimeFx,
  MotionPreset,
  ReelAspect,
  ReelAudio,
  ReelRecord,
  StylePreset,
} from '../types/forge';

export const REEL_HISTORY_KEY = 'anime_reel_history_v1';

export const ANIME_STYLE_PRESETS: StylePreset[] = [
  {
    id: 'anime',
    name: 'Anime',
    suffix: ', anime key visual, studio quality, vibrant colors, crisp cel shading',
  },
  {
    id: 'dark-anime',
    name: 'Dark Anime',
    suffix: ', dark anime, cinematic lighting, dramatic high contrast shadows, mappa style',
  },
  {
    id: '90s-retro',
    name: '90s Retro',
    suffix: ', 90s retro anime aesthetic, hand painted cel, soft VHS halation, vintage palette',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    suffix: ', cyberpunk anime, neon rain reflections, futuristic skyline, glowing highlights',
  },
  {
    id: 'shonen',
    name: 'Shonen Action',
    suffix: ', dynamic anime battle frame, dramatic perspective, energy aura, crisp linework',
  },
  {
    id: 'makoto-sky',
    name: 'Scenic Sky',
    suffix: ', Makoto Shinkai inspired anime background, towering twilight clouds, golden hour light',
  },
];

export const REEL_DIMENSIONS: Record<
  ReelAspect,
  { width: number; height: number; genWidth: number; genHeight: number; label: string }
> = {
  '9:16': {
    width: 540,
    height: 960,
    genWidth: 576,
    genHeight: 1024,
    label: '9:16 Vertical Reel',
  },
  '16:9': {
    width: 960,
    height: 540,
    genWidth: 1024,
    genHeight: 576,
    label: '16:9 Widescreen',
  },
  '1:1': {
    width: 720,
    height: 720,
    genWidth: 768,
    genHeight: 768,
    label: '1:1 Square',
  },
};

export const REEL_STARTER_PROMPTS = [
  'A lone samurai standing on a crimson torii gate beneath a fractured moon, drifting mist',
  'Magical girl wielding a glowing crystal blade above a neon-lit midnight city',
  'Mecha pilot cockpit view overlooking an orbital ring at golden hour',
  'Quiet rainy Tokyo train platform at dusk, warm lantern reflections on puddles',
];

export function pickSupportedMimeType(withAudio = false): {
  mimeType: string;
  extension: 'webm' | 'mp4';
} {
  if (typeof MediaRecorder === 'undefined') {
    return { mimeType: '', extension: 'webm' };
  }
  const candidates: Array<{ mime: string; ext: 'webm' | 'mp4' }> = withAudio
    ? [
        { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
        { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
        { mime: 'video/webm', ext: 'webm' },
        { mime: 'video/mp4', ext: 'mp4' },
      ]
    : [
        { mime: 'video/webm;codecs=vp9', ext: 'webm' },
        { mime: 'video/webm;codecs=vp8', ext: 'webm' },
        { mime: 'video/webm', ext: 'webm' },
        { mime: 'video/mp4', ext: 'mp4' },
      ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c.mime)) {
      return { mimeType: c.mime, extension: c.ext };
    }
  }
  return { mimeType: '', extension: 'webm' };
}

function loadCanvasImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode frame for video canvas'));
    img.src = src;
  });
}

function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function drawCoverTransform(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | undefined,
  canvasW: number,
  canvasH: number,
  scale: number,
  panX: number,
  panY: number,
  alpha = 1
) {
  if (!img) return;
  const srcW = img.naturalWidth || img.width || canvasW;
  const srcH = img.naturalHeight || img.height || canvasH;
  const baseScale = Math.max(canvasW / srcW, canvasH / srcH);
  const drawW = srcW * baseScale * scale;
  const drawH = srcH * baseScale * scale;
  const maxOffsetX = Math.max(0, (drawW - canvasW) / 2);
  const maxOffsetY = Math.max(0, (drawH - canvasH) / 2);
  const x = (canvasW - drawW) / 2 + panX * maxOffsetX;
  const y = (canvasH - drawH) / 2 + panY * maxOffsetY;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, x, y, drawW, drawH);
  ctx.restore();
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  rot: number;
  vRot: number;
}

function createParticles(fx: AnimeFx, width: number, height: number): Particle[] {
  if (fx === 'none') return [];
  const count = fx === 'rain' ? 70 : fx === 'speed_lines' ? 28 : 36;
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx:
      fx === 'sakura'
        ? 0.6 + Math.random() * 1.1
        : fx === 'embers'
          ? (Math.random() - 0.5) * 0.8
          : fx === 'rain'
            ? -2.2
            : 0,
    vy:
      fx === 'sakura'
        ? 1.1 + Math.random() * 1.4
        : fx === 'embers'
          ? -(0.9 + Math.random() * 1.8)
          : fx === 'rain'
            ? 14 + Math.random() * 8
            : 0,
    size:
      fx === 'sakura'
        ? 4 + Math.random() * 5
        : fx === 'embers'
          ? 2 + Math.random() * 3.5
          : fx === 'rain'
            ? 14 + Math.random() * 16
            : Math.random() * Math.PI * 2,
    alpha: 0.35 + Math.random() * 0.55,
    rot: Math.random() * Math.PI * 2,
    vRot: (Math.random() - 0.5) * 0.08,
  }));
}

function renderFxOverlay(
  ctx: CanvasRenderingContext2D,
  fx: AnimeFx,
  particles: Particle[],
  width: number,
  height: number
) {
  if (fx === 'none') return;

  if (fx === 'glitch') {
    if (Math.random() > 0.84) {
      try {
        const slices = 2 + Math.floor(Math.random() * 3);
        for (let s = 0; s < slices; s++) {
          const sy = Math.floor(Math.random() * Math.max(1, height - 48));
          const sh = Math.floor(12 + Math.random() * 34);
          const shift = Math.round((Math.random() - 0.5) * 38);
          const imgData = ctx.getImageData(0, sy, width, sh);
          ctx.putImageData(imgData, shift, sy);
        }
        ctx.save();
        ctx.fillStyle =
          Math.random() > 0.5
            ? 'rgba(236, 72, 153, 0.08)'
            : 'rgba(56, 189, 248, 0.08)';
        ctx.fillRect(0, Math.random() * height, width, 6 + Math.random() * 14);
        ctx.restore();
      } catch {
        // Fallback scanline bars if pixel read is restricted
        ctx.save();
        ctx.fillStyle = 'rgba(236, 72, 153, 0.14)';
        ctx.fillRect(0, Math.random() * height, width, 12);
        ctx.restore();
      }
    }
    return;
  }

  if (fx === 'speed_lines') {
    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.hypot(width, height) * 0.65;
    ctx.save();
    for (const p of particles) {
      p.size += 0.03;
      const angle = p.size;
      const innerR = maxR * (0.42 + Math.sin(angle * 7) * 0.08);
      ctx.strokeStyle = `rgba(255, 255, 255, ${p.alpha * 0.25})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
      ctx.lineTo(cx + Math.cos(angle) * maxR, cy + Math.sin(angle) * maxR);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  ctx.save();
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vRot;

    if (p.x > width + 20) p.x = -10;
    if (p.x < -20) p.x = width + 10;
    if (p.y > height + 20) p.y = -10;
    if (p.y < -20) p.y = height + 10;

    if (fx === 'sakura') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = `rgba(249, 168, 212, ${p.alpha})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (fx === 'embers') {
      ctx.fillStyle = `rgba(251, 146, 60, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (fx === 'rain') {
      ctx.strokeStyle = `rgba(186, 230, 253, ${p.alpha * 0.55})`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.vx * 1.4, p.y + p.size);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function getMotionPose(
  motion: MotionPreset,
  segmentIdx: number,
  t: number
): { scale: number; panX: number; panY: number } {
  const eased = easeInOutSine(t);
  let effective = motion;
  if (motion === 'dynamic_mix') {
    const cycle: MotionPreset[] = ['zoom_in', 'pan_right', 'zoom_out', 'pan_left'];
    effective = cycle[segmentIdx % cycle.length];
  }

  switch (effective) {
    case 'zoom_in':
      return { scale: 1.02 + eased * 0.28, panX: 0, panY: -0.1 * eased };
    case 'zoom_out':
      return { scale: 1.3 - eased * 0.28, panX: 0, panY: 0.08 * (1 - eased) };
    case 'pan_right':
      return { scale: 1.24, panX: 0.85 - eased * 1.7, panY: 0 };
    case 'pan_left':
      return { scale: 1.24, panX: -0.85 + eased * 1.7, panY: 0 };
    default:
      return { scale: 1.02 + eased * 0.24, panX: 0, panY: 0 };
  }
}

function createReelAudioTrack(
  audio: ReelAudio,
  durationSeconds: number
): {
  stream: MediaStream | null;
  dispose: () => void;
} {
  if (audio === 'none' || typeof AudioContext === 'undefined') {
    return { stream: null, dispose: () => {} };
  }

  try {
    const ctx = new AudioContext();
    void ctx.resume().catch(() => {});
    const dest = ctx.createMediaStreamDestination();
    const masterGain = ctx.createGain();
    const now = ctx.currentTime;
    const total = Math.max(2, durationSeconds) + 0.4;

    masterGain.gain.setValueAtTime(0.001, now);
    masterGain.gain.linearRampToValueAtTime(0.32, now + 0.35);
    masterGain.gain.setValueAtTime(0.32, Math.max(now + 0.4, now + total - 0.6));
    masterGain.gain.linearRampToValueAtTime(0.001, now + total);
    masterGain.connect(dest);

    if (audio === 'synth') {
      const notes = [55, 55, 65.41, 49, 73.42, 65.41, 55, 49];
      const stepSec = 0.5;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(640, now);
      filter.Q.setValueAtTime(3.2, now);
      filter.connect(masterGain);

      const bass = ctx.createOscillator();
      bass.type = 'sawtooth';
      const pad = ctx.createOscillator();
      pad.type = 'triangle';
      const padGain = ctx.createGain();
      padGain.gain.setValueAtTime(0.35, now);
      pad.connect(padGain);
      padGain.connect(filter);
      bass.connect(filter);

      const steps = Math.ceil(total / stepSec);
      for (let i = 0; i < steps; i++) {
        const freq = notes[i % notes.length];
        const t = now + i * stepSec;
        bass.frequency.setValueAtTime(freq, t);
        pad.frequency.setValueAtTime(freq * 2, t);
        filter.frequency.setValueAtTime(920, t);
        filter.frequency.exponentialRampToValueAtTime(340, t + stepSec * 0.85);
      }

      bass.start(now);
      pad.start(now);
      bass.stop(now + total);
      pad.stop(now + total);
    } else if (audio === 'rain') {
      const sampleCount = Math.floor(ctx.sampleRate * total);
      const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < sampleCount; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.04 * white) / 1.04;
        data[i] = lastOut * 2.6 + white * 0.14;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1400, now);
      noise.connect(lp);
      lp.connect(masterGain);
      noise.start(now);
      noise.stop(now + total);
    }

    return {
      stream: dest.stream,
      dispose: () => {
        try {
          void ctx.close().catch(() => {});
        } catch {
          // Ignore close error
        }
      },
    };
  } catch {
    return { stream: null, dispose: () => {} };
  }
}

export async function compileFramesToVideo(params: {
  canvas: HTMLCanvasElement;
  frameUrls: string[];
  durationSeconds: number;
  motion: MotionPreset;
  fx: AnimeFx;
  audio?: ReelAudio;
  signal?: AbortSignal;
  onProgress?: (pct: number) => void;
}): Promise<{
  blob: Blob;
  url: string;
  mimeType: string;
  extension: 'webm' | 'mp4';
}> {
  const {
    canvas,
    frameUrls,
    durationSeconds,
    motion,
    fx,
    audio = 'none',
    signal,
    onProgress,
  } = params;
  if (frameUrls.length === 0) {
    throw new Error('At least one generated frame is required');
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  const images = await Promise.all(frameUrls.map(loadCanvasImage));

  if (typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
    throw new Error('Browser does not support Canvas MediaRecorder video export');
  }

  const canvasStream = canvas.captureStream(30);
  const audioBundle = createReelAudioTrack(audio, durationSeconds);
  const hasAudio = Boolean(
    audioBundle.stream && audioBundle.stream.getAudioTracks().length > 0
  );
  const stream = hasAudio
    ? new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioBundle.stream!.getAudioTracks(),
      ])
    : canvasStream;

  const { mimeType, extension } = pickSupportedMimeType(hasAudio);
  const recorder = mimeType
    ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_500_000 })
    : new MediaRecorder(stream);

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const particles = createParticles(fx, canvas.width, canvas.height);
  const durationMs = Math.max(2000, durationSeconds * 1000);

  return new Promise((resolve, reject) => {
    let rafId = 0;
    let finished = false;

    const cleanup = () => {
      if (rafId) cancelAnimationFrame(rafId);
      stream.getTracks().forEach((t) => t.stop());
      audioBundle.dispose();
    };

    const onAbort = () => {
      if (finished) return;
      finished = true;
      cleanup();
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch {
        // Ignore stop errors on abort
      }
      reject(new DOMException('Aborted', 'AbortError'));
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }

    recorder.onerror = () => {
      if (finished) return;
      finished = true;
      cleanup();
      if (signal) signal.removeEventListener('abort', onAbort);
      reject(new Error('MediaRecorder failed while encoding video'));
    };

    recorder.onstop = () => {
      if (finished) return;
      finished = true;
      cleanup();
      if (signal) signal.removeEventListener('abort', onAbort);
      const finalType = mimeType || 'video/webm';
      const blob = new Blob(chunks, { type: finalType });
      const url = URL.createObjectURL(blob);
      onProgress?.(100);
      resolve({ blob, url, mimeType: finalType, extension });
    };

    recorder.start(120);
    let startTime: number | null = null;

    const drawTick = (now: number) => {
      if (finished) return;
      if (startTime === null) startTime = now;
      const elapsed = Math.max(0, now - startTime);
      const globalProgress = Math.max(0, Math.min(1, elapsed / durationMs));
      onProgress?.(Math.min(99, Math.round(globalProgress * 100)));

      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = '#050608';
      ctx.fillRect(0, 0, w, h);

      const count = images.length;
      if (count === 1) {
        const pose = getMotionPose(motion, 0, globalProgress);
        drawCoverTransform(ctx, images[0], w, h, pose.scale, pose.panX, pose.panY, 1);
      } else if (count > 1) {
        const exactSeg = globalProgress * count;
        const idx = Math.max(0, Math.min(count - 1, Math.floor(exactSeg)));
        const localT = Math.max(0, Math.min(1, exactSeg - idx));
        const pose = getMotionPose(motion, idx, localT);
        drawCoverTransform(ctx, images[idx], w, h, pose.scale, pose.panX, pose.panY, 1);

        // Smooth 20% crossfade into next keyframe
        if (idx < count - 1 && localT > 0.8) {
          const fadeAlpha = (localT - 0.8) / 0.2;
          const nextPose = getMotionPose(motion, idx + 1, 0);
          drawCoverTransform(
            ctx,
            images[idx + 1],
            w,
            h,
            nextPose.scale,
            nextPose.panX,
            nextPose.panY,
            fadeAlpha
          );
        }
      }

      renderFxOverlay(ctx, fx, particles, w, h);

      // Subtle dark cinema edge vignette
      const vig = ctx.createRadialGradient(
        w / 2,
        h / 2,
        Math.min(w, h) * 0.35,
        w / 2,
        h / 2,
        Math.hypot(w, h) * 0.56
      );
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.34)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);

      if (globalProgress >= 1) {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
        return;
      }

      rafId = requestAnimationFrame(drawTick);
    };

    rafId = requestAnimationFrame(drawTick);
  });
}

export function loadReelHistory(): ReelRecord[] {
  try {
    const raw = localStorage.getItem(REEL_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is ReelRecord =>
        Boolean(r && Array.isArray(r.frames) && r.frames.length > 0)
    );
  } catch {
    return [];
  }
}

export function saveReelHistorySafely(records: ReelRecord[]): ReelRecord[] {
  let trimmed = records.slice(0, 20);
  while (trimmed.length > 0) {
    try {
      localStorage.setItem(REEL_HISTORY_KEY, JSON.stringify(trimmed));
      return trimmed;
    } catch {
      trimmed = trimmed.slice(0, trimmed.length - 1);
    }
  }
  try {
    localStorage.setItem(REEL_HISTORY_KEY, '[]');
  } catch {
    // Ignore storage error
  }
  return [];
}
