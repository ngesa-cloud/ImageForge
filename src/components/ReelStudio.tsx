import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Download,
  Film,
  Loader2,
  Play,
  RefreshCw,
  Shuffle,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { fetchImageWithChain, saveLocalServerUrl, triggerDownload } from '../lib/imageChain';
import {
  ANIME_STYLE_PRESETS,
  REEL_DIMENSIONS,
  REEL_STARTER_PROMPTS,
  compileFramesToVideo,
  loadReelHistory,
} from '../lib/reelCompiler';
import {
  clearReelsDb,
  deleteReelFromDb,
  loadReelsFromDb,
  saveReelToDb,
} from '../lib/reelDb';
import {
  AnimeFx,
  ChainMode,
  MotionPreset,
  ProviderName,
  ReelAspect,
  ReelAudio,
  ReelRecord,
  UpscaleFactor,
} from '../types/forge';

interface ReelStudioProps {
  localServerUrl: string;
  onChangeLocalServerUrl: (url: string) => void;
  mobileControlsOpen: boolean;
  onOpenMobileControls: () => void;
  onCloseMobileControls: () => void;
}

interface CompiledSignature {
  motion: MotionPreset;
  fx: AnimeFx;
  audio: ReelAudio;
  duration: number;
  aspect: ReelAspect;
}

