import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  ChevronDown,
  Copy,
  Download,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  Search,
  Shuffle,
  Trash2,
  X,
} from 'lucide-react';
import {
  ASPECT_DIMENSIONS,
  STARTER_PROMPTS,
  STYLE_PRESETS,
  fetchImageWithChain,
  loadHistory,
  loadLocalServerUrl,
  saveLocalServerUrl,
  triggerDownload,
  upscaleImageWithChain,
} from './lib/imageChain';
import {
  clearImagesDb,
  deleteImageFromDb,
  loadImagesFromDb,
  saveImageToDb,
} from './lib/reelDb';
import { downloadStandaloneHtml } from './lib/standaloneHtml';
import {
  AspectRatio,
  ChainMode,
  GenerationItem,
  ModelId,
  PendingSlot,
  ProviderName,
  UpscaleFactor,
} from './types/forge';
import { LightboxModal } from './components/LightboxModal';
import { ReelStudio } from './components/ReelStudio';

type StudioMode = 'reel' | 'image';
type ProviderFilter = 'All' | ProviderName;

export default function App() {
  const [studioMode, setStudioMode] = useState<StudioMode>('reel');
  const [mobileControlsOpen, setMobileControlsOpen] = useState(true);

  const [prompt, setPrompt] = useState('');
  const [negative, setNegative] = useState('');
  const [selectedStyleIds, setSelectedStyleIds] = useState<string[]>([]);
  const [aspect, setAspect] = useState<AspectRatio>('1:1');
  const [model, setModel] = useState<ModelId>('flux');
  const [batch, setBatch] = useState<number>(2);
  const [seedInput, setSeedInput] = useState<string>('');
  const [chainMode, setChainMode] = useState<ChainMode>('auto');
  const [upscaleFactor, setUpscaleFactor] = useState<UpscaleFactor>(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [localServerUrl, setLocalServerUrl] = useState<string>(() =>
    loadLocalServerUrl()
  );

  const [history, setHistory] = useState<GenerationItem[]>(() => loadHistory());
  const [pendingSlots, setPendingSlots] = useState<PendingSlot[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [upscalingId, setUpscalingId] = useState<string | null>(null);

  const [providerFilter, setProviderFilter] = useState<ProviderFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectedItem, setInspectedItem] = useState<GenerationItem | null>(null);
  const [copiedSeedId, setCopiedSeedId] = useState<string | null>(null);
  const [brokenImageIds, setBrokenImageIds] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const starterIdxRef = useRef<number>(0);

  useEffect(() => {
    let mounted = true;
    void loadImagesFromDb().then((items) => {
      if (mounted && items.length > 0) {
        setHistory(items);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3600);
    return () => clearTimeout(t);
  }, [notice]);

  const activeStyleSuffixes = useMemo(
    () =>
      STYLE_PRESETS.filter((s) => selectedStyleIds.includes(s.id)).map(
        (s) => s.suffix
      ),
    [selectedStyleIds]
  );

  const filteredHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return history.filter((item) => {
      if (providerFilter !== 'All' && item.provider !== providerFilter) {
        return false;
      }
      if (q && !item.fullPrompt.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [history, providerFilter, searchQuery]);

  const toggleStyle = (id: string) => {
    setSelectedStyleIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const rollSeed = () => {
    setSeedInput(String(Math.floor(Math.random() * 999999999)));
  };

  const handleSamplePrompt = () => {
    const next = STARTER_PROMPTS[starterIdxRef.current % STARTER_PROMPTS.length];
    starterIdxRef.current += 1;
    setPrompt(next);
    promptRef.current?.focus();
  };

  const handleCopySeed = (seed: number, itemId?: string) => {
    navigator.clipboard?.writeText(String(seed));
    if (itemId) {
      setCopiedSeedId(itemId);
      setTimeout(() => setCopiedSeedId(null), 1200);
    }
    setNotice(`Copied seed ${seed}`);
  };

  const handleReuse = (item: GenerationItem) => {
    setPrompt(item.prompt);
    setNegative(item.negative);
    setAspect(item.aspect);
    setModel(item.model);
    setSeedInput(String(item.seed));
    setMobileControlsOpen(true);
    promptRef.current?.focus();
  };

  const handleDeleteItem = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
    void deleteImageFromDb(id);
  };

  const handleClearHistory = () => {
    setHistory([]);
    void clearImagesDb();
    setNotice('History cleared');
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const handleUpscaleItem = async (item: GenerationItem, factor: 2 | 4) => {
    if (upscalingId) return;
    setUpscalingId(item.id);
    setNotice(`Upscaling ${factor}× via Magnific chain...`);
    try {
      const upscaled = await upscaleImageWithChain(
        {
          imageUrl: item.url,
          scaleFactor: factor,
          prompt: item.fullPrompt,
          localServerUrl,
        },
        {
          onStage: (stage) => setNotice(stage),
        }
      );

      const newItem: GenerationItem = {
        ...item,
        id: `${Date.now()}-up-${factor}`,
        url: upscaled.url,
        width: upscaled.width,
        height: upscaled.height,
        upscaleFactor: factor,
        upscaler: upscaled.upscaler,
        createdAt: Date.now(),
        note: `Upscaled ${factor}× from ${item.width}×${item.height} (${upscaled.upscaler})`,
      };

      setHistory((prev) => [newItem, ...prev]);
      void saveImageToDb(newItem);
      if (inspectedItem?.id === item.id) {
        setInspectedItem(newItem);
      }
      setNotice(
        `Upscaled to ${upscaled.width}×${upscaled.height} (${upscaled.upscaler})`
      );
    } catch (err) {
      setNotice((err as Error).message || 'Upscale failed');
    } finally {
      setUpscalingId(null);
    }
  };

  const handleGenerate = async (overridePrompt?: string) => {
    if (isGenerating) return;
    const rawPrompt = overridePrompt !== undefined ? overridePrompt : prompt;
    const trimmedPrompt = rawPrompt.trim();
    if (!trimmedPrompt) {
      setMobileControlsOpen(true);
      promptRef.current?.focus();
      return;
    }

    setMobileControlsOpen(false);
    const parsedSeed = parseInt(seedInput.trim(), 10);
    const baseSeed =
      seedInput.trim() !== '' && !Number.isNaN(parsedSeed)
        ? Math.max(0, parsedSeed)
        : Math.floor(Math.random() * 1e9);
    setSeedInput(String(baseSeed));

    const { width, height } = ASPECT_DIMENSIONS[aspect];
    const controller = new AbortController();
    abortRef.current = controller;
    setIsGenerating(true);

    const slots: PendingSlot[] = Array.from({ length: batch }, (_, i) => ({
      id: `pending-${Date.now()}-${i}`,
      prompt: trimmedPrompt,
      seed: baseSeed + i,
      width,
      height,
      aspect,
      model,
      stage: 'Queued...',
    }));
    setPendingSlots(slots);

    for (let i = 0; i < slots.length; i++) {
      if (controller.signal.aborted) break;
      const slot = slots[i];

      try {
        const result = await fetchImageWithChain(
          {
            prompt: trimmedPrompt,
            activeStyles: activeStyleSuffixes,
            negative: negative.trim(),
            width,
            height,
            seed: slot.seed,
            model,
            chainMode,
            localServerUrl,
            upscaleFactor,
          },
          {
            signal: controller.signal,
            onStage: (stage) => {
              setPendingSlots((prev) =>
                prev.map((p) => (p.id === slot.id ? { ...p, stage } : p))
              );
            },
          }
        );

        const newItem: GenerationItem = {
          id: `${Date.now()}-${slot.seed}-${i}`,
          url: result.url,
          prompt: trimmedPrompt,
          fullPrompt: result.fullPrompt,
          negative: negative.trim(),
          seed: slot.seed,
          width: result.width,
          height: result.height,
          aspect,
          model,
          provider: result.provider,
          upscaleFactor: result.upscaleFactor,
          upscaler: result.upscaler,
          createdAt: Date.now(),
          note: result.note,
        };

        setPendingSlots((prev) => prev.filter((p) => p.id !== slot.id));
        setHistory((prev) => [newItem, ...prev]);
        void saveImageToDb(newItem);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          break;
        }
        const message = (err as Error).message || 'Provider request failed';
        setPendingSlots((prev) =>
          prev.map((p) =>
            p.id === slot.id ? { ...p, stage: 'Failed', error: message } : p
          )
        );
      }
    }

    if (controller.signal.aborted) {
      setPendingSlots((prev) => prev.filter((p) => Boolean(p.error)));
      setNotice('Generation cancelled');
    }

    abortRef.current = null;
    setIsGenerating(false);
  };

  return (
    <div className="h-dvh flex flex-col bg-[#0A0D12] text-[#E8EDF5] overflow-hidden">
      {/* Top Bar Contract: 3-zone single row */}
      <header className="h-14 shrink-0 px-4 lg:px-6 border-b border-[#222938] bg-[#11151E] flex items-center justify-between gap-4 lg:gap-8">
        <span className="text-base font-bold tracking-tight text-[#E8EDF5] whitespace-nowrap shrink-0">
          Anime<span className="text-pink-400">Reel</span>
        </span>

        <nav
          aria-label="Studio workspace"
          className="flex items-center gap-5 sm:gap-6 text-sm font-medium shrink-0"
        >
          <button
            type="button"
            onClick={() => setStudioMode('reel')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              studioMode === 'reel'
                ? 'border-pink-500 text-[#E8EDF5]'
                : 'border-transparent text-[#94A3B8] hover:text-[#E8EDF5]'
            }`}
          >
            Reel Studio
          </button>
          <button
            type="button"
            onClick={() => setStudioMode('image')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              studioMode === 'image'
                ? 'border-indigo-500 text-[#E8EDF5]'
                : 'border-transparent text-[#94A3B8] hover:text-[#E8EDF5]'
            }`}
          >
            Image Forge
          </button>
        </nav>

        <button
          type="button"
          onClick={() => downloadStandaloneHtml(studioMode)}
          className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#181D29] hover:bg-[#222938] border border-[#2A3346] text-[#E8EDF5] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
        >
          <Download
            className={`w-3.5 h-3.5 ${
              studioMode === 'reel' ? 'text-pink-400' : 'text-indigo-400'
            }`}
          />
          Export HTML
        </button>
      </header>

      {/* Mobile View Switcher (keeps Prompt/Controls and Stage full-screen & effortless on phones) */}
      <div className="lg:hidden shrink-0 px-4 py-2 border-b border-[#222938] bg-[#0D1017]">
        <div className="grid grid-cols-2 gap-1 p-1 bg-[#11151E] border border-[#222938] rounded-lg">
          <button
            type="button"
            onClick={() => setMobileControlsOpen(true)}
            className={`py-1.5 px-3 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              mobileControlsOpen
                ? 'bg-[#181D29] text-[#E8EDF5]'
                : 'text-[#94A3B8] hover:text-[#E8EDF5]'
            }`}
          >
            Prompt & Controls
          </button>
          <button
            type="button"
            onClick={() => setMobileControlsOpen(false)}
            className={`py-1.5 px-3 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              !mobileControlsOpen
                ? 'bg-[#181D29] text-[#E8EDF5]'
                : 'text-[#94A3B8] hover:text-[#E8EDF5]'
            }`}
          >
            {studioMode === 'reel' ? 'Reel Stage' : `Gallery (${history.length})`}
          </button>
        </div>
      </div>

      {studioMode === 'reel' ? (
        <ReelStudio
          localServerUrl={localServerUrl}
          onChangeLocalServerUrl={setLocalServerUrl}
          mobileControlsOpen={mobileControlsOpen}
          onOpenMobileControls={() => setMobileControlsOpen(true)}
          onCloseMobileControls={() => setMobileControlsOpen(false)}
        />
      ) : (
        <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Control Sidebar */}
          <aside
            className={`${
              mobileControlsOpen ? 'flex flex-1 lg:flex-none' : 'hidden'
            } lg:flex w-full lg:w-[368px] lg:min-w-[368px] lg:border-r border-[#222938] bg-[#11151E] flex-col overflow-hidden`}
          >
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Prompt */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="prompt" className="text-xs font-medium text-[#94A3B8]">
                    Prompt
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSamplePrompt}
                      className="text-xs text-[#94A3B8] hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
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
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      void handleGenerate();
                    }
                  }}
                  placeholder="Describe your scene, subject, lighting, and camera..."
                  className="w-full min-h-[88px] bg-[#0A0D12] border border-[#222938] focus:border-indigo-500 rounded-lg px-3 py-2.5 text-sm text-[#E8EDF5] placeholder:text-[#5B677D] outline-none resize-y transition-colors"
                />
              </div>

              {/* Style Presets */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-[#94A3B8]">Style presets</span>
                  {selectedStyleIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedStyleIds([])}
                      className="text-xs text-[#94A3B8] hover:text-[#E8EDF5] transition-colors cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {STYLE_PRESETS.map((style) => {
                    const active = selectedStyleIds.includes(style.id);
                    return (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => toggleStyle(style.id)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium text-left border transition-colors whitespace-nowrap truncate cursor-pointer ${
                          active
                            ? 'bg-indigo-500 border-indigo-500 text-white'
                            : 'bg-[#0A0D12] border-[#222938] text-[#94A3B8] hover:bg-[#181D29] hover:text-[#E8EDF5]'
                        }`}
                      >
                        {style.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 1-Click Aspect Ratio */}
              <div>
                <span className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                  Aspect ratio
                </span>
                <div className="grid grid-cols-5 gap-1 p-1 bg-[#0A0D12] border border-[#222938] rounded-lg">
                  {(Object.keys(ASPECT_DIMENSIONS) as AspectRatio[]).map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setAspect(ratio)}
                      className={`py-1.5 rounded-md text-xs font-medium font-mono tabular-nums transition-colors cursor-pointer whitespace-nowrap ${
                        aspect === ratio
                          ? 'bg-[#181D29] text-[#E8EDF5]'
                          : 'text-[#94A3B8] hover:text-[#E8EDF5]'
                      }`}
                      title={ASPECT_DIMENSIONS[ratio].label}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              {/* Model & 1-Click Batch */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="model"
                    className="block text-xs font-medium text-[#94A3B8] mb-1.5"
                  >
                    Model
                  </label>
                  <select
                    id="model"
                    value={model}
                    onChange={(e) => setModel(e.target.value as ModelId)}
                    className="w-full bg-[#0A0D12] border border-[#222938] focus:border-indigo-500 rounded-lg px-2.5 py-2 text-xs text-[#E8EDF5] outline-none cursor-pointer"
                  >
                    <option value="flux">Flux (Default)</option>
                    <option value="flux-realism">Flux Realism</option>
                    <option value="turbo">Turbo (Fast)</option>
                  </select>
                </div>

                <div>
                  <span className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                    Batch count
                  </span>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-[#0A0D12] border border-[#222938] rounded-lg">
                    {[1, 2, 4].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setBatch(cnt)}
                        className={`py-1.5 rounded-md text-xs font-medium font-mono tabular-nums transition-colors cursor-pointer ${
                          batch === cnt
                            ? 'bg-[#181D29] text-[#E8EDF5]'
                            : 'text-[#94A3B8] hover:text-[#E8EDF5]'
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Collapsible Advanced & Routing */}
              <div className="border-t border-[#222938] pt-3">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  aria-expanded={showAdvanced}
                  className="w-full flex items-center justify-between text-xs text-[#94A3B8] hover:text-[#E8EDF5] py-1 transition-colors cursor-pointer"
                >
                  <span className="font-medium">Advanced & routing</span>
                  <span className="flex items-center gap-1.5 font-mono tabular-nums text-[11px]">
                    {upscaleFactor}× · {chainMode === 'auto' ? 'Auto' : chainMode}
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
                        htmlFor="negative-prompt"
                        className="block text-xs font-medium text-[#94A3B8] mb-1.5"
                      >
                        Negative prompt
                      </label>
                      <textarea
                        id="negative-prompt"
                        value={negative}
                        onChange={(e) => setNegative(e.target.value)}
                        placeholder="blurry, low quality, watermark, distorted"
                        className="w-full min-h-[54px] bg-[#0A0D12] border border-[#222938] focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-[#E8EDF5] placeholder:text-[#5B677D] outline-none resize-y transition-colors"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="seed" className="text-xs font-medium text-[#94A3B8]">
                          Seed
                        </label>
                        <button
                          type="button"
                          onClick={rollSeed}
                          className="text-xs text-[#94A3B8] hover:text-[#E8EDF5] flex items-center gap-1 cursor-pointer"
                        >
                          <Shuffle className="w-3 h-3" />
                          Random
                        </button>
                      </div>
                      <input
                        id="seed"
                        type="number"
                        min={0}
                        value={seedInput}
                        onChange={(e) => setSeedInput(e.target.value)}
                        placeholder="Random"
                        className="w-full bg-[#0A0D12] border border-[#222938] focus:border-indigo-500 rounded-lg px-2.5 py-2 text-xs font-mono tabular-nums text-[#E8EDF5] placeholder:text-[#5B677D] outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="upscale-factor"
                        className="block text-xs font-medium text-[#94A3B8] mb-1.5"
                      >
                        Upscale pass (Magnific → Super-Res)
                      </label>
                      <select
                        id="upscale-factor"
                        value={upscaleFactor}
                        onChange={(e) =>
                          setUpscaleFactor(Number(e.target.value) as UpscaleFactor)
                        }
                        className="w-full bg-[#0A0D12] border border-[#222938] focus:border-indigo-500 rounded-lg px-2.5 py-2 text-xs text-[#E8EDF5] outline-none cursor-pointer"
                      >
                        <option value={1}>Off (1× Native)</option>
                        <option value={2}>2× High-Res Upscale</option>
                        <option value={4}>4× Ultra-Res Upscale</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="chain-mode"
                        className="block text-xs font-medium text-[#94A3B8] mb-1.5"
                      >
                        Provider chain
                      </label>
                      <select
                        id="chain-mode"
                        value={chainMode}
                        onChange={(e) => setChainMode(e.target.value as ChainMode)}
                        className="w-full bg-[#0A0D12] border border-[#222938] focus:border-indigo-500 rounded-lg px-2.5 py-2 text-xs text-[#E8EDF5] outline-none cursor-pointer"
                      >
                        <option value="auto">
                          Auto-Chain (Airforce → Pollinations → Local)
                        </option>
                        <option value="airforce">Airforce Only</option>
                        <option value="pollinations">Pollinations Only</option>
                        <option value="local">Local Synth Only (Offline)</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="local-server"
                        className="block text-xs font-medium text-[#94A3B8] mb-1.5"
                      >
                        Local server URL (optional fallback)
                      </label>
                      <input
                        id="local-server"
                        type="url"
                        value={localServerUrl}
                        onChange={(e) => {
                          setLocalServerUrl(e.target.value);
                          saveLocalServerUrl(e.target.value);
                        }}
                        placeholder="http://127.0.0.1:8000/generate"
                        className="w-full bg-[#0A0D12] border border-[#222938] focus:border-indigo-500 rounded-lg px-2.5 py-2 text-xs font-mono text-[#E8EDF5] placeholder:text-[#5B677D] outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Primary Action */}
            <div className="p-4 border-t border-[#222938] bg-[#11151E]">
              {isGenerating ? (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="w-full py-3 px-4 rounded-lg bg-[#181D29] hover:bg-red-500/15 border border-[#2A3346] hover:border-red-500/40 text-sm font-semibold text-[#E8EDF5] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  Cancel Batch
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleGenerate()}
                  className="w-full py-3 px-4 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {upscaleFactor > 1
                    ? `Generate & Upscale ${upscaleFactor}×`
                    : 'Generate Images'}
                </button>
              )}
            </div>
          </aside>

          {/* Gallery Stage */}
          <section
            className={`${
              mobileControlsOpen ? 'hidden' : 'flex'
            } lg:flex flex-1 flex-col overflow-hidden bg-[#0A0D12]`}
          >
            {/* Stage Toolbar */}
            <div className="shrink-0 px-4 lg:px-6 py-3 border-b border-[#222938] flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 min-w-0">
                <div className="flex items-center gap-1 p-1 bg-[#11151E] border border-[#222938] rounded-lg overflow-x-auto max-w-full">
                  {(['All', 'Airforce', 'Pollinations', 'Local Synth'] as ProviderFilter[]).map(
                    (tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setProviderFilter(tab)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          providerFilter === tab
                            ? 'bg-[#181D29] text-[#E8EDF5]'
                            : 'text-[#94A3B8] hover:text-[#E8EDF5]'
                        }`}
                      >
                        {tab}
                      </button>
                    )
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-[#94A3B8] font-mono tabular-nums">
                  <span>{filteredHistory.length} saved</span>
                  {pendingSlots.length > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-indigo-300">
                        {pendingSlots.length} active
                      </span>
                    </>
                  )}
                  {notice && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#E8EDF5] font-sans">{notice}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-52">
                  <Search className="w-3.5 h-3.5 text-[#5B677D] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter prompts..."
                    aria-label="Filter gallery prompts"
                    className="w-full bg-[#11151E] border border-[#222938] focus:border-indigo-500 rounded-lg pl-8 pr-7 py-1.5 text-xs text-[#E8EDF5] placeholder:text-[#5B677D] outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#E8EDF5] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="px-3 py-1.5 rounded-lg bg-[#11151E] border border-[#222938] hover:border-red-500/40 hover:text-red-300 text-xs text-[#94A3B8] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {/* Stage Viewport */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-6">
              {pendingSlots.length === 0 && filteredHistory.length === 0 ? (
                <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center max-w-xl mx-auto px-4">
                  <div className="w-12 h-12 rounded-xl bg-[#11151E] border border-[#222938] flex items-center justify-center mb-4">
                    <ImageIcon className="w-5 h-5 text-[#94A3B8]" />
                  </div>
                  <h2 className="text-base font-semibold text-[#E8EDF5] mb-1.5">
                    {history.length === 0 ? 'Ready to forge' : 'No matching images'}
                  </h2>
                  <p className="text-sm text-[#94A3B8] mb-6 leading-relaxed">
                    {history.length === 0
                      ? 'Enter a prompt or click any starting scene below to generate immediately through the Airforce, Pollinations, and Local chain.'
                      : 'Try clearing your search filter or switching the provider tab.'}
                  </p>

                  {history.length === 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
                      {STARTER_PROMPTS.map((starter) => (
                        <button
                          key={starter}
                          type="button"
                          onClick={() => {
                            setPrompt(starter);
                            void handleGenerate(starter);
                          }}
                          className="p-3 rounded-lg bg-[#11151E] border border-[#222938] hover:border-indigo-500/60 hover:bg-[#181D29] text-xs text-[#CBD5E1] leading-relaxed transition-colors cursor-pointer group"
                        >
                          <div>{starter}</div>
                          <div className="mt-1.5 text-[11px] font-medium text-indigo-400 group-hover:text-indigo-300">
                            Click to generate
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {pendingSlots.map((slot) => (
                    <div
                      key={slot.id}
                      className="bg-[#11151E] border border-[#222938] rounded-xl overflow-hidden flex flex-col"
                    >
                      <div className="aspect-square bg-[#080A0F] flex flex-col items-center justify-center p-4 text-center gap-2.5">
                        {slot.error ? (
                          <>
                            <div className="text-xs font-semibold text-red-400">
                              Generation Failed
                            </div>
                            <div className="text-xs text-[#94A3B8] leading-snug">
                              {slot.error}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setPendingSlots((prev) =>
                                  prev.filter((p) => p.id !== slot.id)
                                )
                              }
                              className="mt-1 px-2.5 py-1 rounded bg-[#181D29] border border-[#222938] text-[11px] text-[#E8EDF5] cursor-pointer"
                            >
                              Dismiss
                            </button>
                          </>
                        ) : (
                          <>
                            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                            <div className="text-xs text-[#94A3B8]">{slot.stage}</div>
                          </>
                        )}
                      </div>
                      <div className="p-3 border-t border-[#222938]">
                        <div className="text-xs font-medium text-[#E8EDF5] truncate mb-1">
                          {slot.prompt}
                        </div>
                        <div className="text-[11px] text-[#94A3B8] font-mono tabular-nums">
                          {slot.width}×{slot.height} · {slot.model} · seed {slot.seed}
                        </div>
                      </div>
                    </div>
                  ))}

                  {filteredHistory.map((item) => {
                    const isUpscalingThis = upscalingId === item.id;
                    return (
                      <article
                        key={item.id}
                        className="bg-[#11151E] border border-[#222938] rounded-xl overflow-hidden flex flex-col group"
                      >
                        <button
                          type="button"
                          onClick={() => setInspectedItem(item)}
                          className="aspect-square bg-[#080A0F] relative overflow-hidden flex items-center justify-center cursor-pointer"
                          aria-label={`Inspect ${item.prompt}`}
                        >
                          {brokenImageIds[item.id] ? (
                            <div className="p-4 text-center flex flex-col items-center gap-2">
                              <ImageIcon className="w-6 h-6 text-[#5B677D]" />
                              <span className="text-xs text-[#94A3B8]">
                                Image preview unavailable
                              </span>
                            </div>
                          ) : (
                            <img
                              src={item.url}
                              alt={item.prompt}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={() =>
                                setBrokenImageIds((prev) => ({
                                  ...prev,
                                  [item.id]: true,
                                }))
                              }
                              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                            />
                          )}
                        </button>

                        <div className="p-3 border-t border-[#222938] flex flex-col gap-2">
                          <div>
                            <h3
                              className="text-xs font-medium text-[#E8EDF5] truncate"
                              title={item.fullPrompt}
                            >
                              {item.prompt}
                            </h3>
                            <div className="mt-1 text-[11px] text-[#94A3B8] font-mono tabular-nums truncate">
                              {item.width}×{item.height} · {item.model} · seed{' '}
                              {item.seed} · {item.provider}
                              {item.upscaleFactor && item.upscaler
                                ? ` · ${item.upscaleFactor}× ${item.upscaler}`
                                : ''}
                            </div>
                          </div>

                          <div className="grid grid-cols-4 gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                void triggerDownload(
                                  item.url,
                                  `forge-${item.seed}-${item.width}x${item.height}.png`
                                )
                              }
                              className="py-1.5 px-1.5 rounded-md bg-[#0A0D12] border border-[#222938] hover:bg-[#181D29] text-[11px] text-[#E8EDF5] flex items-center justify-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                            >
                              <Download className="w-3 h-3" />
                              Save
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(upscalingId)}
                              onClick={() => void handleUpscaleItem(item, 2)}
                              className="py-1.5 px-1.5 rounded-md bg-[#0A0D12] border border-[#222938] hover:bg-[#181D29] disabled:opacity-50 text-[11px] text-[#E8EDF5] flex items-center justify-center gap-0.5 transition-colors whitespace-nowrap cursor-pointer"
                              title="Upscale 2×"
                            >
                              {isUpscalingThis ? (
                                <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                              ) : (
                                <ArrowUpRight className="w-3 h-3 text-indigo-400" />
                              )}
                              2×
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopySeed(item.seed, item.id)}
                              className="py-1.5 px-1.5 rounded-md bg-[#0A0D12] border border-[#222938] hover:bg-[#181D29] text-[11px] text-[#E8EDF5] flex items-center justify-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                              {copiedSeedId === item.id ? 'Copied' : 'Seed'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReuse(item)}
                              className="py-1.5 px-1.5 rounded-md bg-[#0A0D12] border border-[#222938] hover:bg-[#181D29] text-[11px] text-[#E8EDF5] flex items-center justify-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Reuse
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </main>
      )}

      <LightboxModal
        item={inspectedItem}
        upscalingId={upscalingId}
        onClose={() => setInspectedItem(null)}
        onReuse={handleReuse}
        onDelete={handleDeleteItem}
        onCopySeed={(seed) => handleCopySeed(seed)}
        onUpscale={(item, factor) => void handleUpscaleItem(item, factor)}
      />
    </div>
  );
}
