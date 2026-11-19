import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eraser, PaintBucket, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import type { DrawStrokeDoc, DrawTool } from '../types/drawGuess';
import type { Language } from '../types/game';
import { t } from '../data/i18n';

export const CANVAS_WIDTH = 1000;
export const CANVAS_HEIGHT = 625;

export const STUDIO_COLORS = [
  '#111827', // ink charcoal
  '#64748B', // slate
  '#FFFFFF', // white
  '#EF4444', // crimson
  '#F97316', // coral orange
  '#F59E0B', // sunflower
  '#FACC15', // bright yellow
  '#22C55E', // grass green
  '#10B981', // emerald
  '#06B6D4', // cyan
  '#3B82F6', // royal blue
  '#6366F1', // indigo
  '#EC4899', // magenta
  '#92400E', // warm brown
];

const BRUSH_SIZES = [
  { size: 4, label: 'S' },
  { size: 9, label: 'M' },
  { size: 17, label: 'L' },
  { size: 28, label: 'XL' },
];

interface DrawCanvasProps {
  lang: Language;
  canDraw: boolean;
  turnKey: string;
  canvasVersion: number;
  drawerUid: string;
  recipientIds: string[];
  strokes: DrawStrokeDoc[];
  onCreateStroke: (stroke: Omit<DrawStrokeDoc, 'createdAt'>) => Promise<void>;
  onUpdateStrokePoints: (strokeId: string, points: number[]) => Promise<void>;
  onUndoStroke: (strokeId: string) => Promise<void>;
  onClearCanvas: () => Promise<void>;
}

function hexToRgba(hex: string): [number, number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0');
  const num = parseInt(full.slice(0, 6), 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255, 255];
}

