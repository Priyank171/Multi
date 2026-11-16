import {
  MissionDecomposition,
  NodeInspectionPayload,
  SwarmTierLevel,
  TierSpec,
} from '../types/swarm';

export const SWARM_TIERS: TierSpec[] = [
  {
    tier: 0,
    role: 'Mother AI',
    responsibility: 'Global strategy, goal decomposition, and final synthesis',
    branchFactor: 1,
    nodeCount: 1,
    cumulativeNodes: 1,
    modelTarget: 'Gemini 4 Hydrogen (1M ctx)',
    inferencePool: 'Google AI Studio Free Tier',
    busChannelPrefix: 'swarm.t0.mother',
    kvPrefixReusePct: 0,
    maxReduceTokens: 4096,
    vramAllocationGb: 0,
  },
  {
    tier: 1,
    role: 'Division Directors',
    responsibility: 'Macro-domain routing across primary architecture tracks',
    branchFactor: 2,
    nodeCount: 2,
    cumulativeNodes: 3,
    modelTarget: 'Qwen 3 (8B)',
    inferencePool: 'Local Ollama / vLLM Pool A',
    busChannelPrefix: 'swarm.t1.directors',
    kvPrefixReusePct: 72.4,
    maxReduceTokens: 1024,
    vramAllocationGb: 6.2,
  },
  {
    tier: 2,
    role: 'Sector Leads',
    responsibility: 'Resource and compute budget allocation',
    branchFactor: 2,
    nodeCount: 4,
    cumulativeNodes: 7,
    modelTarget: 'Qwen 3 (8B)',
    inferencePool: 'Local Ollama / vLLM Pool A',
    busChannelPrefix: 'swarm.t2.sectors',
    kvPrefixReusePct: 78.9,
    maxReduceTokens: 768,
    vramAllocationGb: 6.2,
  },
  {
    tier: 3,
    role: 'Regional Orchestrators',
    responsibility: 'Multi-pipeline coordination and shard scheduling',
    branchFactor: 4,
    nodeCount: 16,
    cumulativeNodes: 23,
    modelTarget: 'Qwen 3 (8B)',
    inferencePool: 'Local vLLM Continuous Batch',
    busChannelPrefix: 'swarm.t3.regional',
    kvPrefixReusePct: 84.2,
    maxReduceTokens: 512,
    vramAllocationGb: 6.2,
  },
  {
    tier: 4,
    role: 'Cluster Managers',
    responsibility: 'Sub-workflow splitting and dependency ordering',
    branchFactor: 4,
    nodeCount: 64,
    cumulativeNodes: 87,
    modelTarget: 'Qwen 3 (8B)',
    inferencePool: 'Local vLLM Continuous Batch',
    busChannelPrefix: 'swarm.t4.cluster',
    kvPrefixReusePct: 88.6,
    maxReduceTokens: 512,
    vramAllocationGb: 6.2,
  },
  {
    tier: 5,
    role: 'Squad Supervisors',
    responsibility: 'Context window folding and memory synchronization',
    branchFactor: 4,
    nodeCount: 256,
    cumulativeNodes: 343,
    modelTarget: 'Gemma 4 E2B / Qwen 3 (1.7B)',
    inferencePool: 'Local SGLang RadixAttention Pool',
    busChannelPrefix: 'swarm.t5.squad',
    kvPrefixReusePct: 92.1,
    maxReduceTokens: 384,
    vramAllocationGb: 2.4,
  },
  {
    tier: 6,
    role: 'Team Coordinators',
    responsibility: 'Batch task queuing and continuous batch dispatch',
    branchFactor: 4,
    nodeCount: 1024,
    cumulativeNodes: 1367,
    modelTarget: 'Gemma 4 E2B / Qwen 3 (1.7B)',
    inferencePool: 'Local SGLang RadixAttention Pool',
    busChannelPrefix: 'swarm.t6.team',
    kvPrefixReusePct: 94.3,
    maxReduceTokens: 320,
    vramAllocationGb: 2.4,
  },
  {
    tier: 7,
    role: 'Sub-Team Leads',
    responsibility: 'Parallel load balancing and speculative retry logic',
    branchFactor: 4,
    nodeCount: 4096,
    cumulativeNodes: 5463,
    modelTarget: 'Gemma 4 E2B / Qwen 3 (1.7B)',
    inferencePool: 'Local SGLang RadixAttention Pool',
    busChannelPrefix: 'swarm.t7.subteam',
    kvPrefixReusePct: 95.8,
    maxReduceTokens: 256,
    vramAllocationGb: 2.4,
  },
  {
    tier: 8,
    role: 'Micro-Router Nodes',
    responsibility: 'Prompt template formatting and tool schema routing',
    branchFactor: 4,
    nodeCount: 16384,
    cumulativeNodes: 21847,
    modelTarget: 'Gemma 4 E2B / Qwen 3 (1.7B)',
    inferencePool: 'Local SGLang RadixAttention Pool',
    busChannelPrefix: 'swarm.t8.microrouter',
    kvPrefixReusePct: 97.1,
    maxReduceTokens: 256,
    vramAllocationGb: 2.4,
  },
  {
    tier: 9,
    role: 'Edge Supervisors',
    responsibility: 'Schema validation, PII filtering, and quorum gating',
    branchFactor: 4,
    nodeCount: 65536,
    cumulativeNodes: 87383,
    modelTarget: 'Gemma 4 E2B / Qwen 3 (1.7B)',
    inferencePool: 'Local SGLang RadixAttention Pool',
    busChannelPrefix: 'swarm.t9.edge',
    kvPrefixReusePct: 98.4,
    maxReduceTokens: 192,
    vramAllocationGb: 2.4,
  },
  {
    tier: 10,
    role: 'Hyper-Swarm Workers',
    responsibility: 'Atomic execution (coding, scraping, API calls, analysis)',
    branchFactor: 4,
    nodeCount: 262144,
    cumulativeNodes: 349527,
    modelTarget: 'Gemma 4 E2B / Qwen 3 (1.7B)',
    inferencePool: 'Local SGLang RadixAttention Pool',
    busChannelPrefix: 'swarm.t10.workers',
    kvPrefixReusePct: 99.2,
    maxReduceTokens: 128,
    vramAllocationGb: 2.4,
  },
];

