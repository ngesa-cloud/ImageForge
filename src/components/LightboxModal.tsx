import { useEffect } from 'react';
import {
  ArrowUpRight,
  Copy,
  Download,
  Loader2,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { triggerDownload } from '../lib/imageChain';
import { GenerationItem } from '../types/forge';

interface LightboxModalProps {
  item: GenerationItem | null;
  upscalingId: string | null;
  onClose: () => void;
  onReuse: (item: GenerationItem) => void;
  onDelete: (id: string) => void;
  onCopySeed: (seed: number) => void;
  onUpscale: (item: GenerationItem, scaleFactor: 2 | 4) => void;
}

export function LightboxModal({
  item,
  upscalingId,
  onClose,
  onReuse,
  onDelete,
  onCopySeed,
  onUpscale,
}: LightboxModalProps) {
  useEffect(() => {
    if (!item) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [item, onClose]);

  if (!item) return null;

  const isUpscaling = upscalingId === item.id;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 md:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image inspection dialog"
    >
      <div
        className="relative flex flex-col lg:flex-row w-full max-w-5xl max-h-[90dvh] bg-[#11151E] border border-[#222938] rounded-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 bg-[#080A0F] flex items-center justify-center p-4 min-h-[260px] lg:min-h-[480px] overflow-hidden relative">
          <img
            src={item.url}
            alt={item.prompt}
            referrerPolicy="no-referrer"
            className="max-w-full max-h-[70dvh] lg:max-h-[82dvh] object-contain rounded-lg"
          />
        </div>

        <div className="w-full lg:w-88 shrink-0 border-t lg:border-t-0 lg:border-l border-[#222938] p-5 flex flex-col justify-between gap-5 overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#E8EDF5]">Generation Details</h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#E8EDF5] hover:bg-[#181D29] transition-colors cursor-pointer"
                aria-label="Close inspector"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <div className="text-xs font-medium text-[#94A3B8] mb-1">Prompt</div>
              <p className="text-sm text-[#E8EDF5] leading-relaxed break-words">
                {item.fullPrompt}
              </p>
            </div>

            {item.negative && (
              <div>
                <div className="text-xs font-medium text-[#94A3B8] mb-1">Negative Prompt</div>
                <p className="text-xs text-[#94A3B8] leading-relaxed break-words">
                  {item.negative}
                </p>
              </div>
            )}

            <div className="pt-3 border-t border-[#222938] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">Provider</span>
                <span className="text-[#E8EDF5] font-medium">{item.provider}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">Model</span>
                <span className="text-[#E8EDF5] font-mono">{item.model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">Dimensions</span>
                <span className="text-[#E8EDF5] font-mono tabular-nums">
                  {item.width}×{item.height} ({item.aspect})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">Seed</span>
                <span className="text-[#E8EDF5] font-mono tabular-nums">{item.seed}</span>
              </div>
              {item.upscaler && item.upscaleFactor && (
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Upscale</span>
                  <span className="text-indigo-300 font-mono tabular-nums">
                    {item.upscaleFactor}× {item.upscaler}
                  </span>
                </div>
              )}
              {item.note && (
                <div className="pt-2 text-[11px] text-[#94A3B8] border-t border-[#222938]">
                  {item.note}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-[#222938]">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isUpscaling}
                onClick={() => onUpscale(item, 2)}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#181D29] border border-[#2A3346] hover:border-indigo-500/60 disabled:opacity-50 text-xs font-medium text-[#E8EDF5] transition-colors cursor-pointer whitespace-nowrap"
              >
                {isUpscaling ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                ) : (
                  <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400" />
                )}
                Upscale 2×
              </button>
              <button
                type="button"
                disabled={isUpscaling}
                onClick={() => onUpscale(item, 4)}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#181D29] border border-[#2A3346] hover:border-indigo-500/60 disabled:opacity-50 text-xs font-medium text-[#E8EDF5] transition-colors cursor-pointer whitespace-nowrap"
              >
                {isUpscaling ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                ) : (
                  <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400" />
                )}
                Upscale 4×
              </button>
            </div>
            <button
              type="button"
              onClick={() =>
                void triggerDownload(
                  item.url,
                  `forge-${item.seed}-${item.width}x${item.height}.png`
                )
              }
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download Image
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onCopySeed(item.seed)}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#0A0D12] border border-[#222938] hover:bg-[#181D29] text-xs text-[#E8EDF5] transition-colors cursor-pointer whitespace-nowrap"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy Seed
              </button>
              <button
                type="button"
                onClick={() => {
                  onReuse(item);
                  onClose();
                }}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#0A0D12] border border-[#222938] hover:bg-[#181D29] text-xs text-[#E8EDF5] transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reuse Prompt
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                onDelete(item.id);
                onClose();
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-[#222938] hover:border-red-500/40 hover:bg-red-500/10 text-xs text-[#94A3B8] hover:text-red-300 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove from History
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