function floodFillCanvas(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillHex: string
) {
  const sx = Math.max(0, Math.min(CANVAS_WIDTH - 1, Math.round(startX)));
  const sy = Math.max(0, Math.min(CANVAS_HEIGHT - 1, Math.round(startY)));

  const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  const data = imageData.data;
  const startIdx = (sy * CANVAS_WIDTH + sx) * 4;

  const targetR = data[startIdx];
  const targetG = data[startIdx + 1];
  const targetB = data[startIdx + 2];
  const targetA = data[startIdx + 3];

  const [fillR, fillG, fillB, fillA] = hexToRgba(fillHex);

  if (
    Math.abs(targetR - fillR) <= 4 &&
    Math.abs(targetG - fillG) <= 4 &&
    Math.abs(targetB - fillB) <= 4 &&
    Math.abs(targetA - fillA) <= 4
  ) {
    return;
  }

  const tolerance = 38;
  const visited = new Uint8Array(CANVAS_WIDTH * CANVAS_HEIGHT);
  const stack: number[] = [sx, sy];

  const matchesTarget = (pixelOffset: number) =>
    Math.abs(data[pixelOffset] - targetR) <= tolerance &&
    Math.abs(data[pixelOffset + 1] - targetG) <= tolerance &&
    Math.abs(data[pixelOffset + 2] - targetB) <= tolerance &&
    Math.abs(data[pixelOffset + 3] - targetA) <= tolerance;

  while (stack.length > 0) {
    const cy = stack.pop()!;
    let cx = stack.pop()!;

    while (cx >= 0 && !visited[cy * CANVAS_WIDTH + cx] && matchesTarget((cy * CANVAS_WIDTH + cx) * 4)) {
      cx--;
    }
    cx++;

    let spanAbove = false;
    let spanBelow = false;

    while (cx < CANVAS_WIDTH) {
      const linear = cy * CANVAS_WIDTH + cx;
      const offset = linear * 4;
      if (visited[linear] || !matchesTarget(offset)) break;

      visited[linear] = 1;
      data[offset] = fillR;
      data[offset + 1] = fillG;
      data[offset + 2] = fillB;
      data[offset + 3] = fillA;

      if (cy > 0) {
        const upLinear = (cy - 1) * CANVAS_WIDTH + cx;
        const upMatches = !visited[upLinear] && matchesTarget(upLinear * 4);
        if (!spanAbove && upMatches) {
          stack.push(cx, cy - 1);
          spanAbove = true;
        } else if (spanAbove && !upMatches) {
          spanAbove = false;
        }
      }

      if (cy < CANVAS_HEIGHT - 1) {
        const downLinear = (cy + 1) * CANVAS_WIDTH + cx;
        const downMatches = !visited[downLinear] && matchesTarget(downLinear * 4);
        if (!spanBelow && downMatches) {
          stack.push(cx, cy + 1);
          spanBelow = true;
        } else if (spanBelow && !downMatches) {
          spanBelow = false;
        }
      }
      cx++;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function renderSingleStroke(ctx: CanvasRenderingContext2D, stroke: Pick<DrawStrokeDoc, 'tool' | 'color' | 'size' | 'points'>) {
  const pts = stroke.points;
  if (!pts || pts.length < 2) return;

  if (stroke.tool === 'fill') {
    floodFillCanvas(ctx, pts[0], pts[1], stroke.color);
    return;
  }

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke.tool === 'eraser' ? '#FFFFFF' : stroke.color;
  ctx.fillStyle = stroke.tool === 'eraser' ? '#FFFFFF' : stroke.color;
  ctx.lineWidth = stroke.tool === 'eraser' ? Math.max(14, stroke.size * 1.6) : stroke.size;

  if (pts.length === 2) {
    ctx.beginPath();
    ctx.arc(pts[0], pts[1], ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);

  if (pts.length === 4) {
    ctx.lineTo(pts[2], pts[3]);
  } else {
    for (let i = 2; i < pts.length - 2; i += 2) {
      const midX = (pts[i] + pts[i + 2]) / 2;
      const midY = (pts[i + 1] + pts[i + 3]) / 2;
      ctx.quadraticCurveTo(pts[i], pts[i + 1], midX, midY);
    }
    ctx.lineTo(pts[pts.length - 2], pts[pts.length - 1]);
  }
  ctx.stroke();
  ctx.restore();
}

export const DrawCanvas: React.FC<DrawCanvasProps> = ({
  lang,
  canDraw,
  turnKey,
  canvasVersion,
  drawerUid,
  recipientIds,
  strokes,
  onCreateStroke,
  onUpdateStrokePoints,
  onUndoStroke,
  onClearCanvas,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<DrawTool>('pen');
  const [color, setColor] = useState<string>(STUDIO_COLORS[0]);
  const [brushSize, setBrushSize] = useState<number>(BRUSH_SIZES[1].size);

  const activeStrokeRef = useRef<Omit<DrawStrokeDoc, 'createdAt'> | null>(null);
  const createdRemoteRef = useRef<boolean>(false);
  const lastFlushAtRef = useRef<number>(0);
  const flushTimerRef = useRef<number | null>(null);
  const seqCounterRef = useRef<number>(1);
  const [localDraftVersion, setLocalDraftVersion] = useState(0);

  // Filter strokes for this active turn & canvasVersion
  const activeStrokes = useMemo(
    () =>
      strokes.filter(
        (s) => s.turnKey === turnKey && s.canvasVersion === canvasVersion
      ),
    [strokes, turnKey, canvasVersion]
  );

  // Keep sequence counter ahead of synced strokes
  useEffect(() => {
    const maxSeq = activeStrokes.reduce((acc, s) => Math.max(acc, s.seq), 0);
    if (maxSeq >= seqCounterRef.current) {
      seqCounterRef.current = maxSeq + 1;
    }
  }, [activeStrokes]);

  // Reset active stroke if turn or canvasVersion changes
  useEffect(() => {
    activeStrokeRef.current = null;
    createdRemoteRef.current = false;
    if (flushTimerRef.current !== null) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, [turnKey, canvasVersion]);

  // Redraw full canvas whenever synced strokes or local draft updates
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const draft = activeStrokeRef.current;
    for (const s of activeStrokes) {
      if (draft && s.id === draft.id) continue;
      renderSingleStroke(ctx, s);
    }
    if (draft) {
      renderSingleStroke(ctx, draft);
    }
  }, [activeStrokes, localDraftVersion, turnKey, canvasVersion]);

  const getLogicalPoint = useCallback((e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / Math.max(1, rect.width);
    const scaleY = CANVAS_HEIGHT / Math.max(1, rect.height);
    const x = Math.round(Math.max(0, Math.min(CANVAS_WIDTH, (e.clientX - rect.left) * scaleX)));
    const y = Math.round(Math.max(0, Math.min(CANVAS_HEIGHT, (e.clientY - rect.top) * scaleY)));
    return [x, y];
  }, []);

  const flushActiveStroke = useCallback(
    async (isFinal: boolean) => {
      const draft = activeStrokeRef.current;
      if (!draft) return;

      lastFlushAtRef.current = Date.now();
      const snapshotPoints = [...draft.points];
      const strokeId = draft.id;

      try {
        if (!createdRemoteRef.current) {
          createdRemoteRef.current = true;
          await onCreateStroke({ ...draft, points: snapshotPoints });
        } else {
          await onUpdateStrokePoints(strokeId, snapshotPoints);
        }
      } catch {
        // Non-fatal sync error; next flush or final commit retries
      }

      if (isFinal && activeStrokeRef.current?.id === strokeId) {
        activeStrokeRef.current = null;
        createdRemoteRef.current = false;
        setLocalDraftVersion((v) => v + 1);
      }
    },
    [onCreateStroke, onUpdateStrokePoints]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    e.preventDefault();
    const [x, y] = getLogicalPoint(e);

    if (tool === 'fill') {
      const seq = seqCounterRef.current++;
      const fillStroke: Omit<DrawStrokeDoc, 'createdAt'> = {
        id: `st_${Date.now()}_${seq}`,
        turnKey,
        canvasVersion,
        drawerUid,
        seq,
        tool: 'fill',
        color,
        size: brushSize,
        points: [x, y],
        recipientIds: recipientIds.length > 0 ? recipientIds : [drawerUid],
      };
      // Paint optimistically right away
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        renderSingleStroke(ctx, fillStroke);
      }
      void onCreateStroke(fillStroke);
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    const seq = seqCounterRef.current++;
    activeStrokeRef.current = {
      id: `st_${Date.now()}_${seq}`,
      turnKey,
      canvasVersion,
      drawerUid,
      seq,
      tool,
      color,
      size: brushSize,
      points: [x, y],
      recipientIds: recipientIds.length > 0 ? recipientIds : [drawerUid],
    };
    createdRemoteRef.current = false;
    lastFlushAtRef.current = Date.now();
    setLocalDraftVersion((v) => v + 1);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const draft = activeStrokeRef.current;
    if (!canDraw || !draft) return;

    e.preventDefault();
    const [x, y] = getLogicalPoint(e);
    const pts = draft.points;
    const prevX = pts[pts.length - 2];
    const prevY = pts[pts.length - 1];
    const distSq = (x - prevX) * (x - prevX) + (y - prevY) * (y - prevY);

    // Keep stroke data compact while staying visually silky-smooth
    if (distSq < 16) return;

    if (pts.length < 1598) {
      pts.push(x, y);
      setLocalDraftVersion((v) => v + 1);
    }

    const now = Date.now();
    if (now - lastFlushAtRef.current >= 200) {
      void flushActiveStroke(false);
    } else if (flushTimerRef.current === null) {
      flushTimerRef.current = window.setTimeout(() => {
        flushTimerRef.current = null;
        if (activeStrokeRef.current) {
          void flushActiveStroke(false);
        }
      }, 220);
    }
  };

  const finishPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activeStrokeRef.current) return;
    e.preventDefault();
    if (flushTimerRef.current !== null) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    void flushActiveStroke(true);
  };

  const handleUndo = () => {
    if (!canDraw || activeStrokes.length === 0) return;
    const latest = activeStrokes[activeStrokes.length - 1];
    void onUndoStroke(latest.id);
  };

  return (
    <div className="space-y-3">
      {/* Crisp 16:10 Drawing Board */}
      <div className="relative rounded-2xl overflow-hidden bg-white border-2 border-slate-700/80 shadow-xl">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointer}
          onPointerCancel={finishPointer}
          className={`w-full aspect-[16/10] block select-none ${
            canDraw
              ? tool === 'fill'
                ? 'cursor-cell'
                : 'cursor-crosshair'
              : 'cursor-default'
          }`}
          style={{ touchAction: canDraw ? 'none' : 'auto' }}
        />
      </div>

      {/* Tactile Drawer Toolbar */}
      {canDraw && (
        <div className="bg-[#151C2C] border border-slate-800 rounded-2xl p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Tools */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTool('pen')}
                className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  tool === 'pen'
                    ? 'bg-indigo-500 text-white shadow-sm'
                    : 'bg-[#0B0F17] text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>{t(lang, 'dgPen')}</span>
              </button>
              <button
                type="button"
                onClick={() => setTool('fill')}
                className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  tool === 'fill'
                    ? 'bg-indigo-500 text-white shadow-sm'
                    : 'bg-[#0B0F17] text-slate-300 hover:bg-slate-800'
                }`}
              >
                <PaintBucket className="w-3.5 h-3.5" />
                <span>{t(lang, 'dgFill')}</span>
              </button>
              <button
                type="button"
                onClick={() => setTool('eraser')}
                className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  tool === 'eraser'
                    ? 'bg-indigo-500 text-white shadow-sm'
                    : 'bg-[#0B0F17] text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>{t(lang, 'dgEraser')}</span>
              </button>
            </div>

            {/* Brush Sizes */}
            <div className="flex items-center gap-1.5 bg-[#0B0F17] p-1 rounded-xl border border-slate-800">
              {BRUSH_SIZES.map((b) => (
                <button
                  key={b.size}
                  type="button"
                  onClick={() => {
                    setBrushSize(b.size);
                    if (tool === 'fill') setTool('pen');
                  }}
                  aria-label={`Brush size ${b.label}`}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    brushSize === b.size
                      ? 'bg-slate-700 ring-1 ring-indigo-400'
                      : 'hover:bg-slate-800/80'
                  }`}
                >
                  <span
                    className="rounded-full bg-white block"
                    style={{
                      width: `${Math.min(20, Math.max(5, Math.round(b.size * 0.72)))}px`,
                      height: `${Math.min(20, Math.max(5, Math.round(b.size * 0.72)))}px`,
                    }}
                  />
                </button>
              ))}
            </div>

            {/* Undo & Clear */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleUndo}
                disabled={activeStrokes.length === 0}
                className="min-h-[40px] px-3 rounded-xl bg-[#0B0F17] hover:bg-slate-800 disabled:opacity-40 text-slate-200 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t(lang, 'dgUndo')}</span>
              </button>
              <button
                type="button"
                onClick={() => void onClearCanvas()}
                className="min-h-[40px] px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-200 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t(lang, 'dgClear')}</span>
              </button>
            </div>
          </div>

          {/* 14-Color Studio Swatch Palette */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {STUDIO_COLORS.map((swatch) => {
              const active = color === swatch && tool !== 'eraser';
              return (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => {
                    setColor(swatch);
                    if (tool === 'eraser') setTool('pen');
                  }}
                  aria-label={`Color ${swatch}`}
                  className={`min-w-[34px] min-h-[34px] rounded-xl shrink-0 border transition-transform active:scale-95 ${
                    active
                      ? 'ring-2 ring-white border-white scale-105'
                      : swatch === '#FFFFFF'
                        ? 'border-slate-500 opacity-90 hover:opacity-100'
                        : 'border-white/15 opacity-85 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: swatch }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
