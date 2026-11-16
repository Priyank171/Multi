import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { decomposeMissionTier0 } from './server/geminiDecomposer.ts';
import { SWARM_ORCHESTRATOR_PY } from './src/lib/pythonOrchestrator.ts';
import { SWARM_TIERS } from './src/data/swarmTopology.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = 3000;

  app.use(express.json({ limit: '1mb' }));

  // Tier 0 -> Tier 1 -> Tier 2 strict JSON Mission Decomposition endpoint
  app.post('/api/mission/decompose', async (req, res) => {
    try {
      const goal = typeof req.body?.goal === 'string' ? req.body.goal : '';
      const result = await decomposeMissionTier0(goal);
      res.json(result);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to decompose mission',
      });
    }
  });

  // Real-time SSE stream for the 3-stage 10-tier swarm pipeline
  app.get('/api/mission/stream', async (req, res) => {
    const goal = typeof req.query.goal === 'string' ? req.query.goal : '';
    const hedgingEnabled = req.query.hedging !== 'false';
    const injectStraggler = req.query.straggler === 'true';

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let closed = false;
    req.on('close', () => {
      closed = true;
    });

    const sendEvent = (event: string, data: unknown) => {
      if (closed) return;
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
      sendEvent('tier0_started', {
        goal: goal.trim() || 'Autonomous full-stack SaaS product launch',
        model: 'gemini-4-hydrogen',
        timestamp: new Date().toISOString(),
      });

      const { mission, usedLiveGemini, notice } = await decomposeMissionTier0(goal);
      if (closed) return;

      sendEvent('tier0_decomposed', {
        mission,
        usedLiveGemini,
        notice,
      });

      // Stream Tier 1 -> Tier 10 fan-out telemetry sequentially at high cadence
      for (let t = 1; t <= 10; t++) {
        if (closed) return;
        const spec = SWARM_TIERS[t];
        await sleep(t <= 4 ? 130 : 95);
        sendEvent('tier_fanout', {
          tier: t,
          nodeCount: spec.nodeCount,
          cumulativeNodes: spec.cumulativeNodes,
          kvPrefixReusePct: spec.kvPrefixReusePct,
          modelTarget: spec.modelTarget,
          busChannel: spec.busChannelPrefix,
        });

        if (t === 8 && (injectStraggler || hedgingEnabled)) {
          const primaryLatencyMs = injectStraggler ? 842 : 346;
          const hedgeLatencyMs = 118;
          sendEvent('hedge_race', {
            id: `hdg_${Date.now()}`,
            branchAddress: 'T8-N[004096]',
            tier: 8,
            primaryLatencyMs,
            hedgeLatencyMs,
            winner: hedgingEnabled && primaryLatencyMs > 280 ? 'hedge' : 'primary',
            savedMs: hedgingEnabled ? Math.max(0, primaryLatencyMs - hedgeLatencyMs) : 0,
            timestamp: new Date().toISOString(),
          });
        }
      }

      await sleep(140);
      sendEvent('mapreduce_complete', {
        missionId: mission.missionId,
        totalAgentsOrchestrated: 349527,
        estimatedApiCostUsd: 0.0,
        compressionRatio: '262,144:1',
        kvCacheHitPct: 96.4,
      });
    } catch (err) {
      sendEvent('stream_error', {
        error: err instanceof Error ? err.message : 'Mission stream error',
      });
    } finally {
      if (!closed) {
        res.end();
      }
    }
  });

  // Downloadable canonical async Python backend engine
  app.get('/api/orchestrator/download', (_req, res) => {
    res.setHeader('Content-Type', 'text/x-python; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="swarm_orchestrator.py"');
    res.send(SWARM_ORCHESTRATOR_PY);
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Swarm Matrix server running on http://0.0.0.0:${port}`);
  });
}

startServer();
