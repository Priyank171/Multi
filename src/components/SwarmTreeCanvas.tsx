import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Plus, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import {
  SWARM_TIERS,
  formatAgentId,
  getChildBranchFactor,
  getLeafWorkerSpan,
  getParentInfo,
  makeNodeKey,
  parseNodeKey,
} from '../data/swarmTopology';
import type { MissionDecomposition, StreamPhase, SwarmTierLevel } from '../types/swarm';

interface LayoutNode {
  key: string;
  tier: SwarmTierLevel;
  index: number;
  parentKey: string | null;
  x: number;
  y: number;
  hasChildren: boolean;
  isExpanded: boolean;
  branchFactor: number;
  childCount: number;
}

interface LayoutEdge {
  fromIdx: number;
  toIdx: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  tier: SwarmTierLevel;
  fromKey: string;
  toKey: string;
}

interface SwarmTreeCanvasProps {
  mission: MissionDecomposition;
  expandedKeys: Set<string>;
  selectedNodeKey: string;
  focusRequest: { key: string; nonce: number } | null;
  stragglerBranchKey: string | null;
  hedgingEnabled: boolean;
  waveDirection: 'top-down' | 'bottom-up' | 'idle';
  streamPhase: StreamPhase;
  activeTierDepth: number;
  onSelectNode: (nodeKey: string) => void;
  onToggleExpand: (nodeKey: string) => void;
  onExpandTraceToTier10: () => void;
  onResetExpansion: () => void;
}

const COL_SPACING = 212;
const ROW_SPACING = 52;
const NODE_W = 156;
const NODE_H = 36;
const MAX_PULSES = 420;
const STRIDE = 5; // [edgeIdx, progress, speed, pulseType, active]

