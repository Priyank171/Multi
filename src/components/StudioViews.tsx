import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, ShieldCheck } from 'lucide-react';
import { SWARM_TIERS, validateTierReducePayload } from '../data/swarmTopology';
import { SWARM_ORCHESTRATOR_PY } from '../lib/pythonOrchestrator';
import type { MissionDecomposition } from '../types/swarm';

interface MissionJsonViewProps {
  mission: MissionDecomposition;
  onInspectNodeInStage: (nodeKey: string) => void;
}

export const MissionJsonView: React.FC<MissionJsonViewProps> = ({
  mission,
  onInspectNodeInStage,
}) => {
  const [copied, setCopied] = useState(false);
  const rawJson = JSON.stringify(mission, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked
    }
  };

  const handleDownload = () => {
    const blob = new Blob([rawJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mission.missionId}_tier0_to_tier2.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full overflow-y-auto bg-[#06080D] p-6">
      <div className="mx-auto max-w-[1320px] space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#1C2638] pb-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-slate-100 text-balance">
              Tier 0 → Tier 1 → Tier 2 Mission Decomposition
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {mission.routingSource} · Cost ${mission.estimatedApiCostUsd.toFixed(2)} · 2 Division
              Directors · 4 Sector Leads (262,144 leaf workers)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-[#243247] bg-[#0D121B] px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              Copy JSON
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              Export JSON
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Structured Hierarchy */}
          <div className="space-y-4 lg:col-span-7">
            <div className="rounded-xl border border-[#1C2638] bg-[#0D121B] p-5">
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => onInspectNodeInStage('0:0')}
                  className="font-mono font-semibold text-cyan-300 hover:underline"
                >
                  {mission.tier0Strategy.motherNodeId} · {mission.tier0Strategy.model}
                </button>
                <span className="font-mono text-slate-400 tabular-nums">
                  Ceiling {mission.tier0Strategy.compressionBudgetTokens} tok · Hedge{' '}
                  {mission.tier0Strategy.hedgeTimeoutMs}ms
                </span>
              </div>
              <p className="mt-2.5 text-sm font-medium text-slate-100">
                {mission.tier0Strategy.globalObjective}
              </p>
              <p className="mt-1.5 text-xs text-slate-400">
                {mission.tier0Strategy.synthesisRule}
              </p>
            </div>

            {mission.tier1Directors.map((dir, dIdx) => (
              <div
                key={dir.id}
                className="space-y-4 rounded-xl border border-[#1C2638] bg-[#0D121B] p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => onInspectNodeInStage(`1:${dIdx}`)}
                    className="font-mono font-semibold text-sky-300 hover:underline"
                  >
                    {dir.id} · Qwen 3 (8B)
                  </button>
                  <span className="font-mono text-slate-400 tabular-nums">
                    {dir.kvPromptPrefixHash} · Quorum {dir.quorumTimeoutMs}ms
                  </span>
                </div>
                <div>
                  <h2 className="font-display text-base font-semibold text-slate-100">
                    {dir.domainName}
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300">
                    {dir.macroObjective}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {dir.tier2Leads.map((lead, lIdx) => {
                    const globalLeadIdx = dIdx * 2 + lIdx;
                    return (
                      <div
                        key={lead.id}
                        className="rounded-lg border border-[#1E293B] bg-[#080B11] p-4"
                      >
                        <div className="flex items-center justify-between font-mono text-[11px]">
                          <button
                            type="button"
                            onClick={() => onInspectNodeInStage(`2:${globalLeadIdx}`)}
                            className="font-semibold text-emerald-300 hover:underline"
                          >
                            {lead.id}
                          </button>
                          <span className="text-slate-400 tabular-nums">
                            {lead.computeBudgetPct}% · {lead.downstreamWorkers.toLocaleString()} workers
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm font-semibold text-slate-100">
                          {lead.sectorName}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                          {lead.batchPolicy}
                        </p>
                        <ul className="mt-3 space-y-1.5 text-xs text-slate-300">
                          {lead.initialTasks.map((task, tIdx) => (
                            <li key={tIdx} className="flex gap-2">
                              <span className="font-mono text-slate-500">0{tIdx + 1}.</span>
                              <span>{task}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Right: Strict Raw JSON Output */}
          <div className="lg:col-span-5">
            <div className="sticky top-0 rounded-xl border border-[#1C2638] bg-[#090D14]">
              <div className="flex items-center justify-between border-b border-[#1C2638] px-4 py-3 text-xs">
                <span className="font-mono font-semibold text-slate-200">
                  strict_mission_decomposition.json
                </span>
                <span className="font-mono text-slate-400 tabular-nums">
                  {new TextEncoder().encode(rawJson).length.toLocaleString()} bytes
                </span>
              </div>
              <pre className="max-h-[calc(100vh-220px)] overflow-auto p-4 font-mono text-xs leading-relaxed text-cyan-100">
                {rawJson}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface PythonEngineViewProps {
  initialValidatorJson: string;
}

export const PythonEngineView: React.FC<PythonEngineViewProps> = ({ initialValidatorJson }) => {
  const [copied, setCopied] = useState(false);
  const [validatorInput, setValidatorInput] = useState(initialValidatorJson);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
    parsedSizeBytes: number;
  } | null>(null);

  useEffect(() => {
    setValidatorInput(initialValidatorJson);
    setValidationResult(null);
  }, [initialValidatorJson]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SWARM_ORCHESTRATOR_PY);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked
    }
  };

  const handleDownload = () => {
    const blob = new Blob([SWARM_ORCHESTRATOR_PY], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'swarm_orchestrator.py';
    a.click();
    URL.revokeObjectURL(url);
  };

  const testOverflowCase = () => {
    const invalidSample = JSON.stringify(
      {
        node_id: 'T4-N[0012]',
        tier: 4,
        quorum_met: true,
        kv_cache_hit: true,
        compressed_summary: 'OVERFLOW '.repeat(90),
        confidence: 1.45,
        child_checksums: 'not-an-array',
      },
      null,
      2
    );
    setValidatorInput(invalidSample);
    setValidationResult(validateTierReducePayload(invalidSample));
  };

  return (
    <div className="h-full overflow-y-auto bg-[#06080D] p-6">
      <div className="mx-auto max-w-[1320px] space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#1C2638] pb-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-slate-100 text-balance">
              Async Python Engine · swarm_orchestrator.py
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              asyncio · redis.asyncio · pydantic v2 · google-genai · aiohttp continuous batching &
              speculative quorum hedging
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-[#243247] bg-[#0D121B] px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              Copy Python
            </button>
            <a
              href="/api/orchestrator/download"
              onClick={(e) => {
                e.preventDefault();
                handleDownload();
              }}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              Download swarm_orchestrator.py
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Full Async Python Source */}
          <div className="rounded-xl border border-[#1C2638] bg-[#090D14] lg:col-span-7">
            <div className="flex items-center justify-between border-b border-[#1C2638] px-4 py-3 text-xs">
              <span className="font-mono font-semibold text-cyan-300">swarm_orchestrator.py</span>
              <span className="font-mono text-slate-400 tabular-nums">
                {SWARM_ORCHESTRATOR_PY.split('\n').length} lines
              </span>
            </div>
            <pre className="max-h-[calc(100vh-240px)] overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-200">
              {SWARM_ORCHESTRATOR_PY}
            </pre>
          </div>

          {/* Right: Interactive Pydantic Map-Reduce Contract Validator */}
          <div className="space-y-4 lg:col-span-5">
            <div className="rounded-xl border border-[#1C2638] bg-[#0D121B] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-base font-semibold text-slate-100">
                  Pydantic TierReduceResult Validator
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={testOverflowCase}
                    className="rounded-md border border-rose-500/30 px-2.5 py-1 text-xs text-rose-300 hover:bg-rose-500/10 whitespace-nowrap shrink-0"
                  >
                    Test Overflow Fault
                  </button>
                  <button
                    type="button"
                    onClick={() => setValidationResult(validateTierReducePayload(validatorInput))}
                    className="flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25 whitespace-nowrap shrink-0"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Validate
                  </button>
                </div>
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                Verifies that every parent tier compresses 4 children into a fixed ≤512-token
                envelope before escalating toward Tier 0 Mother AI.
              </p>

              <textarea
                value={validatorInput}
                onChange={(e) => setValidatorInput(e.target.value)}
                rows={13}
                spellCheck={false}
                className="mt-3 w-full rounded-lg border border-[#1E293B] bg-[#06080D] p-3 font-mono text-xs leading-relaxed text-slate-200 focus:border-cyan-500 focus:outline-none"
              />

              {validationResult && (
                <div className="mt-3 rounded-lg border border-[#1E293B] bg-[#080B11] p-3 text-xs">
                  {validationResult.valid ? (
                    <span className="font-mono text-emerald-400">
                      ● Contract Valid ({validationResult.parsedSizeBytes} bytes — zero context
                      overflow)
                    </span>
                  ) : (
                    <div className="space-y-1 font-mono text-rose-400">
                      <span>✖ Contract Violation Detected:</span>
                      {validationResult.errors.map((err, i) => (
                        <p key={i}>- {err}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface EfficiencyViewProps {
  onFocusTier: (tier: number) => void;
}

export const EfficiencyView: React.FC<EfficiencyViewProps> = ({ onFocusTier }) => {
  return (
    <div className="h-full overflow-y-auto bg-[#06080D] p-6">
      <div className="mx-auto max-w-[1320px] space-y-6">
        <div className="border-b border-[#1C2638] pb-4">
          <h1 className="font-display text-2xl font-semibold text-slate-100 text-balance">
            10-Tier Mathematical Scaling & Zero-Bottleneck Efficiency
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            349,527 logical agents multiplexed across 3 shared inference pools (~24 GB total VRAM)
            at $0.00 inference cost per run
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-[#1C2638] bg-[#0D121B] p-4">
            <p className="text-xs text-slate-400">Total Swarm Agents</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-cyan-300 tabular-nums">
              349,527
            </p>
            <p className="mt-1 text-xs text-slate-400">1 + 2 + 4 + 16 … + 262,144</p>
          </div>
          <div className="rounded-xl border border-[#1C2638] bg-[#0D121B] p-4">
            <p className="text-xs text-slate-400">Pooled Local VRAM</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-slate-100 tabular-nums">
              ~24.0 GB
            </p>
            <p className="mt-1 text-xs text-slate-400">Continuous batching, 0 duplicate weights</p>
          </div>
          <div className="rounded-xl border border-[#1C2638] bg-[#0D121B] p-4">
            <p className="text-xs text-slate-400">Tier 5–10 Prefix Reuse</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-emerald-400 tabular-nums">
              96.4%
            </p>
            <p className="mt-1 text-xs text-slate-400">RadixAttention KV-cache hits</p>
          </div>
          <div className="rounded-xl border border-[#1C2638] bg-[#0D121B] p-4">
            <p className="text-xs text-slate-400">Run Inference Cost</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-emerald-400 tabular-nums">
              $0.00
            </p>
            <p className="mt-1 text-xs text-slate-400">Free-tier Gemini + local open weights</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#1C2638] bg-[#0D121B]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#1C2638] text-[11px] text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Role & Responsibility</th>
                <th className="px-4 py-3 font-medium">Routed Model & Pool</th>
                <th className="px-4 py-3 text-right font-medium">Factor</th>
                <th className="px-4 py-3 text-right font-medium">Nodes</th>
                <th className="px-4 py-3 text-right font-medium">Cumulative</th>
                <th className="px-4 py-3 text-right font-medium">KV Hit</th>
                <th className="px-4 py-3 text-right font-medium">Reduce Cap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#161E2E]">
              {SWARM_TIERS.map((spec) => (
                <tr
                  key={spec.tier}
                  onClick={() => onFocusTier(spec.tier)}
                  className="cursor-pointer transition-colors hover:bg-[#111827]"
                >
                  <td className="px-4 py-3 font-mono font-semibold text-cyan-300">T{spec.tier}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-100">{spec.role}</div>
                    <div className="text-[11px] text-slate-400">{spec.responsibility}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-slate-200">{spec.modelTarget}</div>
                    <div className="text-[11px] text-slate-400">{spec.inferencePool}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-400 tabular-nums">
                    ×{spec.branchFactor}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-slate-100 tabular-nums">
                    {spec.nodeCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-400 tabular-nums">
                    {spec.cumulativeNodes.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-400 tabular-nums">
                    {spec.kvPrefixReusePct > 0 ? `${spec.kvPrefixReusePct}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-300 tabular-nums">
                    ≤{spec.maxReduceTokens} tok
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
