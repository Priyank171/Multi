import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpLeft,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightOpen,
  Play,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { EfficiencyTelemetryStrip } from './components/EfficiencyTelemetryStrip';
import { NodeInspectorPanel } from './components/NodeInspectorPanel';
import { EfficiencyView, MissionJsonView, PythonEngineView } from './components/StudioViews';
import { SwarmTreeCanvas } from './components/SwarmTreeCanvas';
import {
  MISSION_PRESETS,
  SWARM_TIERS,
  buildDeterministicMission,
  buildNodeInspectionPayload,
  makeNodeKey,
  parseNodeKey,
} from './data/swarmTopology';
import type {
  EfficiencyTelemetry,
  HedgeRaceEvent,
  MissionDecomposition,
  StreamPhase,
  SwarmTierLevel,
  WorkspaceView,
} from './types/swarm';

function createInitialExpandedSet(): Set<string> {
  return new Set<string>(['0:0', '1:0', '1:1', '2:0', '2:1', '2:2', '2:3']);
}

function createTraceToTier10Set(): Set<string> {
  const keys = createInitialExpandedSet();
  for (let t = 3; t <= 9; t++) {
    keys.add(`${t}:0`);
  }
  return keys;
}

function buildKvSlots(activeDepth: number, hitPct: number): number[] {
  return Array.from({ length: 64 }, (_, i) => {
    if (activeDepth < 2) return 0.12 + ((i * 7) % 15) / 100;
    const base = hitPct / 100;
    const jitter = (((i * 19 + activeDepth * 11) % 24) - 12) / 100;
    return Math.max(0.1, Math.min(1, base + jitter));
  });
}

