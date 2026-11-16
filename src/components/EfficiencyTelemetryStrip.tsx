import React, { useState } from 'react';
import type { EfficiencyTelemetry, HedgeRaceEvent } from '../types/swarm';

interface EfficiencyTelemetryStripProps {
  telemetry: EfficiencyTelemetry;
  latestHedge: HedgeRaceEvent | null;
  hedgingEnabled: boolean;
}

export const EfficiencyTelemetryStrip: React.FC<EfficiencyTelemetryStripProps> = ({
  telemetry,
  latestHedge,
  hedgingEnabled,
}) => {
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-[#1C2638] bg-[#090D14] px-4 py-2.5">
      {/* Left Cluster: Free Run Cost + Map-Reduce Fold + Throughput */}
      <div className="flex flex-wrap items-center gap-5">
        <div>
          <p className="text-[11px] text-slate-400">Run Cost</p>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-base font-semibold text-emerald-400 tabular-nums">
              ${telemetry.totalCostUsd.toFixed(2)}
            </span>
            <span className="font-mono text-[11px] text-slate-500 tabular-nums">
              vs ${telemetry.baselineCloudCostUsd.toFixed(0)} cloud
            </span>
          </div>
        </div>

        <div className="h-6 w-px bg-[#1C2638]" />

        <div>
          <p className="text-[11px] text-slate-400">Map-Reduce Fold</p>
          <p className="font-mono text-xs font-semibold text-slate-100 tabular-nums">
            {telemetry.compressionRatio}
          </p>
        </div>

        <div className="h-6 w-px bg-[#1C2638]" />

        <div>
          <p className="text-[11px] text-slate-400">Pooled Throughput</p>
          <p className="font-mono text-xs font-semibold text-cyan-300 tabular-nums">
            {telemetry.activeThroughputTokSec.toLocaleString()} tok/s
          </p>
        </div>
      </div>

      {/* Center Cluster: Interactive 64-Slot KV-Cache Prefix Heatmap */}
      <div className="flex items-center gap-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">KV-Cache Reuse</span>
            <span className="font-mono text-xs font-semibold text-emerald-400 tabular-nums">
              {telemetry.kvCacheHitPct.toFixed(1)}%
            </span>
          </div>
          <p className="font-mono text-[11px] text-slate-400 tabular-nums">
            {hoveredSlot !== null
              ? `Slot #${String(hoveredSlot).padStart(2, '0')} · ${Math.round(
                  telemetry.kvSlots[hoveredSlot] * 100
                )}% prefix hit`
              : `${(telemetry.prefillTokensSaved / 1_000_000).toFixed(2)}M prefill tok saved`}
          </p>
        </div>

        <div
          className="grid grid-cols-16 gap-0.5"
          onMouseLeave={() => setHoveredSlot(null)}
          aria-label="64-slot RadixAttention KV-cache prefix matrix"
        >
          {telemetry.kvSlots.map((density, idx) => {
            const bg =
              density >= 0.85
                ? 'bg-emerald-400'
                : density >= 0.55
                ? 'bg-cyan-400'
                : density >= 0.25
                ? 'bg-cyan-700'
                : 'bg-slate-800';
            return (
              <span
                key={idx}
                onMouseEnter={() => setHoveredSlot(idx)}
                className={`h-2 w-2 rounded-[1px] transition-transform ${bg} ${
                  hoveredSlot === idx ? 'scale-125 ring-1 ring-white' : ''
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Right Cluster: Speculative Hedging Race */}
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Speculative Hedge</span>
            <span
              className={`font-mono text-[11px] font-medium ${
                hedgingEnabled ? 'text-amber-400' : 'text-slate-500'
              }`}
            >
              {hedgingEnabled ? '● Quorum Active' : '○ Disabled'}
            </span>
          </div>
          {latestHedge ? (
            <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
              <span className="text-rose-400">P1 {latestHedge.primaryLatencyMs}ms</span>
              <span className="text-slate-600">/</span>
              <span className="text-emerald-400">Hedge {latestHedge.hedgeLatencyMs}ms</span>
              <span className="text-amber-300">(-{latestHedge.savedMs}ms)</span>
            </div>
          ) : (
            <p className="font-mono text-[11px] text-slate-400 tabular-nums">
              P99 Bound: {telemetry.p99LatencyMs}ms
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
