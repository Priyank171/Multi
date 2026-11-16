import React, { useMemo, useState } from 'react';
import { Check, ChevronRight, Copy, FolderTree, ShieldCheck, X } from 'lucide-react';
import {
  formatAgentId,
  getChildBranchFactor,
  getParentInfo,
  makeNodeKey,
  parseNodeKey,
} from '../data/swarmTopology';
import type { NodeInspectionPayload, SwarmTierLevel } from '../types/swarm';

interface NodeInspectorPanelProps {
  payload: NodeInspectionPayload;
  isExpanded: boolean;
  onSelectNode: (nodeKey: string, focusCanvas?: boolean) => void;
  onToggleExpand: (nodeKey: string) => void;
  onValidateInEngine: (jsonText: string) => void;
  onClose: () => void;
}

export const NodeInspectorPanel: React.FC<NodeInspectorPanelProps> = ({
  payload,
  isExpanded,
  onSelectNode,
  onToggleExpand,
  onValidateInEngine,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  // Build clickable breadcrumb lineage from T0 -> selected node
  const breadcrumbs = useMemo(() => {
    const chain: { key: string; label: string }[] = [];
    let { tier, index } = parseNodeKey(payload.nodeKey);
    chain.push({ key: makeNodeKey(tier, index), label: `T${tier}:${index}` });
    while (tier > 0) {
      const parent = getParentInfo(tier, index);
      if (!parent) break;
      chain.push({
        key: makeNodeKey(parent.tier, parent.index),
        label: `T${parent.tier}:${parent.index}`,
      });
      tier = parent.tier;
      index = parent.index;
    }
    return chain.reverse();
  }, [payload.nodeKey]);

  const childBranchFactor = getChildBranchFactor(payload.tier);
  const childNodes = useMemo(() => {
    if (childBranchFactor === 0) return [];
    const childTier = (payload.tier + 1) as SwarmTierLevel;
    return Array.from({ length: childBranchFactor }, (_, offset) => {
      const childIdx = payload.index * childBranchFactor + offset;
      return {
        key: makeNodeKey(childTier, childIdx),
        id: formatAgentId(childTier, childIdx),
        tier: childTier,
      };
    });
  }, [payload.tier, payload.index, childBranchFactor]);

  const jsonString = useMemo(() => JSON.stringify(payload.reducedJson, null, 2), [payload.reducedJson]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked
    }
  };

  return (
    <aside className="flex h-full w-full flex-col border-l border-[#1C2638] bg-[#090D14] xl:w-[376px] xl:shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1C2638] px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-cyan-300">
              {payload.reducedJson.node_id}
            </span>
            <span className="text-xs text-slate-400">· Tier {payload.tier}</span>
          </div>
          <p className="text-xs text-slate-300">{payload.role}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close node inspector"
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Ancestor Breadcrumb Path */}
      <div className="flex flex-wrap items-center gap-1 border-b border-[#161E2E] bg-[#070A10] px-4 py-2 text-[11px] font-mono">
        {breadcrumbs.map((crumb, i) => (
          <React.Fragment key={crumb.key}>
            {i > 0 && <ChevronRight className="h-3 w-3 text-slate-600" />}
            <button
              type="button"
              onClick={() => onSelectNode(crumb.key, true)}
              className={`rounded px-1 py-0.5 transition-colors ${
                crumb.key === payload.nodeKey
                  ? 'bg-cyan-500/15 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {crumb.label}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Status & Worker Span */}
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-slate-400 tabular-nums">
            Span: <strong className="text-slate-200">{payload.leafWorkerSpan}</strong>
          </span>
          <span
            className={`font-mono font-medium ${
              payload.status === 'straggler'
                ? 'text-rose-400'
                : payload.status === 'hedged'
                ? 'text-amber-400'
                : payload.status === 'idle'
                ? 'text-slate-400'
                : 'text-emerald-400'
            }`}
          >
            {payload.status === 'straggler'
              ? '✖ Straggler Delay'
              : payload.status === 'hedged'
              ? '▲ Hedge Quorum Won'
              : payload.status === 'idle'
              ? '○ Standby'
              : '● Nominal'}
          </span>
        </div>

        {/* Model & Latency Metrics */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-lg border border-[#1C2638] bg-[#0D121B] p-3">
            <p className="text-[11px] text-slate-400">Free / Local Model</p>
            <p className="mt-1 font-mono text-xs font-semibold text-cyan-300">
              {payload.modelTarget}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">{payload.inferencePool}</p>
          </div>
          <div className="rounded-lg border border-[#1C2638] bg-[#0D121B] p-3">
            <p className="text-[11px] text-slate-400">Latency & Ceiling</p>
            <p className="mt-1 font-mono text-xs font-semibold text-slate-100 tabular-nums">
              {payload.latencyMs} ms · ≤{payload.tokenBudget} tok
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-emerald-400 truncate">
              {payload.kvCacheHit ? `KV ${payload.kvPrefixHash}` : 'Root 1M Context'}
            </p>
          </div>
        </div>

        {/* Bus Topic */}
        <div className="rounded-lg border border-[#1C2638] bg-[#0D121B] p-3">
          <p className="text-[11px] text-slate-400">Async Event Bus Channel</p>
          <p className="mt-1 font-mono text-xs text-slate-200">
            redis://streams/{payload.busTopic}
          </p>
        </div>

        {/* Direct Child Navigation & Branch Expansion */}
        {childBranchFactor > 0 && (
          <div className="rounded-lg border border-[#1C2638] bg-[#0D121B] p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-200">
                Downstream Tier {payload.tier + 1} Children (×{childBranchFactor})
              </span>
              <button
                type="button"
                onClick={() => onToggleExpand(payload.nodeKey)}
                className="flex items-center gap-1 rounded-md border border-[#263449] px-2 py-1 text-[11px] font-medium text-cyan-300 transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <FolderTree className="h-3 w-3" />
                {isExpanded ? 'Collapse' : 'Expand on Canvas'}
              </button>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-1.5">
              {childNodes.map((child) => (
                <button
                  key={child.key}
                  type="button"
                  onClick={() => {
                    if (!isExpanded) onToggleExpand(payload.nodeKey);
                    onSelectNode(child.key, true);
                  }}
                  className="flex items-center justify-between rounded-md border border-[#192231] bg-[#080B11] px-2.5 py-1.5 text-left font-mono text-[11px] text-slate-300 transition-colors hover:border-cyan-500/50 hover:text-cyan-200"
                >
                  <span>{child.id}</span>
                  <span className="text-slate-500">→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Fixed-Size Pydantic Map-Reduce Payload */}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">
              Map-Reduce JSON Envelope
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                Copy
              </button>
              <button
                type="button"
                onClick={() => onValidateInEngine(jsonString)}
                className="flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/25"
              >
                <ShieldCheck className="h-3 w-3" />
                Validate
              </button>
            </div>
          </div>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-[#1C2638] bg-[#06080D] p-3 font-mono text-[11px] leading-relaxed text-emerald-200">
            {jsonString}
          </pre>
        </div>
      </div>
    </aside>
  );
};
