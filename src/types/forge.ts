export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

export type ModelId = 'flux' | 'turbo' | 'flux-realism';

export type ChainMode = 'auto' | 'airforce' | 'pollinations' | 'local';

export type ProviderName = 'Airforce' | 'Pollinations' | 'Local Synth';

export type UpscaleFactor = 1 | 2 | 4;

export type UpscalerName = 'Magnific' | 'Local Upscaler' | 'Super-Res';

export interface StylePreset {
  id: string;
  name: string;
  suffix: string;
}

export interface GenerationItem {
  id: string;
  url: string;
  prompt: string;
  fullPrompt: string;
  negative: string;
  seed: number;
  width: number;
  height: number;
  aspect: AspectRatio;
  model: ModelId;
  provider: ProviderName;
  createdAt: number;
  upscaleFactor?: UpscaleFactor;
  upscaler?: UpscalerName;
  note?: string;
}

export interface PendingSlot {
  id: string;
  prompt: string;
  seed: number;
  width: number;
  height: number;
  aspect: AspectRatio;
  model: ModelId;
  stage: string;
  error?: string;
}

export type ReelAspect = '9:16' | '16:9' | '1:1';

export type MotionPreset =
  | 'zoom_in'
  | 'zoom_out'
  | 'pan_right'
  | 'pan_left'
  | 'dynamic_mix';

export type AnimeFx = 'none' | 'sakura' | 'embers' | 'rain' | 'speed_lines' | 'glitch';

export type ReelAudio = 'none' | 'synth' | 'rain';

export interface ReelRecord {
  id: string;
  prompt: string;
  fullPrompt: string;
  styleName: string;
  motion: MotionPreset;
  fx: AnimeFx;
  audio?: ReelAudio;
  aspect: ReelAspect;
  duration: number;
  frames: string[];
  providers: ProviderName[];
  width: number;
  height: number;
  createdAt: number;
  videoBlob?: Blob;
  mimeType?: string;
}
