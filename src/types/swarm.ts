export type SwarmTierLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface TierSpec {
  tier: SwarmTierLevel;
  role: string;
  responsibility: string;
  branchFactor: number;
  nodeCount: number;
  cumulativeNodes: number;
  modelTarget: string;
  inferencePool: string;
  busChannelPrefix: string;
  kvPrefixReusePct: number;
  maxReduceTokens: number;
  vramAllocationGb: number;
}

export interface Tier2SectorLead {
  id: string;
  sectorName: string;
  computeBudgetPct: number;
  downstreamWorkers: number;
  batchPolicy: string;
  targetOutputSchema: string;
  kvPromptPrefixHash: string;
  initialTasks: string[];
}

export interface Tier1Director {
  id: string;
  domainName: string;
  macroObjective: string;
  kvPromptPrefixHash: string;
  quorumTimeoutMs: number;
  tier2Leads: Tier2SectorLead[];
}

export interface MissionDecomposition {
  missionId: string;
  projectGoal: string;
  generatedAt: string;
  routingSource: string;
  estimatedApiCostUsd: number;
  frontierCloudBaselineUsd: number;
  tier0Strategy: {
    motherNodeId: string;
    model: string;
    globalObjective: string;
    synthesisRule: string;
    compressionBudgetTokens: number;
    hedgeTimeoutMs: number;
  };
  tier1Directors: Tier1Director[];
}

export interface HedgeRaceEvent {
  id: string;
  branchAddress: string;
  tier: SwarmTierLevel;
  primaryLatencyMs: number;
  hedgeLatencyMs: number;
  winner: 'primary' | 'hedge';
  savedMs: number;
  timestamp: string;
}

export interface EfficiencyTelemetry {
  totalCostUsd: number;
  baselineCloudCostUsd: number;
  kvCacheHitPct: number;
  prefillTokensSaved: number;
  batchUtilizationPct: number;
  activeThroughputTokSec: number;
  compressionRatio: string;
  p99LatencyMs: number;
  kvSlots: number[]; // 64 slots from 0..1 indicating prefix reuse density
}

export interface NodeInspectionPayload {
  nodeKey: string;
  tier: SwarmTierLevel;
  index: number;
  role: string;
  parentKey: string | null;
  branchFactor: number;
  leafWorkerSpan: string;
  modelTarget: string;
  inferencePool: string;
  busTopic: string;
  kvPrefixHash: string;
  kvCacheHit: boolean;
  status: 'idle' | 'routing' | 'executing' | 'hedged' | 'reduced' | 'straggler';
  latencyMs: number;
  tokenBudget: number;
  reducedJson: {
    node_id: string;
    tier: number;
    quorum_met: boolean;
    kv_cache_hit: boolean;
    compressed_summary: string;
    confidence: number;
    child_checksums: string[];
  };
}

export type StreamPhase =
  | 'idle'
  | 'tier0_decomposing'
  | 'fanout_active'
  | 'hedging_resolution'
  | 'mapreduce_converging'
  | 'complete';

export type WorkspaceView = 'stage' | 'json' | 'python' | 'efficiency';