export const SwarmTreeCanvas: React.FC<SwarmTreeCanvasProps> = ({
  mission,
  expandedKeys,
  selectedNodeKey,
  focusRequest,
  stragglerBranchKey,
  hedgingEnabled,
  waveDirection,
  streamPhase,
  activeTierDepth,
  onSelectNode,
  onToggleExpand,
  onExpandTraceToTier10,
  onResetExpansion,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef({ x: 64, y: 260, scale: 0.9 });
  const hasFittedRef = useRef(false);
  const dragRef = useRef<{
    dragging: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    camX: number;
    camY: number;
  }>({
    dragging: false,
    moved: false,
    startX: 0,
    startY: 0,
    camX: 0,
    camY: 0,
  });

  // Zero-allocation typed-array pool for active pulse packets
  const pulsePoolRef = useRef<Float32Array>(new Float32Array(MAX_PULSES * STRIDE));
  const [hoverInfo, setHoverInfo] = useState<{
    node: LayoutNode;
    screenX: number;
    screenY: number;
  } | null>(null);
  const [zoomPct, setZoomPct] = useState(90);

  // Compute ancestor lineage set for selectedNodeKey so the active trace glows cleanly
  const lineageKeys = useMemo(() => {
    const set = new Set<string>();
    let { tier, index } = parseNodeKey(selectedNodeKey);
    set.add(makeNodeKey(tier, index));
    while (tier > 0) {
      const parent = getParentInfo(tier, index);
      if (!parent) break;
      set.add(makeNodeKey(parent.tier, parent.index));
      tier = parent.tier;
      index = parent.index;
    }
    return set;
  }, [selectedNodeKey]);

  // Compute virtualized orthogonal tree layout only for currently expanded paths
  const { nodes, edges, bounds, nodeByKey } = useMemo(() => {
    const builtNodes: LayoutNode[] = [];
    const builtEdges: LayoutEdge[] = [];
    const byKey = new Map<string, LayoutNode>();
    let nextLeafRow = 0;

    function buildSubtree(
      tier: SwarmTierLevel,
      index: number,
      parentKey: string | null
    ): { nodeIdx: number; y: number } {
      const key = makeNodeKey(tier, index);
      const branchFactor = getChildBranchFactor(tier);
      const hasChildren = tier < 10;
      const isExpanded = hasChildren && expandedKeys.has(key);

      if (!isExpanded) {
        const y = nextLeafRow * ROW_SPACING;
        nextLeafRow += 1;
        const nodeIdx = builtNodes.length;
        const node: LayoutNode = {
          key,
          tier,
          index,
          parentKey,
          x: tier * COL_SPACING,
          y,
          hasChildren,
          isExpanded: false,
          branchFactor,
          childCount: 0,
        };
        builtNodes.push(node);
        byKey.set(key, node);
        return { nodeIdx, y };
      }

      const childResults: { nodeIdx: number; y: number }[] = [];
      for (let offset = 0; offset < branchFactor; offset++) {
        const childIdx = index * branchFactor + offset;
        childResults.push(buildSubtree((tier + 1) as SwarmTierLevel, childIdx, key));
      }

      const minY = childResults[0].y;
      const maxY = childResults[childResults.length - 1].y;
      const y = (minY + maxY) / 2;

      const nodeIdx = builtNodes.length;
      const x = tier * COL_SPACING;
      const node: LayoutNode = {
        key,
        tier,
        index,
        parentKey,
        x,
        y,
        hasChildren,
        isExpanded: true,
        branchFactor,
        childCount: childResults.length,
      };
      builtNodes.push(node);
      byKey.set(key, node);

      for (const child of childResults) {
        const childNode = builtNodes[child.nodeIdx];
        builtEdges.push({
          fromIdx: nodeIdx,
          toIdx: child.nodeIdx,
          fromX: x + NODE_W,
          fromY: y,
          toX: childNode.x,
          toY: childNode.y,
          tier: childNode.tier,
          fromKey: key,
          toKey: childNode.key,
        });
      }

      return { nodeIdx, y };
    }

    const root = buildSubtree(0, 0, null);
    const offsetY = -root.y;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const n of builtNodes) {
      n.y += offsetY;
      if (n.x < minX) minX = n.x;
      if (n.x + NODE_W + 28 > maxX) maxX = n.x + NODE_W + 28;
      if (n.y - NODE_H / 2 < minY) minY = n.y - NODE_H / 2;
      if (n.y + NODE_H / 2 > maxY) maxY = n.y + NODE_H / 2;
    }
    for (const e of builtEdges) {
      e.fromY += offsetY;
      e.toY += offsetY;
    }

    return {
      nodes: builtNodes,
      edges: builtEdges,
      bounds: { minX, maxX, minY, maxY },
      nodeByKey: byKey,
    };
  }, [expandedKeys]);

  const fitView = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;

    const contentW = Math.max(280, bounds.maxX - bounds.minX + 80);
    const contentH = Math.max(220, bounds.maxY - bounds.minY + 120);
    const scaleX = (rect.width - 72) / contentW;
    const scaleY = (rect.height - 108) / contentH;
    const scale = Math.max(0.28, Math.min(1.08, Math.min(scaleX, scaleY)));
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    cameraRef.current = {
      x: rect.width / 2 - centerX * scale,
      y: rect.height / 2 - centerY * scale + 14,
      scale,
    };
    setZoomPct(Math.round(scale * 100));
  }, [bounds]);

  // Fit on initial mount and whenever container resizes before user drags
  useEffect(() => {
    if (!hasFittedRef.current) {
      fitView();
      hasFittedRef.current = true;
    }
  }, [fitView]);

  // Pan cleanly to a requested node (e.g., when clicking Tier Jump or Breadcrumb)
  useEffect(() => {
    if (!focusRequest) return;
    const target = nodeByKey.get(focusRequest.key);
    const container = containerRef.current;
    if (!target || !container) return;

    const rect = container.getBoundingClientRect();
    const cam = cameraRef.current;
    const targetScale = Math.max(cam.scale, 0.78);
    cam.scale = targetScale;
    cam.x = rect.width / 2 - (target.x + NODE_W / 2) * targetScale;
    cam.y = rect.height / 2 - target.y * targetScale;
    setZoomPct(Math.round(targetScale * 100));
  }, [focusRequest, nodeByKey]);

  // Seed typed-array pulse packets
  useEffect(() => {
    const pool = pulsePoolRef.current;
    pool.fill(0);
    if (edges.length === 0) return;

    const isActiveWave =
      waveDirection !== 'idle' ||
      streamPhase === 'fanout_active' ||
      streamPhase === 'hedging_resolution' ||
      streamPhase === 'mapreduce_converging';

    const pulseCount = isActiveWave
      ? Math.min(MAX_PULSES, Math.max(28, edges.length * 2))
      : Math.min(48, edges.length);

    for (let i = 0; i < pulseCount; i++) {
      const base = i * STRIDE;
      const edgeIdx = i % edges.length;
      const edge = edges[edgeIdx];
      let pulseType = 0;
      if (waveDirection === 'bottom-up' || streamPhase === 'mapreduce_converging') {
        pulseType = 1;
      }
      if (
        hedgingEnabled &&
        stragglerBranchKey &&
        (edge.toKey === stragglerBranchKey || i % 7 === 0)
      ) {
        pulseType = 2;
      }

      pool[base] = edgeIdx;
      pool[base + 1] = (i * 0.173) % 1;
      pool[base + 2] = isActiveWave ? 0.0085 + (i % 5) * 0.0018 : 0.0032;
      pool[base + 3] = pulseType;
      pool[base + 4] = 1;
    }
  }, [edges, waveDirection, streamPhase, hedgingEnabled, stragglerBranchKey]);

  // Main 60fps Canvas render loop with frustum culling
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();

    const render = (now: number) => {
      const dt = Math.min(32, now - lastTime) / 16.6667;
      lastTime = now;

      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas && container) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
          canvas.width = Math.floor(w * dpr);
          canvas.height = Math.floor(h * dpr);
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.fillStyle = '#06080D';
          ctx.fillRect(0, 0, w, h);

          const cam = cameraRef.current;

          // Subtle technical dot grid aligned to camera
          const gridStep = 28 * cam.scale;
          if (gridStep >= 10) {
            const offsetX = ((cam.x % gridStep) + gridStep) % gridStep;
            const offsetY = ((cam.y % gridStep) + gridStep) % gridStep;
            ctx.fillStyle = '#131B29';
            for (let gx = offsetX; gx < w; gx += gridStep) {
              for (let gy = offsetY; gy < h; gy += gridStep) {
                ctx.fillRect(gx, gy, 1.25, 1.25);
              }
            }
          }

          ctx.save();
          ctx.translate(cam.x, cam.y);
          ctx.scale(cam.scale, cam.scale);

          const viewMinX = -cam.x / cam.scale - 240;
          const viewMaxX = (w - cam.x) / cam.scale + 240;
          const viewMinY = -cam.y / cam.scale - 140;
          const viewMaxY = (h - cam.y) / cam.scale + 140;

          // Tier column headers
          ctx.font = '600 10px "JetBrains Mono", monospace';
          ctx.textBaseline = 'top';
          for (let t = 0; t <= 10; t++) {
            const tx = t * COL_SPACING;
            if (tx + NODE_W < viewMinX || tx > viewMaxX) continue;
            const spec = SWARM_TIERS[t];
            ctx.fillStyle = t <= activeTierDepth ? '#38BDF8' : '#475569';
            ctx.fillText(`T${t} · ${spec.nodeCount.toLocaleString()}`, tx, bounds.minY - 34);
            ctx.strokeStyle = 'rgba(30, 41, 59, 0.32)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(tx - 12, bounds.minY - 16);
            ctx.lineTo(tx - 12, bounds.maxY + 24);
            ctx.stroke();
          }

          // Draw culled Bezier edges
          for (let i = 0; i < edges.length; i++) {
            const e = edges[i];
            if (
              e.toX < viewMinX ||
              e.fromX > viewMaxX ||
              Math.max(e.fromY, e.toY) < viewMinY ||
              Math.min(e.fromY, e.toY) > viewMaxY
            ) {
              continue;
            }
            const midX = (e.fromX + e.toX) * 0.5;
            const isStragglerEdge = stragglerBranchKey === e.toKey;
            const isLineageEdge = lineageKeys.has(e.fromKey) && lineageKeys.has(e.toKey);
            const isActiveTier = e.tier <= activeTierDepth;

            ctx.lineWidth = isLineageEdge ? 2.0 : 1.25;
            if (isStragglerEdge && !hedgingEnabled) {
              ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
            } else if (isStragglerEdge && hedgingEnabled) {
              ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
            } else if (isLineageEdge) {
              ctx.strokeStyle = 'rgba(34, 211, 238, 0.78)';
            } else if (waveDirection === 'bottom-up' || streamPhase === 'mapreduce_converging') {
              ctx.strokeStyle = isActiveTier ? 'rgba(16, 185, 129, 0.4)' : '#1B2434';
            } else {
              ctx.strokeStyle = isActiveTier ? 'rgba(6, 182, 212, 0.36)' : '#1B2434';
            }

            ctx.beginPath();
            ctx.moveTo(e.fromX, e.fromY);
            ctx.bezierCurveTo(midX, e.fromY, midX, e.toY, e.toX, e.toY);
            ctx.stroke();
          }

          // Update and draw zero-allocation pulse pool
          const pool = pulsePoolRef.current;
          const reverseDir = waveDirection === 'bottom-up' || streamPhase === 'mapreduce_converging';
          for (let i = 0; i < MAX_PULSES; i++) {
            const base = i * STRIDE;
            if (pool[base + 4] === 0) continue;
            const edgeIdx = pool[base] | 0;
            if (edgeIdx >= edges.length) continue;
            const e = edges[edgeIdx];

            let p = pool[base + 1] + pool[base + 2] * dt;
            if (p >= 1) p -= 1;
            pool[base + 1] = p;

            if (
              e.toX < viewMinX ||
              e.fromX > viewMaxX ||
              Math.max(e.fromY, e.toY) < viewMinY ||
              Math.min(e.fromY, e.toY) > viewMaxY
            ) {
              continue;
            }

            const t = reverseDir ? 1 - p : p;
            const inv = 1 - t;
            const midX = (e.fromX + e.toX) * 0.5;
            const px =
              inv * inv * inv * e.fromX +
              3 * inv * inv * t * midX +
              3 * inv * t * t * midX +
              t * t * t * e.toX;
            const py =
              inv * inv * inv * e.fromY +
              3 * inv * inv * t * e.fromY +
              3 * inv * t * t * e.toY +
              t * t * t * e.toY;

            const pulseType = pool[base + 3];
            ctx.fillStyle =
              pulseType === 2 ? '#F59E0B' : pulseType === 1 ? '#10B981' : '#22D3EE';
            ctx.beginPath();
            ctx.arc(px, py, pulseType === 2 ? 3.2 : 2.5, 0, Math.PI * 2);
            ctx.fill();
          }

          // Draw culled nodes
          for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i];
            if (
              n.x + NODE_W + 28 < viewMinX ||
              n.x > viewMaxX ||
              n.y + NODE_H < viewMinY ||
              n.y - NODE_H > viewMaxY
            ) {
              continue;
            }

            const top = n.y - NODE_H / 2;
            const isSelected = n.key === selectedNodeKey;
            const isLineage = lineageKeys.has(n.key);
            const isStraggler = n.key === stragglerBranchKey;
            const isActive = n.tier <= activeTierDepth;

            ctx.fillStyle = isSelected ? '#132438' : isLineage ? '#0E1929' : '#0D121B';
            ctx.beginPath();
            ctx.roundRect(n.x, top, NODE_W, NODE_H, 6);
            ctx.fill();

            if (isStraggler) {
              ctx.strokeStyle = hedgingEnabled ? '#F59E0B' : '#EF4444';
              ctx.lineWidth = 1.6;
            } else if (isSelected) {
              ctx.strokeStyle = '#22D3EE';
              ctx.lineWidth = 1.75;
            } else if (isLineage) {
              ctx.strokeStyle = '#0891B2';
              ctx.lineWidth = 1.25;
            } else if (isActive) {
              ctx.strokeStyle = n.tier === 0 ? '#22D3EE' : '#243146';
              ctx.lineWidth = 1;
            } else {
              ctx.strokeStyle = '#192231';
              ctx.lineWidth = 1;
            }
            ctx.stroke();

            // Model tier square marker
            ctx.fillStyle =
              n.tier === 0 ? '#06B6D4' : n.tier <= 4 ? '#38BDF8' : '#10B981';
            ctx.fillRect(n.x + 8, top + 10, 4, 4);

            // Agent ID
            ctx.fillStyle = isSelected ? '#F8FAFC' : '#E2E8F0';
            ctx.font = '600 10.5px "JetBrains Mono", monospace';
            ctx.textBaseline = 'middle';
            ctx.fillText(formatAgentId(n.tier, n.index), n.x + 17, n.y - 6);

            // Domain-specific label for T0-T2, role label for T3-T10
            ctx.fillStyle = '#94A3B8';
            ctx.font = '400 9.5px "DM Sans", sans-serif';
            let subLabel = SWARM_TIERS[n.tier].role;
            if (n.tier === 0) {
              subLabel = 'Mother AI · Gemini';
            } else if (n.tier === 1) {
              subLabel = mission.tier1Directors[n.index]?.domainName ?? subLabel;
            } else if (n.tier === 2) {
              const dIdx = Math.floor(n.index / 2);
              const lIdx = n.index % 2;
              subLabel = mission.tier1Directors[dIdx]?.tier2Leads[lIdx]?.sectorName ?? subLabel;
            } else if (n.tier === 10) {
              subLabel = 'Leaf Worker';
            }
            if (subLabel.length > 20) {
              subLabel = `${subLabel.slice(0, 19)}…`;
            }
            ctx.fillText(subLabel, n.x + 17, n.y + 7);

            // Expansion handle (+2 / +4 / −)
            if (n.hasChildren) {
              const hx = n.x + NODE_W + 2;
              const hy = n.y;
              ctx.fillStyle = n.isExpanded ? '#162031' : '#0F1B29';
              ctx.strokeStyle = n.isExpanded ? '#334155' : '#0891B2';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.roundRect(hx, hy - 9, 24, 18, 4);
              ctx.fill();
              ctx.stroke();

              ctx.fillStyle = n.isExpanded ? '#94A3B8' : '#22D3EE';
              ctx.font = '600 9.5px "JetBrains Mono", monospace';
              ctx.textAlign = 'center';
              ctx.fillText(n.isExpanded ? '−' : `+${n.branchFactor}`, hx + 12, hy + 0.5);
              ctx.textAlign = 'left';
            }
          }

          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [
    mission,
    nodes,
    edges,
    bounds,
    selectedNodeKey,
    lineageKeys,
    stragglerBranchKey,
    hedgingEnabled,
    waveDirection,
    streamPhase,
    activeTierDepth,
  ]);

  const hitTest = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const cam = cameraRef.current;
      const wx = (clientX - rect.left - cam.x) / cam.scale;
      const wy = (clientY - rect.top - cam.y) / cam.scale;

      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        const top = n.y - NODE_H / 2;
        if (n.hasChildren) {
          const hx = n.x + NODE_W + 2;
          if (wx >= hx - 2 && wx <= hx + 26 && wy >= n.y - 11 && wy <= n.y + 11) {
            return { type: 'expand' as const, node: n };
          }
        }
        if (wx >= n.x && wx <= n.x + NODE_W && wy >= top && wy <= top + NODE_H) {
          return { type: 'node' as const, node: n };
        }
      }
      return null;
    },
    [nodes]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = {
      dragging: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      camX: cameraRef.current.x,
      camY: cameraRef.current.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current.dragging) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragRef.current.moved = true;
      }
      cameraRef.current.x = dragRef.current.camX + dx;
      cameraRef.current.y = dragRef.current.camY + dy;
      setHoverInfo(null);
      return;
    }

    const hit = hitTest(e.clientX, e.clientY);
    if (hit) {
      const rect = e.currentTarget.getBoundingClientRect();
      setHoverInfo({
        node: hit.node,
        screenX: e.clientX - rect.left,
        screenY: e.clientY - rect.top,
      });
    } else {
      setHoverInfo(null);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const wasMoved = dragRef.current.moved;
    dragRef.current.dragging = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (wasMoved) return;

    const hit = hitTest(e.clientX, e.clientY);
    if (!hit) return;

    if (hit.type === 'expand') {
      onToggleExpand(hit.node.key);
    } else {
      onSelectNode(hit.node.key);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const hit = hitTest(e.clientX, e.clientY);
    if (hit && hit.node.hasChildren) {
      onToggleExpand(hit.node.key);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cam = cameraRef.current;
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    const nextScale = Math.max(0.2, Math.min(2.2, cam.scale * factor));
    const ratio = nextScale / cam.scale;

    cam.x = mx - (mx - cam.x) * ratio;
    cam.y = my - (my - cam.y) * ratio;
    cam.scale = nextScale;
    setZoomPct(Math.round(nextScale * 100));
  };

  const adjustZoom = (delta: number) => {
    const container = containerRef.current;
    if (!container) return;
    const cx = container.clientWidth / 2;
    const cy = container.clientHeight / 2;
    const cam = cameraRef.current;
    const nextScale = Math.max(0.2, Math.min(2.2, cam.scale + delta));
    const ratio = nextScale / cam.scale;
    cam.x = cx - (cx - cam.x) * ratio;
    cam.y = cy - (cy - cam.y) * ratio;
    cam.scale = nextScale;
    setZoomPct(Math.round(nextScale * 100));
  };

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-[#06080D]">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        className={`block h-full w-full ${
          hoverInfo ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
        }`}
      />

      {/* Top-Left Compact Model Legend & Count (Non-overlapping with tree since docked rail handles controls) */}
      <div className="pointer-events-none absolute left-4 top-3 z-10 hidden sm:flex items-center gap-4 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 bg-[#06B6D4]" />
          T0 Gemini Free
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 bg-[#38BDF8]" />
          T1–T4 Qwen 3 (8B)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 bg-[#10B981]" />
          T5–T10 Gemma 4 E2B
        </span>
        <span aria-hidden="true">·</span>
        <span>
          <strong className="font-mono text-slate-200 tabular-nums">{nodes.length}</strong> visible
          / <strong className="font-mono text-cyan-400 tabular-nums">349,527</strong> total
        </span>
      </div>

      {/* Top-Right Compact Viewport Controls */}
      <div className="pointer-events-auto absolute right-4 top-3 z-10 flex items-center gap-1 rounded-lg border border-[#1C2638] bg-[#0D121B]/95 p-1">
        <button
          type="button"
          onClick={onExpandTraceToTier10}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-cyan-300 transition-colors hover:bg-slate-800/80 whitespace-nowrap shrink-0"
          title="Expand one continuous trace path all the way to Tier 10 workers"
        >
          <Plus className="h-3.5 w-3.5" />
          Trace to T10
        </button>
        <button
          type="button"
          onClick={onResetExpansion}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800/80 whitespace-nowrap shrink-0"
          title="Collapse back to Tiers 0-3"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset T0–T3
        </button>
        <div className="mx-0.5 h-4 w-px bg-[#1C2638]" />
        <button
          type="button"
          onClick={() => adjustZoom(-0.15)}
          aria-label="Zoom out"
          className="rounded-md p-1.5 text-slate-300 transition-colors hover:bg-slate-800/80"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-[40px] text-center font-mono text-xs text-slate-400 tabular-nums">
          {zoomPct}%
        </span>
        <button
          type="button"
          onClick={() => adjustZoom(0.15)}
          aria-label="Zoom in"
          className="rounded-md p-1.5 text-slate-300 transition-colors hover:bg-slate-800/80"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={fitView}
          aria-label="Fit tree to screen"
          className="rounded-md p-1.5 text-slate-300 transition-colors hover:bg-slate-800/80"
          title="Fit tree to viewport"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Hover Tooltip HUD */}
      {hoverInfo && (
        <div
          className="pointer-events-none absolute z-20 max-w-[270px] rounded-lg border border-[#243247] bg-[#0D121B]/95 px-3 py-2 text-xs shadow-lg"
          style={{
            left: Math.min(hoverInfo.screenX + 14, (containerRef.current?.clientWidth ?? 900) - 280),
            top: Math.max(44, hoverInfo.screenY - 62),
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono font-semibold text-cyan-300">
              {formatAgentId(hoverInfo.node.tier, hoverInfo.node.index)}
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              Tier {hoverInfo.node.tier}
            </span>
          </div>
          <p className="mt-0.5 font-medium text-slate-200">
            {SWARM_TIERS[hoverInfo.node.tier].role}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-slate-400 tabular-nums">
            Span: {getLeafWorkerSpan(hoverInfo.node.tier, hoverInfo.node.index)}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Click node to inspect · Click{' '}
            <span className="font-mono text-cyan-300">
              {hoverInfo.node.isExpanded ? '−' : `+${hoverInfo.node.branchFactor}`}
            </span>{' '}
            to {hoverInfo.node.isExpanded ? 'collapse' : 'expand'}
          </p>
        </div>
      )}
    </div>
  );
};