export const TOTAL_SWARM_AGENTS = 349527;

export const MISSION_PRESETS: string[] = [
  'Autonomous full-stack SaaS product launch',
  'Global market intelligence and competitor audit',
  'Large-scale codebase security and migration',
  'Multi-region supply chain risk optimization',
];

export function makeNodeKey(tier: SwarmTierLevel, index: number): string {
  return `${tier}:${index}`;
}

export function parseNodeKey(key: string): { tier: SwarmTierLevel; index: number } {
  const [tStr, iStr] = key.split(':');
  return {
    tier: Number(tStr) as SwarmTierLevel,
    index: Number(iStr),
  };
}

export function getParentInfo(
  tier: SwarmTierLevel,
  index: number
): { tier: SwarmTierLevel; index: number } | null {
  if (tier === 0) return null;
  const spec = SWARM_TIERS[tier];
  const parentTier = (tier - 1) as SwarmTierLevel;
  const parentIndex = Math.floor(index / spec.branchFactor);
  return { tier: parentTier, index: parentIndex };
}

export function getChildBranchFactor(tier: SwarmTierLevel): number {
  if (tier >= 10) return 0;
  return SWARM_TIERS[tier + 1].branchFactor;
}

export function formatAgentId(tier: SwarmTierLevel, index: number): string {
  const padded = String(index).padStart(tier >= 8 ? 6 : tier >= 5 ? 4 : 2, '0');
  return `T${tier}-N[${padded}]`;
}

export function getLeafWorkerSpan(tier: SwarmTierLevel, index: number): string {
  if (tier === 10) {
    return `W[${String(index).padStart(6, '0')}]`;
  }
  const leavesPerNode = Math.pow(4, 10 - Math.max(tier, 2)) * (tier === 0 ? 4 : tier === 1 ? 2 : 1);
  // Exact verification:
  // T0: 4 * 4^8 = 262,144
  // T1: 2 * 4^8 = 131,072
  // T2: 1 * 4^8 = 65,536
  // T3: 4^7 = 16,384
  // T10: 4^0 = 1
  const start = index * leavesPerNode;
  const end = start + leavesPerNode - 1;
  return `W[${String(start).padStart(6, '0')}..${String(end).padStart(6, '0')}]`;
}

