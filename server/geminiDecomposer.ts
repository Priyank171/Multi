import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { buildDeterministicMission } from '../src/data/swarmTopology.ts';
import type { MissionDecomposition } from '../src/types/swarm.ts';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function decomposeMissionTier0(projectGoal: string): Promise<{
  mission: MissionDecomposition;
  usedLiveGemini: boolean;
  notice?: string;
}> {
  const cleanGoal = projectGoal.trim() || 'Autonomous full-stack SaaS product launch';
  const ai = getGeminiClient();

  if (!ai) {
    return {
      mission: buildDeterministicMission(cleanGoal, 'local-zero-cost-decomposer'),
      usedLiveGemini: false,
      notice: 'Free local decomposer active (no live Gemini API key attached).',
    };
  }

  const prompt = [
    'You are the Tier 0 Mother AI for a 10-Tier Hierarchical Multi-Agent AI Swarm totaling 349,527 agents.',
    'Decompose the mission goal into exactly 2 Tier 1 Division Directors, and for EACH Division Director provide exactly 2 Tier 2 Sector Leads (4 Sector Leads total, each governing 65,536 Tier 10 workers).',
    'Optimize every objective for zero-cost local open-weight execution (Qwen 3 8B for T1-T4, Gemma 4 E2B / Qwen 3 1.7B for T5-T10) and strict fixed-size JSON Map-Reduce.',
    `Project Goal: ${cleanGoal}`,
  ].join('\n');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'Return concise, concrete engineering and operational breakdowns matching the strict JSON schema. Keep strings crisp and domain-specific.',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            globalObjective: {
              type: Type.STRING,
              description: 'Single-sentence Tier 0 Mother AI strategic directive.',
            },
            synthesisRule: {
              type: Type.STRING,
              description: 'How 4:1 child outputs compress upward without overflowing Mother AI context.',
            },
            tier1Directors: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  domainName: { type: Type.STRING },
                  macroObjective: { type: Type.STRING },
                  tier2Leads: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        sectorName: { type: Type.STRING },
                        computeBudgetPct: { type: Type.INTEGER },
                        targetOutputSchema: { type: Type.STRING },
                        initialTasks: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING },
                        },
                      },
                      required: [
                        'id',
                        'sectorName',
                        'computeBudgetPct',
                        'targetOutputSchema',
                        'initialTasks',
                      ],
                    },
                  },
                },
                required: ['id', 'domainName', 'macroObjective', 'tier2Leads'],
              },
            },
          },
          required: ['globalObjective', 'synthesisRule', 'tier1Directors'],
        },
      },
    });

    const rawText = (response.text ?? '').trim();
    const parsed = JSON.parse(rawText);

    const fallback = buildDeterministicMission(cleanGoal, 'gemini-4-hydrogen (Free Tier)');
    const rawDirs = Array.isArray(parsed.tier1Directors) ? parsed.tier1Directors.slice(0, 2) : [];

    const normalizedDirs = [0, 1].map((dIdx) => {
      const srcDir = rawDirs[dIdx];
      const fbDir = fallback.tier1Directors[dIdx];
      const rawLeads = Array.isArray(srcDir?.tier2Leads) ? srcDir.tier2Leads.slice(0, 2) : [];

      return {
        id: `T1-DIR-0${dIdx}`,
        domainName: String(srcDir?.domainName || fbDir.domainName),
        macroObjective: String(srcDir?.macroObjective || fbDir.macroObjective),
        kvPromptPrefixHash: fbDir.kvPromptPrefixHash,
        quorumTimeoutMs: 360,
        tier2Leads: [0, 1].map((lIdx) => {
          const srcLead = rawLeads[lIdx];
          const fbLead = fbDir.tier2Leads[lIdx];
          const leadGlobalIdx = dIdx * 2 + lIdx;
          return {
            id: `T2-SEC-0${leadGlobalIdx}`,
            sectorName: String(srcLead?.sectorName || fbLead.sectorName),
            computeBudgetPct:
              typeof srcLead?.computeBudgetPct === 'number' &&
              srcLead.computeBudgetPct >= 10 &&
              srcLead.computeBudgetPct <= 50
                ? Math.round(srcLead.computeBudgetPct)
                : 25,
            downstreamWorkers: 65536,
            batchPolicy: leadGlobalIdx < 2 ? 'sglang-continuous-batch-256' : 'vllm-radix-prefix-512',
            targetOutputSchema: String(srcLead?.targetOutputSchema || fbLead.targetOutputSchema),
            kvPromptPrefixHash: fbLead.kvPromptPrefixHash,
            initialTasks:
              Array.isArray(srcLead?.initialTasks) && srcLead.initialTasks.length > 0
                ? srcLead.initialTasks.slice(0, 3).map(String)
                : fbLead.initialTasks,
          };
        }),
      };
    });

    const mission: MissionDecomposition = {
      ...fallback,
      routingSource: 'gemini-4-hydrogen (Live Free Tier)',
      estimatedApiCostUsd: 0.0,
      tier0Strategy: {
        ...fallback.tier0Strategy,
        globalObjective: String(parsed.globalObjective || fallback.tier0Strategy.globalObjective),
        synthesisRule: String(parsed.synthesisRule || fallback.tier0Strategy.synthesisRule),
      },
      tier1Directors: normalizedDirs,
    };

    return { mission, usedLiveGemini: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upstream Gemini request failed';
    return {
      mission: buildDeterministicMission(cleanGoal, 'local-zero-cost-fallback'),
      usedLiveGemini: false,
      notice: `Switched to zero-cost local fallback (${message.slice(0, 110)})`,
    };
  }
}