export default function App() {
  const [activeView, setActiveView] = useState<WorkspaceView>('stage');
  const [goalInput, setGoalInput] = useState<string>(MISSION_PRESETS[0]);
  const [mission, setMission] = useState<MissionDecomposition>(() =>
    buildDeterministicMission(MISSION_PRESETS[0], 'gemini-4-hydrogen (Ready)')
  );
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(createInitialExpandedSet);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string>('0:0');
  const [focusRequest, setFocusRequest] = useState<{ key: string; nonce: number } | null>(null);
  const [showLeftRail, setShowLeftRail] = useState<boolean>(true);
  const [showInspector, setShowInspector] = useState<boolean>(true);
  const [validatorSeedJson, setValidatorSeedJson] = useState<string>('');

  const [streamPhase, setStreamPhase] = useState<StreamPhase>('complete');
  const [activeTierDepth, setActiveTierDepth] = useState<number>(10);
  const [waveDirection, setWaveDirection] = useState<'top-down' | 'bottom-up' | 'idle'>('top-down');
  const [hedgingEnabled, setHedgingEnabled] = useState<boolean>(true);
  const [stragglerBranchKey, setStragglerBranchKey] = useState<string | null>(null);
  const [latestHedge, setLatestHedge] = useState<HedgeRaceEvent | null>(null);
  const [streamNotice, setStreamNotice] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);

  const eventSourceRef = useRef<EventSource | null>(null);

  const [telemetry, setTelemetry] = useState<EfficiencyTelemetry>(() => ({
    totalCostUsd: 0.0,
    baselineCloudCostUsd: 148.6,
    kvCacheHitPct: 96.4,
    prefillTokensSaved: 31_420_000,
    batchUtilizationPct: 94.2,
    activeThroughputTokSec: 18_420,
    compressionRatio: '262,144 : 1',
    p99LatencyMs: 284,
    kvSlots: buildKvSlots(10, 96.4),
  }));

  const stopActiveStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopActiveStream();
  }, [stopActiveStream]);

  const handleRunSwarm = useCallback(
    (overrideGoal?: string) => {
      const targetGoal = (overrideGoal ?? goalInput).trim() || MISSION_PRESETS[0];
      if (overrideGoal) setGoalInput(overrideGoal);

      stopActiveStream();
      setIsStreaming(true);
      setStreamError(null);
      setStreamNotice(null);
      setStreamPhase('tier0_decomposing');
      setActiveTierDepth(0);
      setWaveDirection('top-down');

      const params = new URLSearchParams({
        goal: targetGoal,
        hedging: String(hedgingEnabled),
        straggler: String(Boolean(stragglerBranchKey)),
      });

      const es = new EventSource(`/api/mission/stream?${params.toString()}`);
      eventSourceRef.current = es;

      es.addEventListener('tier0_decomposed', (evt) => {
        const data = JSON.parse((evt as MessageEvent).data);
        setMission(data.mission);
        if (data.notice) setStreamNotice(data.notice);
        setStreamPhase('fanout_active');
        setActiveTierDepth(1);
      });

      es.addEventListener('tier_fanout', (evt) => {
        const data = JSON.parse((evt as MessageEvent).data);
        const t = Number(data.tier);
        setActiveTierDepth(t);
        const hitPct = t >= 5 ? Number(data.kvPrefixReusePct) : 81.5;
        setTelemetry((prev) => ({
          ...prev,
          kvCacheHitPct: hitPct,
          prefillTokensSaved: Math.round((t / 10) * 31_420_000),
          activeThroughputTokSec: 6400 + t * 1240,
          kvSlots: buildKvSlots(t, hitPct),
        }));
        if (t >= 9) {
          setStreamPhase('mapreduce_converging');
          setWaveDirection('bottom-up');
        }
      });

      es.addEventListener('hedge_race', (evt) => {
        const data = JSON.parse((evt as MessageEvent).data) as HedgeRaceEvent;
        setLatestHedge(data);
        setStreamPhase('hedging_resolution');
      });

      es.addEventListener('mapreduce_complete', (evt) => {
        const data = JSON.parse((evt as MessageEvent).data);
        setStreamPhase('complete');
        setActiveTierDepth(10);
        setIsStreaming(false);
        setTelemetry((prev) => ({
          ...prev,
          totalCostUsd: 0.0,
          kvCacheHitPct: Number(data.kvCacheHitPct ?? 96.4),
          prefillTokensSaved: 31_420_000,
          activeThroughputTokSec: 18_420,
          kvSlots: buildKvSlots(10, 96.4),
        }));
        es.close();
        eventSourceRef.current = null;
      });

      es.addEventListener('stream_error', (evt) => {
        const data = JSON.parse((evt as MessageEvent).data);
        setStreamError(data.error || 'Swarm stream encountered an error');
        setIsStreaming(false);
        es.close();
        eventSourceRef.current = null;
      });

      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) return;
        setStreamError('Connection lost while streaming mission telemetry.');
        setIsStreaming(false);
        es.close();
        eventSourceRef.current = null;
      };
    },
    [goalInput, hedgingEnabled, stragglerBranchKey, stopActiveStream]
  );

  const handleToggleExpand = useCallback((nodeKey: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(nodeKey)) {
        next.delete(nodeKey);
      } else {
        next.add(nodeKey);
      }
      return next;
    });
  }, []);

  const handleSelectNode = useCallback((nodeKey: string, focusCanvas = false) => {
    setSelectedNodeKey(nodeKey);
    setShowInspector(true);
    setActiveView('stage');
    if (focusCanvas) {
      setFocusRequest({ key: nodeKey, nonce: Date.now() });
    }
  }, []);

  const handleFocusTier = useCallback((tier: number) => {
    const key = makeNodeKey(tier as SwarmTierLevel, 0);
    if (tier >= 3) {
      setExpandedKeys(createTraceToTier10Set());
    }
    setSelectedNodeKey(key);
    setShowInspector(true);
    setActiveView('stage');
    setFocusRequest({ key, nonce: Date.now() });
  }, []);

  const handleToggleStraggler = () => {
    if (stragglerBranchKey) {
      setStragglerBranchKey(null);
      setLatestHedge(null);
      setTelemetry((prev) => ({ ...prev, p99LatencyMs: 284 }));
    } else {
      const targetKey = '3:2';
      setStragglerBranchKey(targetKey);
      const primaryLatencyMs = 842;
      const hedgeLatencyMs = 118;
      setLatestHedge({
        id: `hdg_${Date.now()}`,
        branchAddress: 'T3-N[02]',
        tier: 3,
        primaryLatencyMs,
        hedgeLatencyMs,
        winner: hedgingEnabled ? 'hedge' : 'primary',
        savedMs: hedgingEnabled ? primaryLatencyMs - hedgeLatencyMs : 0,
        timestamp: new Date().toISOString(),
      });
      setTelemetry((prev) => ({
        ...prev,
        p99LatencyMs: hedgingEnabled ? 292 : 914,
      }));
    }
  };

  const selectedNodePayload = useMemo(() => {
    const { tier, index } = parseNodeKey(selectedNodeKey);
    return buildNodeInspectionPayload(tier, index, mission, {
      hedgingEnabled,
      stragglerBranchKey,
      activeTierDepth,
    });
  }, [selectedNodeKey, mission, hedgingEnabled, stragglerBranchKey, activeTierDepth]);

  const effectiveValidatorJson =
    validatorSeedJson || JSON.stringify(selectedNodePayload.reducedJson, null, 2);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#06080D] text-slate-100">
      {/* 3-Zone Top Bar Contract */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-8 border-b border-[#1C2638] bg-[#090D14] px-5">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveView('stage');
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
        >
          Swarm Matrix
        </a>

        {/* Zone 2: 4 Single-line Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
          <button
            type="button"
            onClick={() => setActiveView('stage')}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeView === 'stage'
                ? 'text-cyan-300 underline decoration-cyan-400 underline-offset-8'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Swarm Stage
          </button>
          <button
            type="button"
            onClick={() => setActiveView('json')}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeView === 'json'
                ? 'text-cyan-300 underline decoration-cyan-400 underline-offset-8'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Mission JSON
          </button>
          <button
            type="button"
            onClick={() => setActiveView('python')}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeView === 'python'
                ? 'text-cyan-300 underline decoration-cyan-400 underline-offset-8'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Python Engine
          </button>
          <button
            type="button"
            onClick={() => setActiveView('efficiency')}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeView === 'efficiency'
                ? 'text-cyan-300 underline decoration-cyan-400 underline-offset-8'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Efficiency
          </button>
        </nav>

        {/* Zone 3: 1 Primary CTA */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            disabled={isStreaming}
            onClick={() => handleRunSwarm()}
            className="flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            {isStreaming ? 'Orchestrating...' : 'Run Swarm'}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Sub-Strip (only shown below md so nav is never hidden) */}
      <div className="flex items-center gap-4 overflow-x-auto border-b border-[#1C2638] bg-[#090D14] px-4 py-2 text-xs font-medium md:hidden">
        {(
          [
            ['stage', 'Swarm Stage'],
            ['json', 'Mission JSON'],
            ['python', 'Python Engine'],
            ['efficiency', 'Efficiency'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveView(id)}
            className={`whitespace-nowrap shrink-0 ${
              activeView === id ? 'text-cyan-300 underline underline-offset-4' : 'text-slate-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main Workspace */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {activeView === 'stage' ? (
          <>
            {/* Docked Left Command & Parameter Rail (zero overlap with Tier 0 nodes) */}
            {showLeftRail && (
              <aside className="flex h-full w-[328px] shrink-0 flex-col border-r border-[#1C2638] bg-[#090D14]">
                <div className="flex items-center justify-between border-b border-[#1C2638] px-4 py-3">
                  <span className="text-xs font-semibold text-slate-200">
                    Mission & Topology Control
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowLeftRail(false)}
                    aria-label="Collapse control rail"
                    className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto p-4">
                  {/* Goal Input */}
                  <div>
                    <label
                      htmlFor="mission-goal-input"
                      className="block text-xs font-medium text-slate-300"
                    >
                      Project Goal (Tier 0 Mother AI)
                    </label>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleRunSwarm();
                      }}
                      className="mt-2 space-y-2"
                    >
                      <textarea
                        id="mission-goal-input"
                        rows={2}
                        value={goalInput}
                        onChange={(e) => setGoalInput(e.target.value)}
                        placeholder="Enter mission goal..."
                        className="w-full resize-none rounded-lg border border-[#1E293B] bg-[#06080D] px-3 py-2 text-xs leading-relaxed text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={isStreaming}
                        className="w-full rounded-lg border border-cyan-500/40 bg-cyan-500/15 py-2 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/25 disabled:opacity-60"
                      >
                        {isStreaming ? 'Streaming Decomposition...' : 'Decompose & Execute'}
                      </button>
                    </form>

                    {/* Live Stream Feedback */}
                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1.5 font-mono truncate">
                        <Activity className="h-3 w-3 shrink-0 text-cyan-400" />
                        {streamPhase === 'tier0_decomposing'
                          ? 'Tier 0 decomposing...'
                          : streamPhase === 'fanout_active'
                          ? `Fan-out Tier ${activeTierDepth}/10`
                          : streamPhase === 'mapreduce_converging'
                          ? '4:1 Map-Reduce...'
                          : mission.routingSource}
                      </span>
                    </div>
                    {streamNotice && (
                      <p className="mt-1.5 text-[11px] text-amber-300">{streamNotice}</p>
                    )}
                    {streamError && (
                      <p className="mt-1.5 text-[11px] text-rose-400">{streamError}</p>
                    )}
                  </div>

                  {/* Quick Mission Presets */}
                  <div className="border-t border-[#161E2E] pt-4">
                    <p className="text-xs font-medium text-slate-300">Preset Missions</p>
                    <div className="mt-2 space-y-1">
                      {MISSION_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleRunSwarm(preset)}
                          className={`block w-full rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                            goalInput === preset
                              ? 'bg-[#132032] text-cyan-300'
                              : 'text-slate-400 hover:bg-[#111827] hover:text-slate-200'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Bus Wave & Fault Simulation */}
                  <div className="border-t border-[#161E2E] pt-4">
                    <p className="text-xs font-medium text-slate-300">
                      Bus Wave & Quorum Controls
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setWaveDirection('top-down')}
                        className={`flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          waveDirection === 'top-down'
                            ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
                            : 'border-[#1E293B] bg-[#0D121B] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <ArrowDownRight className="h-3.5 w-3.5" />
                        Top-Down
                      </button>
                      <button
                        type="button"
                        onClick={() => setWaveDirection('bottom-up')}
                        className={`flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          waveDirection === 'bottom-up'
                            ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                            : 'border-[#1E293B] bg-[#0D121B] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <ArrowUpLeft className="h-3.5 w-3.5" />
                        Map-Reduce
                      </button>
                      <button
                        type="button"
                        onClick={handleToggleStraggler}
                        className={`flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          stragglerBranchKey
                            ? 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                            : 'border-[#1E293B] bg-[#0D121B] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <ShieldAlert className="h-3.5 w-3.5" />
                        {stragglerBranchKey ? 'Clear Fault' : 'Straggler'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !hedgingEnabled;
                          setHedgingEnabled(next);
                          if (stragglerBranchKey) {
                            setTelemetry((prev) => ({
                              ...prev,
                              p99LatencyMs: next ? 292 : 914,
                            }));
                          }
                        }}
                        className={`flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          hedgingEnabled
                            ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                            : 'border-[#1E293B] bg-[#0D121B] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Zap className="h-3.5 w-3.5" />
                        Hedge {hedgingEnabled ? 'On' : 'Off'}
                      </button>
                    </div>
                  </div>

                  {/* Interactive 10-Tier Quick-Jump Ladder */}
                  <div className="border-t border-[#161E2E] pt-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-slate-300">Tier Quick-Jump</p>
                      <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                        349,527 total
                      </span>
                    </div>
                    <div className="mt-2 space-y-0.5">
                      {SWARM_TIERS.map((spec) => {
                        const isSelectedTier = parseNodeKey(selectedNodeKey).tier === spec.tier;
                        return (
                          <button
                            key={spec.tier}
                            type="button"
                            onClick={() => handleFocusTier(spec.tier)}
                            className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                              isSelectedTier
                                ? 'bg-[#132032] text-cyan-300'
                                : 'text-slate-400 hover:bg-[#111827] hover:text-slate-200'
                            }`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              <span className="font-mono text-[11px] font-semibold">
                                T{spec.tier}
                              </span>
                              <span className="truncate">{spec.role}</span>
                            </span>
                            <span className="font-mono text-[11px] tabular-nums">
                              {spec.nodeCount.toLocaleString()}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </aside>
            )}

            {/* Center Flex-1 Stage + Bottom Docked Telemetry Strip */}
            <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
              {/* Toggle buttons when side rails are collapsed */}
              {!showLeftRail && (
                <button
                  type="button"
                  onClick={() => setShowLeftRail(true)}
                  aria-label="Open mission control rail"
                  className="absolute left-4 top-12 z-20 flex items-center gap-1.5 rounded-lg border border-[#1C2638] bg-[#0D121B]/95 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                >
                  <PanelLeftOpen className="h-3.5 w-3.5 text-cyan-400" />
                  Controls
                </button>
              )}
              {!showInspector && (
                <button
                  type="button"
                  onClick={() => setShowInspector(true)}
                  aria-label="Open node inspector"
                  className="absolute right-4 top-14 z-20 flex items-center gap-1.5 rounded-lg border border-[#1C2638] bg-[#0D121B]/95 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                >
                  <PanelRightOpen className="h-3.5 w-3.5 text-cyan-400" />
                  Inspector
                </button>
              )}

              <div className="min-h-0 flex-1">
                <SwarmTreeCanvas
                  mission={mission}
                  expandedKeys={expandedKeys}
                  selectedNodeKey={selectedNodeKey}
                  focusRequest={focusRequest}
                  stragglerBranchKey={stragglerBranchKey}
                  hedgingEnabled={hedgingEnabled}
                  waveDirection={waveDirection}
                  streamPhase={streamPhase}
                  activeTierDepth={activeTierDepth}
                  onSelectNode={(key) => handleSelectNode(key, false)}
                  onToggleExpand={handleToggleExpand}
                  onExpandTraceToTier10={() => setExpandedKeys(createTraceToTier10Set())}
                  onResetExpansion={() => setExpandedKeys(createInitialExpandedSet())}
                />
              </div>

              <EfficiencyTelemetryStrip
                telemetry={telemetry}
                latestHedge={latestHedge}
                hedgingEnabled={hedgingEnabled}
              />
            </div>

            {/* Docked Right Node Inspector */}
            {showInspector && (
              <div className="absolute inset-y-0 right-0 z-30 flex w-full max-w-[380px] shadow-2xl xl:static xl:w-auto xl:shadow-none">
                <NodeInspectorPanel
                  payload={selectedNodePayload}
                  isExpanded={expandedKeys.has(selectedNodeKey)}
                  onSelectNode={handleSelectNode}
                  onToggleExpand={handleToggleExpand}
                  onValidateInEngine={(jsonText) => {
                    setValidatorSeedJson(jsonText);
                    setActiveView('python');
                  }}
                  onClose={() => setShowInspector(false)}
                />
              </div>
            )}
          </>
        ) : activeView === 'json' ? (
          <div className="flex-1 overflow-hidden">
            <MissionJsonView
              mission={mission}
              onInspectNodeInStage={(key) => handleSelectNode(key, true)}
            />
          </div>
        ) : activeView === 'python' ? (
          <div className="flex-1 overflow-hidden">
            <PythonEngineView initialValidatorJson={effectiveValidatorJson} />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <EfficiencyView onFocusTier={handleFocusTier} />
          </div>
        )}
      </div>
    </div>
  );
}