export function buildDeterministicMission(goal: string, routingSource = 'local-fallback-decomposer'): MissionDecomposition {
  const cleanGoal = goal.trim() || MISSION_PRESETS[0];
  const hashBase = Array.from(cleanGoal).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 2166136261);
  const hex = (n: number) => ((hashBase ^ n) >>> 0).toString(16).padStart(8, '0');

  return {
    missionId: `msn_${hex(0x9e3779b9)}`,
    projectGoal: cleanGoal,
    generatedAt: new Date().toISOString(),
    routingSource,
    estimatedApiCostUsd: 0.0,
    frontierCloudBaselineUsd: 148.6,
    tier0Strategy: {
      motherNodeId: 'T0-MOTHER-00',
      model: 'gemini-4-hydrogen',
      globalObjective: `Execute end-to-end 10-tier decomposition and deterministic Map-Reduce synthesis for: ${cleanGoal}`,
      synthesisRule: 'Strict 4:1 fixed-size Pydantic JSON compression per tier; maximum 512 tokens propagated upward.',
      compressionBudgetTokens: 4096,
      hedgeTimeoutMs: 420,
    },
    tier1Directors: [
      {
        id: 'T1-DIR-00',
        domainName: 'Core Systems, Engineering & Execution Track',
        macroObjective: `Decompose technical implementation, data pipelines, and verification workloads for "${cleanGoal}"`,
        kvPromptPrefixHash: `kv_t1_${hex(0x11)}`,
        quorumTimeoutMs: 360,
        tier2Leads: [
          {
            id: 'T2-SEC-00',
            sectorName: 'Architecture & Synthesis Pipelines',
            computeBudgetPct: 26,
            downstreamWorkers: 65536,
            batchPolicy: 'sglang-continuous-batch-256',
            targetOutputSchema: 'TierReduceResult<ArtifactManifest>',
            kvPromptPrefixHash: `kv_t2_${hex(0x21)}`,
            initialTasks: [
              'Partition primary deliverables into 4 regional DAGs',
              'Lock immutable system prompt prefix across Tier 5-10 pools',
              'Enforce strict JSON schema validation at Tier 9 edge gates',
            ],
          },
          {
            id: 'T2-SEC-01',
            sectorName: 'Automated Verification & Edge QA',
            computeBudgetPct: 24,
            downstreamWorkers: 65536,
            batchPolicy: 'sglang-continuous-batch-256',
            targetOutputSchema: 'TierReduceResult<VerificationLedger>',
            kvPromptPrefixHash: `kv_t2_${hex(0x22)}`,
            initialTasks: [
              'Dispatch parallel adversarial checks across 65,536 leaf workers',
              'Enable speculative quorum hedging at 280ms P95 threshold',
              'Compress test vectors via 4:1 hierarchical Map-Reduce',
            ],
          },
        ],
      },
      {
        id: 'T1-DIR-01',
        domainName: 'Intelligence, Telemetry & Rollout Track',
        macroObjective: `Orchestrate external research, market/domain synthesis, and operational delivery for "${cleanGoal}"`,
        kvPromptPrefixHash: `kv_t1_${hex(0x12)}`,
        quorumTimeoutMs: 360,
        tier2Leads: [
          {
            id: 'T2-SEC-02',
            sectorName: 'Distributed Acquisition & Signal Extraction',
            computeBudgetPct: 25,
            downstreamWorkers: 65536,
            batchPolicy: 'vllm-radix-prefix-512',
            targetOutputSchema: 'TierReduceResult<SignalDigest>',
            kvPromptPrefixHash: `kv_t2_${hex(0x23)}`,
            initialTasks: [
              'Fan out atomic extraction tasks via NATS JetStream subjects',
              'Deduplicate semantic payloads at Tier 7 Sub-Team Leads',
              'Maintain >=95% RadixAttention KV-cache prefix reuse',
            ],
          },
          {
            id: 'T2-SEC-03',
            sectorName: 'Synthesis, Packaging & Final Convergence',
            computeBudgetPct: 25,
            downstreamWorkers: 65536,
            batchPolicy: 'vllm-radix-prefix-512',
            targetOutputSchema: 'TierReduceResult<ExecutiveBrief>',
            kvPromptPrefixHash: `kv_t2_${hex(0x24)}`,
            initialTasks: [
              'Aggregate Tier 4 Cluster Manager digests into fixed schemas',
              'Run final contradiction sweep before Tier 0 escalation',
              'Deliver zero-overflow synthesis payload to Mother AI',
            ],
          },
        ],
      },
    ],
  };
}