export function ReelStudio({
  localServerUrl,
  onChangeLocalServerUrl,
  mobileControlsOpen,
  onOpenMobileControls,
  onCloseMobileControls,
}: ReelStudioProps) {
  const [prompt, setPrompt] = useState('');
  const [styleId, setStyleId] = useState<string>('anime');
  const [frameCount, setFrameCount] = useState<number>(3);
  const [motion, setMotion] = useState<MotionPreset>('dynamic_mix');
  const [duration, setDuration] = useState<number>(6);
  const [aspect, setAspect] = useState<ReelAspect>('9:16');
  const [fx, setFx] = useState<AnimeFx>('sakura');
  const [audio, setAudio] = useState<ReelAudio>('synth');
  const [upscaleFactor, setUpscaleFactor] = useState<UpscaleFactor>(1);
  const [chainMode, setChainMode] = useState<ChainMode>('auto');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [isBusy, setIsBusy] = useState(false);
  const [stageText, setStageText] = useState<string>('Ready');
  const [compilePct, setCompilePct] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [activeFrames, setActiveFrames] = useState<string[]>([]);
  const [activeProviders, setActiveProviders] = useState<ProviderName[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoExt, setVideoExt] = useState<'webm' | 'mp4'>('webm');
  const [compiledSig, setCompiledSig] = useState<CompiledSignature | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isRecordingPreview, setIsRecordingPreview] = useState(false);
  const [inspectedFrameIdx, setInspectedFrameIdx] = useState<number | null>(null);

  const [reelHistory, setReelHistory] = useState<ReelRecord[]>(() =>
    loadReelHistory()
  );
  const [activeReelId, setActiveReelId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const previousVideoUrlRef = useRef<string | null>(null);
  const starterIdxRef = useRef<number>(0);

  useEffect(() => {
    let mounted = true;
    void loadReelsFromDb().then((records) => {
      if (mounted && records.length > 0) {
        setReelHistory(records);
      }
    });
    return () => {
      mounted = false;
      if (previousVideoUrlRef.current) {
        URL.revokeObjectURL(previousVideoUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (inspectedFrameIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInspectedFrameIdx(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inspectedFrameIdx]);

  const selectedStyle = useMemo(
    () =>
      ANIME_STYLE_PRESETS.find((s) => s.id === styleId) ||
      ANIME_STYLE_PRESETS[0],
    [styleId]
  );

  const dims = REEL_DIMENSIONS[aspect];

  const hasPendingEdits = useMemo(() => {
    if (!compiledSig || activeFrames.length === 0 || isBusy) return false;
    return (
      compiledSig.motion !== motion ||
      compiledSig.fx !== fx ||
      compiledSig.audio !== audio ||
      compiledSig.duration !== duration ||
      compiledSig.aspect !== aspect
    );
  }, [compiledSig, activeFrames.length, isBusy, motion, fx, audio, duration, aspect]);

  const updateVideoUrl = (nextUrl: string | null) => {
    if (previousVideoUrlRef.current && previousVideoUrlRef.current !== nextUrl) {
      URL.revokeObjectURL(previousVideoUrlRef.current);
    }
    previousVideoUrlRef.current = nextUrl;
    setVideoUrl(nextUrl);
  };

  const handleSurprisePrompt = () => {
    const next = REEL_STARTER_PROMPTS[starterIdxRef.current % REEL_STARTER_PROMPTS.length];
    starterIdxRef.current += 1;
    setPrompt(next);
    promptRef.current?.focus();
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
      if (!nextMuted) {
        void videoRef.current.play().catch(() => {});
      }
    }
  };

  const runCompile = async (
    framesToCompile: string[],
    target: CompiledSignature,
    signal?: AbortSignal
  ): Promise<{
    blob: Blob;
    url: string;
    extension: 'webm' | 'mp4';
    mimeType: string;
  }> => {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error('Video canvas not mounted');
    const targetDims = REEL_DIMENSIONS[target.aspect];
    canvas.width = targetDims.width;
    canvas.height = targetDims.height;

    setIsRecordingPreview(true);
    setCompilePct(0);
    setStageText('Compiling anime reel...');

    try {
      const compiled = await compileFramesToVideo({
        canvas,
        frameUrls: framesToCompile,
        durationSeconds: target.duration,
        motion: target.motion,
        fx: target.fx,
        audio: target.audio,
        signal,
        onProgress: (pct) => setCompilePct(pct),
      });
      updateVideoUrl(compiled.url);
      setVideoExt(compiled.extension);
      setCompiledSig(target);
      setIsMuted(true);
      return {
        blob: compiled.blob,
        url: compiled.url,
        extension: compiled.extension,
        mimeType: compiled.mimeType,
      };
    } finally {
      setIsRecordingPreview(false);
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const handleGenerateReel = async (overridePrompt?: string) => {
    if (isBusy) return;
    const rawPrompt = overridePrompt !== undefined ? overridePrompt : prompt;
    const trimmed = rawPrompt.trim();
    if (!trimmed) {
      onOpenMobileControls();
      promptRef.current?.focus();
      return;
    }

    onCloseMobileControls();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsBusy(true);
    setErrorMsg(null);
    updateVideoUrl(null);
    setCompiledSig(null);

    const frames: string[] = [];
    const providers: ProviderName[] = [];
    const baseSeed = Math.floor(Math.random() * 1e9);

    const sceneBeats = [
      '',
      ', wide establishing angle, atmospheric depth',
      ', dramatic close-up shot, glowing highlights',
      ', dynamic low-angle action composition',
      ', silhouettes against vibrant horizon sky',
      ', serene aftermath lighting, drifting particles',
    ];

    try {
      for (let i = 0; i < frameCount; i++) {
        if (controller.signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        const beatSuffix = frameCount > 1 ? sceneBeats[i % sceneBeats.length] : '';
        setStageText(`Generating keyframe ${i + 1} of ${frameCount}...`);

        const res = await fetchImageWithChain(
          {
            prompt: `${trimmed}${beatSuffix}`,
            activeStyles: [selectedStyle.suffix],
            negative: 'blurry, distorted anatomy, text, watermark, lowres',
            width: dims.genWidth,
            height: dims.genHeight,
            seed: baseSeed + i * 7919,
            model: 'flux',
            chainMode,
            localServerUrl,
            upscaleFactor,
          },
          {
            signal: controller.signal,
            onStage: (sub) =>
              setStageText(`Frame ${i + 1}/${frameCount}: ${sub}`),
          }
        );

        frames.push(res.url);
        providers.push(res.provider);
        setActiveFrames([...frames]);
        setActiveProviders([...providers]);
      }

      const targetSig: CompiledSignature = { motion, fx, audio, duration, aspect };
      const compiled = await runCompile(frames, targetSig, controller.signal);

      const newRecord: ReelRecord = {
        id: `reel-${Date.now()}`,
        prompt: trimmed,
        fullPrompt: `${trimmed}${selectedStyle.suffix}`,
        styleName: selectedStyle.name,
        motion,
        fx,
        audio,
        aspect,
        duration,
        frames,
        providers,
        width: dims.width,
        height: dims.height,
        createdAt: Date.now(),
        videoBlob: compiled.blob,
        mimeType: compiled.mimeType,
      };
      setActiveReelId(newRecord.id);
      setReelHistory((prev) => [newRecord, ...prev]);
      void saveReelToDb(newRecord);
      setStageText('Reel ready');
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setStageText('Cancelled');
      } else {
        const msg = (err as Error).message || 'Reel compilation failed';
        setErrorMsg(msg);
        setStageText('Failed');
      }
    } finally {
      abortRef.current = null;
      setIsBusy(false);
    }
  };

  const handleRecompile = async () => {
    if (isBusy || activeFrames.length === 0) return;
    onCloseMobileControls();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsBusy(true);
    setErrorMsg(null);
    updateVideoUrl(null);
    try {
      const compiled = await runCompile(
        activeFrames,
        { motion, fx, audio, duration, aspect },
        controller.signal
      );
      if (activeReelId) {
        const targetDims = REEL_DIMENSIONS[aspect];
        setReelHistory((prev) =>
          prev.map((r) => {
            if (r.id !== activeReelId) return r;
            const updated: ReelRecord = {
              ...r,
              motion,
              fx,
              audio,
              duration,
              aspect,
              width: targetDims.width,
              height: targetDims.height,
              videoBlob: compiled.blob,
              mimeType: compiled.mimeType,
            };
            void saveReelToDb(updated);
            return updated;
          })
        );
      }
      setStageText('Reel updated');
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setErrorMsg((err as Error).message || 'Re-compile failed');
        setStageText('Failed');
      }
    } finally {
      abortRef.current = null;
      setIsBusy(false);
    }
  };

  const handleLoadSavedReel = async (record: ReelRecord) => {
    if (isBusy) return;
    onCloseMobileControls();
    const nextAudio = record.audio || 'none';
    setActiveReelId(record.id);
    setPrompt(record.prompt);
    setAspect(record.aspect);
    setMotion(record.motion);
    setFx(record.fx);
    setAudio(nextAudio);
    setDuration(record.duration);
    setActiveFrames(record.frames);
    setActiveProviders(record.providers);
    setErrorMsg(null);

    if (record.videoBlob instanceof Blob && record.videoBlob.size > 0) {
      const cachedUrl = URL.createObjectURL(record.videoBlob);
      updateVideoUrl(cachedUrl);
      setVideoExt(record.mimeType?.includes('mp4') ? 'mp4' : 'webm');
      setCompiledSig({
        motion: record.motion,
        fx: record.fx,
        audio: nextAudio,
        duration: record.duration,
        aspect: record.aspect,
      });
      setIsMuted(true);
      setStageText('Reel ready (cached)');
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsBusy(true);
    updateVideoUrl(null);
    try {
      const compiled = await runCompile(
        record.frames,
        {
          motion: record.motion,
          fx: record.fx,
          audio: nextAudio,
          duration: record.duration,
          aspect: record.aspect,
        },
        controller.signal
      );
      const updatedRecord: ReelRecord = {
        ...record,
        videoBlob: compiled.blob,
        mimeType: compiled.mimeType,
      };
      setReelHistory((prev) =>
        prev.map((r) => (r.id === record.id ? updatedRecord : r))
      );
      void saveReelToDb(updatedRecord);
      setStageText('Reel ready');
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setErrorMsg((err as Error).message || 'Failed to rebuild reel');
        setStageText('Failed');
      }
    } finally {
      abortRef.current = null;
      setIsBusy(false);
    }
  };

  const handleDeleteSavedReel = (id: string) => {
    if (activeReelId === id) setActiveReelId(null);
    setReelHistory((prev) => prev.filter((r) => r.id !== id));
    void deleteReelFromDb(id);
  };

  const handleClearReels = () => {
    setActiveReelId(null);
    setReelHistory([]);
    void clearReelsDb();
  };

  const inspectedFrameUrl =
    inspectedFrameIdx !== null ? activeFrames[inspectedFrameIdx] : null;

  return (
    <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
      {/* Left Control Sidebar */}
      <aside
        className={`${
          mobileControlsOpen ? 'flex flex-1 lg:flex-none' : 'hidden'
        } lg:flex w-full lg:w-[368px] lg:min-w-[368px] lg:border-r border-[#222938] bg-[#11151E] flex-col overflow-hidden`}
      >
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Prompt */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="reel-prompt" className="text-xs font-medium text-[#94A3B8]">
                Scene prompt
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSurprisePrompt}
                  className="text-xs text-[#94A3B8] hover:text-pink-300 flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Shuffle className="w-3 h-3" />
                  Sample
                </button>
                {prompt && (
                  <button
                    type="button"
                    onClick={() => setPrompt('')}
                    className="text-xs text-[#94A3B8] hover:text-[#E8EDF5] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <textarea
              ref={promptRef}
              id="reel-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  void handleGenerateReel();
                }
              }}
              placeholder="A lone samurai on a neon rooftop, drifting sakura petals..."
              className="w-full min-h-[88px] bg-[#0A0D12] border border-[#222938] focus:border-pink-500 rounded-lg px-3 py-2.5 text-sm text-[#E8EDF5] placeholder:text-[#5B677D] outline-none resize-y transition-colors"
            />
          </div>

          {/* Anime Style */}
          <div>
            <span className="block text-xs font-medium text-[#94A3B8] mb-1.5">
              Anime style
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {ANIME_STYLE_PRESETS.map((s) => {
                const active = s.id === styleId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStyleId(s.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium text-left border transition-colors whitespace-nowrap truncate cursor-pointer ${
                      active
                        ? 'bg-pink-600 border-pink-600 text-white'
                        : 'bg-[#0A0D12] border-[#222938] text-[#94A3B8] hover:bg-[#181D29] hover:text-[#E8EDF5]'
                    }`}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 1-Click Format */}
          <div>
            <span className="block text-xs font-medium text-[#94A3B8] mb-1.5">
              Reel format
            </span>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#0A0D12] border border-[#222938] rounded-lg">
              {(
                [
                  { id: '9:16', label: '9:16 Reel' },
                  { id: '16:9', label: '16:9 Wide' },
                  { id: '1:1', label: '1:1 Square' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setAspect(item.id)}
                  className={`py-1.5 px-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    aspect === item.id
                      ? 'bg-[#181D29] text-[#E8EDF5]'
                      : 'text-[#94A3B8] hover:text-[#E8EDF5]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 1-Click Keyframes & Duration */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <span className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                Scene cuts
              </span>
              <div className="grid grid-cols-3 gap-1 p-1 bg-[#0A0D12] border border-[#222938] rounded-lg">
                {[1, 3, 6].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setFrameCount(cnt)}
                    className={`py-1.5 rounded-md text-xs font-medium font-mono tabular-nums transition-colors cursor-pointer ${
                      frameCount === cnt
                        ? 'bg-[#181D29] text-[#E8EDF5]'
                        : 'text-[#94A3B8] hover:text-[#E8EDF5]'
                    }`}
                  >
                    {cnt}f
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                Duration
              </span>
              <div className="grid grid-cols-4 gap-1 p-1 bg-[#0A0D12] border border-[#222938] rounded-lg">
                {[4, 6, 8, 10].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setDuration(sec)}
                    className={`py-1.5 rounded-md text-xs font-medium font-mono tabular-nums transition-colors cursor-pointer ${
                      duration === sec
                        ? 'bg-[#181D29] text-[#E8EDF5]'
                        : 'text-[#94A3B8] hover:text-[#E8EDF5]'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Motion & FX */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="reel-motion"
                className="block text-xs font-medium text-[#94A3B8] mb-1.5"
              >
                Camera motion
              </label>
              <select
                id="reel-motion"
                value={motion}
                onChange={(e) => setMotion(e.target.value as MotionPreset)}
                className="w-full bg-[#0A0D12] border border-[#222938] focus:border-pink-500 rounded-lg px-2.5 py-2 text-xs text-[#E8EDF5] outline-none cursor-pointer"
              >
                <option value="dynamic_mix">Dynamic Mix</option>
                <option value="zoom_in">Zoom In</option>
                <option value="zoom_out">Zoom Out</option>
                <option value="pan_right">Pan Right</option>
                <option value="pan_left">Pan Left</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="reel-fx"
                className="block text-xs font-medium text-[#94A3B8] mb-1.5"
              >
                Atmosphere FX
              </label>
              <select
                id="reel-fx"
                value={fx}
                onChange={(e) => setFx(e.target.value as AnimeFx)}
                className="w-full bg-[#0A0D12] border border-[#222938] focus:border-pink-500 rounded-lg px-2.5 py-2 text-xs text-[#E8EDF5] outline-none cursor-pointer"
              >
                <option value="sakura">Sakura Petals</option>
                <option value="embers">Glowing Embers</option>
                <option value="rain">Neon Rain</option>
                <option value="glitch">Cyberpunk Glitch</option>
                <option value="speed_lines">Action Speed Lines</option>
                <option value="none">Clean (No FX)</option>
              </select>
            </div>
          </div>

          {/* 1-Click Audio Track */}
          <div>
            <span className="block text-xs font-medium text-[#94A3B8] mb-1.5">
              Audio track
            </span>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#0A0D12] border border-[#222938] rounded-lg">
              {(
                [
                  { id: 'synth', label: 'Synthwave' },
                  { id: 'rain', label: 'Ambient Rain' },
                  { id: 'none', label: 'Silent' },
                ] as const
              ).map((track) => (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => setAudio(track.id)}
                  className={`py-1.5 px-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    audio === track.id
                      ? 'bg-[#181D29] text-[#E8EDF5]'
                      : 'text-[#94A3B8] hover:text-[#E8EDF5]'
                  }`}
                >
                  {track.label}
                </button>
              ))}
            </div>
          </div>

          {/* Collapsible Advanced Settings */}
          <div className="border-t border-[#222938] pt-3">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              aria-expanded={showAdvanced}
              className="w-full flex items-center justify-between text-xs text-[#94A3B8] hover:text-[#E8EDF5] py-1 transition-colors cursor-pointer"
            >
              <span className="font-medium">Advanced routing</span>
              <span className="flex items-center gap-1.5 font-mono tabular-nums text-[11px]">
                {chainMode === 'auto' ? 'Auto' : chainMode} · {upscaleFactor}×
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${
                    showAdvanced ? 'rotate-180' : ''
                  }`}
                />
              </span>
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3">
                <div>
                  <label
                    htmlFor="reel-upscale"
                    className="block text-xs font-medium text-[#94A3B8] mb-1.5"
                  >
                    Frame upscale
                  </label>
                  <select
                    id="reel-upscale"
                    value={upscaleFactor}
                    onChange={(e) =>
                      setUpscaleFactor(Number(e.target.value) as UpscaleFactor)
                    }
                    className="w-full bg-[#0A0D12] border border-[#222938] focus:border-pink-500 rounded-lg px-2.5 py-2 text-xs text-[#E8EDF5] outline-none cursor-pointer"
                  >
                    <option value={1}>Standard (1×)</option>
                    <option value={2}>2× Magnific / Super-Res</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="reel-chain"
                    className="block text-xs font-medium text-[#94A3B8] mb-1.5"
                  >
                    Provider chain
                  </label>
                  <select
                    id="reel-chain"
                    value={chainMode}
                    onChange={(e) => setChainMode(e.target.value as ChainMode)}
                    className="w-full bg-[#0A0D12] border border-[#222938] focus:border-pink-500 rounded-lg px-2.5 py-2 text-xs text-[#E8EDF5] outline-none cursor-pointer"
                  >
                    <option value="auto">Auto-Chain (Airforce → Pollinations → Local)</option>
                    <option value="airforce">Airforce Only</option>
                    <option value="pollinations">Pollinations Only</option>
                    <option value="local">Local Synth Only</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="reel-local-server"
                    className="block text-xs font-medium text-[#94A3B8] mb-1.5"
                  >
                    Local server URL (optional fallback)
                  </label>
                  <input
                    id="reel-local-server"
                    type="url"
                    value={localServerUrl}
                    onChange={(e) => {
                      onChangeLocalServerUrl(e.target.value);
                      saveLocalServerUrl(e.target.value);
                    }}
                    placeholder="http://127.0.0.1:8000/generate"
                    className="w-full bg-[#0A0D12] border border-[#222938] focus:border-pink-500 rounded-lg px-2.5 py-2 text-xs font-mono text-[#E8EDF5] placeholder:text-[#5B677D] outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Primary Action */}
        <div className="p-4 border-t border-[#222938] bg-[#11151E] space-y-2">
          {isBusy ? (
            <button
              type="button"
              onClick={handleCancel}
              className="w-full py-3 px-4 rounded-lg bg-[#181D29] hover:bg-red-500/15 border border-[#2A3346] hover:border-red-500/40 text-sm font-semibold text-[#E8EDF5] flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Loader2 className="w-4 h-4 animate-spin text-pink-400" />
              Cancel Reel
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleGenerateReel()}
              className="w-full py-3 px-4 rounded-lg bg-pink-600 hover:bg-pink-700 text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              Generate Reel
            </button>
          )}
        </div>
      </aside>

      {/* Right Reel Viewport */}
      <section
        className={`${
          mobileControlsOpen ? 'hidden' : 'flex'
        } lg:flex flex-1 flex-col overflow-hidden bg-[#0A0D12]`}
      >
        <div className="shrink-0 px-4 lg:px-6 py-3 border-b border-[#222938] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-[#94A3B8] font-mono tabular-nums">
            <span>{stageText}</span>
            {isRecordingPreview && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-pink-400">{compilePct}%</span>
              </>
            )}
            {activeFrames.length > 0 && !isBusy && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {dims.width}×{dims.height} · {duration}s · {activeFrames.length}{' '}
                  {activeFrames.length === 1 ? 'frame' : 'frames'}
                </span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {videoUrl && compiledSig && compiledSig.audio !== 'none' && !isRecordingPreview && (
              <button
                type="button"
                onClick={handleToggleMute}
                className="px-3 py-1.5 rounded-lg bg-[#11151E] border border-[#222938] hover:bg-[#181D29] text-xs text-[#E8EDF5] flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                {isMuted ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-[#94A3B8]" />
                    Unmute Audio
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-pink-400" />
                    Sound On
                  </>
                )}
              </button>
            )}

            {activeFrames.length > 0 && !isBusy && (
              <button
                type="button"
                onClick={() => void handleRecompile()}
                className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                  hasPendingEdits
                    ? 'bg-pink-600/15 border-pink-500/60 text-pink-200 hover:bg-pink-600/25'
                    : 'bg-[#11151E] border-[#222938] hover:bg-[#181D29] text-[#E8EDF5]'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5 text-pink-400" />
                {hasPendingEdits ? 'Apply Changes' : 'Re-Compile'}
              </button>
            )}

            {videoUrl && (
              <button
                type="button"
                onClick={() => void triggerDownload(videoUrl, `anime-reel.${videoExt}`)}
                className="px-3.5 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-700 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download .{videoExt}
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 lg:p-6 flex flex-col gap-6">
          {/* Primary Video Stage */}
          <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
            {errorMsg && (
              <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300 max-w-lg text-center">
                {errorMsg}
              </div>
            )}

            <div
              className="relative bg-[#050608] border border-[#222938] rounded-xl overflow-hidden flex items-center justify-center w-full"
              style={{
                maxWidth:
                  aspect === '9:16'
                    ? '360px'
                    : aspect === '1:1'
                      ? '500px'
                      : '720px',
                aspectRatio:
                  aspect === '9:16'
                    ? '9 / 16'
                    : aspect === '16:9'
                      ? '16 / 9'
                      : '1 / 1',
              }}
            >
              <canvas
                ref={canvasRef}
                width={dims.width}
                height={dims.height}
                className={
                  isRecordingPreview ? 'w-full h-full object-contain block' : 'hidden'
                }
              />

              {videoUrl && !isRecordingPreview && (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  autoPlay
                  loop
                  playsInline
                  muted={isMuted}
                  className="w-full h-full object-contain bg-black"
                />
              )}

              {!videoUrl && !isRecordingPreview && (
                <div className="p-6 text-center flex flex-col items-center justify-center gap-3 max-w-sm">
                  {isBusy ? (
                    <>
                      <Loader2 className="w-7 h-7 animate-spin text-pink-400" />
                      <div className="text-sm font-medium text-[#E8EDF5]">
                        {stageText}
                      </div>
                      <div className="text-xs text-[#94A3B8]">
                        Rendering anime keyframes through the keyless chain
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-11 h-11 rounded-xl bg-[#11151E] border border-[#222938] flex items-center justify-center">
                        <Film className="w-5 h-5 text-[#94A3B8]" />
                      </div>
                      <div className="text-sm font-semibold text-[#E8EDF5]">
                        Anime Reel Stage
                      </div>
                      <p className="text-xs text-[#94A3B8] leading-relaxed">
                        Describe a scene or click a sample below to synthesize anime
                        keyframes, animate camera motion, and export a WebM reel.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Starter Prompts when idle & empty */}
            {!videoUrl && !isBusy && activeFrames.length === 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-6 w-full max-w-2xl">
                {REEL_STARTER_PROMPTS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => {
                      setPrompt(starter);
                      void handleGenerateReel(starter);
                    }}
                    className="p-3 rounded-lg bg-[#11151E] border border-[#222938] hover:border-pink-500/60 hover:bg-[#181D29] text-xs text-[#CBD5E1] text-left leading-relaxed transition-colors cursor-pointer group"
                  >
                    <div>{starter}</div>
                    <div className="mt-1.5 text-[11px] font-medium text-pink-400 group-hover:text-pink-300">
                      Click to generate reel
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Active Keyframes Filmstrip */}
          {activeFrames.length > 0 && (
            <div className="border-t border-[#222938] pt-4">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-medium text-[#94A3B8]">
                  Active Keyframes (click to inspect)
                </span>
                <span className="text-xs text-[#94A3B8] font-mono tabular-nums">
                  {activeProviders.join(' · ')}
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                {activeFrames.map((src, idx) => (
                  <button
                    key={`${idx}-${src.slice(-16)}`}
                    type="button"
                    onClick={() => setInspectedFrameIdx(idx)}
                    className="aspect-square rounded-lg overflow-hidden bg-[#11151E] border border-[#222938] hover:border-pink-500/60 transition-colors cursor-pointer relative group"
                    aria-label={`Inspect keyframe ${idx + 1}`}
                  >
                    <img
                      src={src}
                      alt={`Keyframe ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Saved Reels History */}
          {reelHistory.length > 0 && (
            <div className="border-t border-[#222938] pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-[#94A3B8]">
                  Saved Reels ({reelHistory.length})
                </span>
                <button
                  type="button"
                  onClick={handleClearReels}
                  className="text-xs text-[#94A3B8] hover:text-red-300 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear All
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {reelHistory.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-[#11151E] border border-[#222938] hover:border-pink-500/50 hover:bg-[#181D29] transition-colors group"
                  >
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleLoadSavedReel(rec)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left disabled:opacity-50 cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-md overflow-hidden bg-[#080A0F] shrink-0 relative">
                        <img
                          src={rec.frames[0]}
                          alt={rec.prompt}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                          <Play className="w-3.5 h-3.5 text-white fill-white" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-[#E8EDF5] truncate">
                          {rec.prompt}
                        </div>
                        <div className="text-[11px] text-[#94A3B8] font-mono tabular-nums truncate mt-0.5">
                          {rec.aspect} · {rec.duration}s · {rec.frames.length}f · {rec.fx}
                          {rec.audio && rec.audio !== 'none' ? ` · ${rec.audio}` : ''}
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleDeleteSavedReel(rec.id)}
                      aria-label="Delete saved reel"
                      className="p-1.5 rounded-md text-[#5B677D] hover:text-red-300 hover:bg-[#0A0D12] disabled:opacity-40 transition-colors cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Lightweight Keyframe Inspector Modal */}
      {inspectedFrameUrl && inspectedFrameIdx !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
          onClick={() => setInspectedFrameIdx(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Keyframe preview"
        >
          <div
            className="bg-[#11151E] border border-[#222938] rounded-xl overflow-hidden max-w-2xl w-full flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[#222938] flex items-center justify-between">
              <span className="text-xs font-medium text-[#E8EDF5] font-mono tabular-nums">
                Keyframe {inspectedFrameIdx + 1} of {activeFrames.length}
                {activeProviders[inspectedFrameIdx]
                  ? ` · ${activeProviders[inspectedFrameIdx]}`
                  : ''}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void triggerDownload(
                      inspectedFrameUrl,
                      `reel-keyframe-${inspectedFrameIdx + 1}.png`
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-700 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  Save Frame
                </button>
                <button
                  type="button"
                  onClick={() => setInspectedFrameIdx(null)}
                  className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#E8EDF5] hover:bg-[#181D29] cursor-pointer"
                  aria-label="Close keyframe preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="bg-[#050608] p-4 flex items-center justify-center">
              <img
                src={inspectedFrameUrl}
                alt={`Keyframe ${inspectedFrameIdx + 1}`}
                referrerPolicy="no-referrer"
                className="max-h-[75dvh] max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