export function buildNodeInspectionPayload(
  tier: SwarmTierLevel,
  index: number,
  mission: MissionDecomposition,
  options: {
    hedgingEnabled: boolean;
    stragglerBranchKey: string | null;
    activeTierDepth: number;
  }
): NodeInspectionPayload {
  const spec = SWARM_TIERS[tier];
  const nodeKey = makeNodeKey(tier, index);
  const parent = getParentInfo(tier, index);
  const parentKey = parent ? makeNodeKey(parent.tier, parent.index) : null;
  const isStraggler = options.stragglerBranchKey === nodeKey;
  const isHedged = isStraggler && options.hedgingEnabled;

  // Map node back to its governing Tier 1 & Tier 2 branch
  const leavesPerT1 = 131072;
  const leavesPerT2 = 65536;
  const leavesPerThis =
    tier === 0 ? 262144 : tier === 1 ? leavesPerT1 : Math.pow(4, 10 - tier);
  const firstLeaf = index * leavesPerThis;
  const t1Idx = Math.min(1, Math.floor(firstLeaf / leavesPerT1));
  const t2Idx = Math.min(1, Math.floor((firstLeaf % leavesPerT1) / leavesPerT2));
  const dir = mission.tier1Directors[t1Idx];
  const lead = dir?.tier2Leads[t2Idx];

  const seed = (tier * 7919 + index * 104729) >>> 0;
  const hex = (offset: number) => ((seed + offset) >>> 0).toString(16).padStart(6, '0');
  const kvPrefixHash =
    tier === 0
      ? 'kv_t0_root_1m'
      : tier === 1
      ? dir?.kvPromptPrefixHash ?? `kv_t1_${hex(1)}`
      : lead?.kvPromptPrefixHash ?? `kv_t${tier}_shared_${hex(tier * 13)}`;

  const status: NodeInspectionPayload['status'] = isHedged
    ? 'hedged'
    : isStraggler
    ? 'straggler'
    : options.activeTierDepth >= 10
    ? 'reduced'
    : options.activeTierDepth >= tier
    ? 'executing'
    : 'idle';

  const baseLatency = tier === 0 ? 310 : tier <= 4 ? 82 + (seed % 38) : 18 + (seed % 24);
  const latencyMs = isStraggler && !options.hedgingEnabled ? baseLatency + 640 : isHedged ? baseLatency + 14 : baseLatency;

  const summary =
    tier === 0
      ? mission.tier0Strategy.globalObjective
      : tier === 1
      ? `${dir?.domainName}: ${dir?.macroObjective}`
      : tier === 2
      ? `${lead?.sectorName} (${lead?.computeBudgetPct}% budget, ${lead?.downstreamWorkers.toLocaleString()} workers)`
      : `Compressed 4:1 Map-Reduce digest for ${lead?.sectorName ?? 'Swarm Sector'} covering ${getLeafWorkerSpan(tier, index)}`;

  const childCount = getChildBranchFactor(tier);
  const childChecksums = Array.from({ length: childCount }, (_, k) => `sha256:${hex(k * 97 + 11)}`);

  return {
    nodeKey,
    tier,
    index,
    role: spec.role,
    parentKey,
    branchFactor: spec.branchFactor,
    leafWorkerSpan: getLeafWorkerSpan(tier, index),
    modelTarget: spec.modelTarget,
    inferencePool: spec.inferencePool,
    busTopic: `${spec.busChannelPrefix}.${String(index).padStart(4, '0')}`,
    kvPrefixHash,
    kvCacheHit: tier >= 1,
    status,
    latencyMs,
    tokenBudget: spec.maxReduceTokens,
    reducedJson: {
      node_id: formatAgentId(tier, index),
      tier,
      quorum_met: !isStraggler || options.hedgingEnabled,
      kv_cache_hit: tier >= 1,
      compressed_summary: summary,
      confidence: Number((0.94 + ((seed % 55) / 1000)).toFixed(3)),
      child_checksums: childChecksums,
    },
  };
}

export function validateTierReducePayload(rawJson: string): {
  valid: boolean;
  errors: string[];
  parsedSizeBytes: number;
} {
  try {
    const obj = JSON.parse(rawJson);
    const errors: string[] = [];
    if (typeof obj.node_id !== 'string' || !obj.node_id.trim()) {
      errors.push('Missing string field: node_id');
    }
    if (typeof obj.tier !== 'number' || obj.tier < 0 || obj.tier > 10) {
      errors.push('Field "tier" must be an integer between 0 and 10');
    }
    if (typeof obj.quorum_met !== 'boolean') {
      errors.push('Field "quorum_met" must be a boolean');
    }
    if (typeof obj.kv_cache_hit !== 'boolean') {
      errors.push('Field "kv_cache_hit" must be a boolean');
    }
    if (typeof obj.compressed_summary !== 'string' || obj.compressed_summary.length > 640) {
      errors.push('Field "compressed_summary" must be a string <= 640 chars to prevent Mother AI context overflow');
    }
    if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 1) {
      errors.push('Field "confidence" must be a float in [0.0, 1.0]');
    }
    if (!Array.isArray(obj.child_checksums)) {
      errors.push('Field "child_checksums" must be an array of string hashes');
    }
    return {
      valid: errors.length === 0,
      errors,
      parsedSizeBytes: new TextEncoder().encode(rawJson).length,
    };
  } catch (err) {
    return {
      valid: false,
      errors: [`JSON syntax error: ${err instanceof Error ? err.message : 'Invalid JSON'}`],
      parsedSizeBytes: 0,
    };
  }
}
