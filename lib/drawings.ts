import type {
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  SeriesAttachedParameter,
  Time,
  Logical,
  ITimeScaleApi,
} from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";

export type DrawingTool =
  | "level"
  | "trend"
  | "rect"
  | "ruler"
  | "ray"
  | "hray"
  | "arrow"
  | "fib"
  | "channel"
  | "long"
  | "short";

export type LineStylePattern = "solid" | "dashed" | "dotted";

export interface Drawing {
  id: string;
  tool: DrawingTool;
  time1: number;
  price1: number;
  time2: number;
  price2: number;
  color: string;
  lineWidth?: number; // 1, 2, 3 (default 1.5)
  lineStyle?: LineStylePattern; // default "solid"
  locked?: boolean;
  /** Optional custom stop-loss price for long/short position boxes (defaults to 1:2 R:R if omitted). */
  stopPrice?: number;
  /** Optional badge/strategy label for plotted setups. */
  label?: string;
}

export interface PersistedDrawingsData {
  version: number;
  symbols: Record<string, Drawing[]>;
}

export function parsePersistedDrawings(raw: string): Record<string, Drawing[]> {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    if (typeof parsed.version === "number" && parsed.symbols && typeof parsed.symbols === "object") {
      return parsed.symbols;
    }
    // Legacy format: raw dictionary of symbol -> Drawing[]
    return parsed;
  } catch {
    return {};
  }
}

export interface DrawingsStyle {
  /** Chip background for price labels and badges. */
  labelBg: string;
}

/** A point in chart (pane) CSS pixels. */
export interface Point {
  x: number;
  y: number;
}

export interface DrawingGeometry {
  kind:
    | "level"
    | "segment"
    | "rect"
    | "ray"
    | "hray"
    | "arrow"
    | "fib"
    | "channel"
    | "position";
  /** Defining points in pane CSS pixels. */
  points: [Point, Point];
  /** Optional secondary anchor (e.g. guide point for ray). */
  guide?: Point;
}

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
/** Click tolerance, and the gap between a drawing's end and its delete button. */
const HIT_TOLERANCE = 6;
const HANDLE_INSET = 14;

export const FIB_RATIOS = [
  { ratio: 0.0, color: "#9ca3af" },
  { ratio: 0.236, color: "#60a5fa" },
  { ratio: 0.382, color: "#34d399" },
  { ratio: 0.5, color: "#eab308" },
  { ratio: 0.618, color: "#f59e0b" },
  { ratio: 0.786, color: "#f87171" },
  { ratio: 1.0, color: "#9ca3af" },
];

/** Converts a timestamp to an X-coordinate in CSS pixels, extrapolating into whitespace/future bars if needed. */
export function timeToCoordinateExtrapolated(
  time: number,
  timeScale: ITimeScaleApi<Time>,
  candles?: { time: number }[]
): number | null {
  const direct = timeScale.timeToCoordinate(time as Time);
  if (direct !== null) return direct;

  if (!candles || candles.length === 0) return null;
  const lastCandle = candles[candles.length - 1];
  const step =
    candles.length >= 2
      ? Math.max(1, lastCandle.time - candles[candles.length - 2].time)
      : 60;
  const lastIdx = candles.length - 1;
  const targetLogical = lastIdx + (time - lastCandle.time) / step;

  // 1. Try native logicalToCoordinate
  const directLogicalCoord = timeScale.logicalToCoordinate(
    targetLogical as Logical
  );
  if (directLogicalCoord !== null) return directLogicalCoord;

  // 2. If logical index is outside visible viewport, extrapolate from visible logical range
  const range = timeScale.getVisibleLogicalRange();
  if (!range) return null;
  const fromX = timeScale.logicalToCoordinate(range.from as Logical);
  const toX = timeScale.logicalToCoordinate(range.to as Logical);
  if (fromX === null || toX === null || range.to === range.from) return null;
  const pxPerBar = (toX - fromX) / (range.to - range.from);
  return fromX + (targetLogical - range.from) * pxPerBar;
}

/** Pixel geometry for a drawing, or null when it falls outside the pane. */
export function drawingGeometry(
  d: Drawing,
  chart: IChartApi,
  series: ISeriesApi<"Candlestick">,
  candles?: { time: number; close?: number }[]
): DrawingGeometry | null {
  try {
    // Guard against cross-symbol price mismatch (e.g. a $85,000 BTC setup on a $2,700 Gold chart)
    if (candles && candles.length > 0) {
      const refClose = candles[candles.length - 1]?.close;
      if (typeof refClose === "number" && refClose > 0 && d.price1 > 0) {
        const ratio = d.price1 / refClose;
        if (ratio > 4 || ratio < 0.25) return null;
      }
    }

    const timeScale = chart.timeScale();
    const w = timeScale.width();

    if (d.tool === "level") {
      const y = series.priceToCoordinate(d.price1);
      if (y === null) return null;
      return { kind: "level", points: [{ x: 0, y }, { x: w, y }] };
    }

    const x1 = timeToCoordinateExtrapolated(d.time1, timeScale, candles);
    const y1 = series.priceToCoordinate(d.price1);
    if (x1 === null || y1 === null) return null;

    if (d.tool === "hray") {
      return {
        kind: "hray",
        points: [{ x: x1, y: y1 }, { x: Math.max(x1, w), y: y1 }],
      };
    }

    const x2 = timeToCoordinateExtrapolated(d.time2, timeScale, candles);
    const y2 = series.priceToCoordinate(d.price2);
    if (x2 === null || y2 === null) return null;

    if (d.tool === "ray") {
      if (Math.abs(x2 - x1) < 0.001) {
        const endY = y2 >= y1 ? 10000 : -10000;
        return {
          kind: "ray",
          points: [{ x: x1, y: y1 }, { x: x1, y: endY }],
          guide: { x: x2, y: y2 },
        };
      }
      const t = x2 > x1 ? (w - x1) / (x2 - x1) : (0 - x1) / (x2 - x1);
      const endX = x2 > x1 ? w : 0;
      const endY = y1 + t * (y2 - y1);
      return {
        kind: "ray",
        points: [{ x: x1, y: y1 }, { x: endX, y: endY }],
        guide: { x: x2, y: y2 },
      };
    }

    if (d.tool === "trend") {
      return { kind: "segment", points: [{ x: x1, y: y1 }, { x: x2, y: y2 }] };
    }

    if (d.tool === "arrow") {
      return { kind: "arrow", points: [{ x: x1, y: y1 }, { x: x2, y: y2 }] };
    }

    if (d.tool === "fib") {
      return { kind: "fib", points: [{ x: x1, y: y1 }, { x: x2, y: y2 }] };
    }

    if (d.tool === "channel") {
      return { kind: "channel", points: [{ x: x1, y: y1 }, { x: x2, y: y2 }] };
    }

    if (d.tool === "long" || d.tool === "short") {
      return { kind: "position", points: [{ x: x1, y: y1 }, { x: x2, y: y2 }] };
    }

    return {
      kind: "rect",
      points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
    };
  } catch {
    return null;
  }
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** True when a point is on / near a drawing. */
export function hitTestDrawing(
  d: Drawing,
  p: Point,
  chart: IChartApi,
  series: ISeriesApi<"Candlestick">,
  tolerance = HIT_TOLERANCE,
  candles?: { time: number }[]
): boolean {
  const g = drawingGeometry(d, chart, series, candles);
  if (!g) return false;

  if (g.kind === "level") return Math.abs(p.y - g.points[0].y) <= tolerance;

  if (g.kind === "hray") {
    const minX = Math.min(g.points[0].x, g.points[1].x) - tolerance;
    const maxX = Math.max(g.points[0].x, g.points[1].x) + tolerance;
    return p.x >= minX && p.x <= maxX && Math.abs(p.y - g.points[0].y) <= tolerance;
  }

  const [a, b] = g.points;

  if (g.kind === "segment" || g.kind === "ray" || g.kind === "arrow") {
    return distanceToSegment(p, a, b) <= tolerance;
  }

  if (g.kind === "fib") {
    if (distanceToSegment(p, a, b) <= tolerance) return true;
    const minX = Math.min(a.x, b.x) - tolerance;
    const maxX = Math.max(a.x, b.x) + 70 + tolerance;
    if (p.x >= minX && p.x <= maxX) {
      for (const lvl of FIB_RATIOS) {
        const fibY = a.y + (b.y - a.y) * lvl.ratio;
        if (Math.abs(p.y - fibY) <= tolerance) return true;
      }
    }
    return false;
  }

  if (g.kind === "channel") {
    if (distanceToSegment(p, a, b) <= tolerance) return true;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return false;
    const nx = -dy / len;
    const ny = dx / len;
    const h = Math.max(16, Math.abs(b.y - a.y) * 0.4);
    const pA1 = { x: a.x + nx * h, y: a.y + ny * h };
    const pB1 = { x: b.x + nx * h, y: b.y + ny * h };
    const pA2 = { x: a.x - nx * h, y: a.y - ny * h };
    const pB2 = { x: b.x - nx * h, y: b.y - ny * h };
    if (distanceToSegment(p, pA1, pB1) <= tolerance) return true;
    if (distanceToSegment(p, pA2, pB2) <= tolerance) return true;
    const dotL = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (len * len);
    const dotW = Math.abs((p.x - a.x) * nx + (p.y - a.y) * ny);
    return dotL >= -0.05 && dotL <= 1.05 && dotW <= h + tolerance;
  }

  if (g.kind === "position") {
    const isLong = d.tool === "long";
    const entryY = a.y;
    const tpY = b.y;
    const slDist = Math.abs(tpY - entryY) / 2;
    const customSlY =
      typeof d.stopPrice === "number" ? series.priceToCoordinate(d.stopPrice) : null;
    const slY = customSlY ?? (isLong ? entryY + slDist : entryY - slDist);
    const minY = Math.min(entryY, tpY, slY) - tolerance;
    const maxY = Math.max(entryY, tpY, slY) + tolerance;
    const minX = Math.min(a.x, b.x) - tolerance;
    const maxX = Math.max(a.x, b.x, minX + 80) + tolerance;
    return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
  }

  // Rect or Ruler
  const x0 = Math.min(a.x, b.x) - tolerance;
  const x1 = Math.max(a.x, b.x) + tolerance;
  const y0 = Math.min(a.y, b.y) - tolerance;
  const y1 = Math.max(a.y, b.y) + tolerance;
  return p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
}

/** Where the round delete button sits for a drawing (pane CSS pixels). */
export function deleteHandlePoint(
  d: Drawing,
  chart: IChartApi,
  series: ISeriesApi<"Candlestick">,
  candles?: { time: number }[]
): Point | null {
  const g = drawingGeometry(d, chart, series, candles);
  if (!g) return null;

  if (g.kind === "level") {
    return { x: HANDLE_INSET, y: g.points[0].y };
  }
  if (g.kind === "hray") {
    return { x: g.points[0].x + HANDLE_INSET + 10, y: g.points[0].y };
  }
  if (g.kind === "ray") {
    return g.guide ? { x: g.guide.x, y: g.guide.y } : { x: g.points[0].x, y: g.points[0].y };
  }
  if (g.kind === "position") {
    const minX = Math.min(g.points[0].x, g.points[1].x);
    const boxW = Math.max(90, Math.abs(g.points[1].x - g.points[0].x));
    return { x: minX + boxW, y: g.points[0].y };
  }
  const [a, b] = g.points;
  return { x: b.x, y: b.y };
}

/** Locations of interactive resize anchor points in pane pixels. */
export function drawingAnchorPoints(
  d: Drawing,
  chart: IChartApi,
  series: ISeriesApi<"Candlestick">,
  candles?: { time: number }[]
): { a1: Point; a2?: Point } | null {
  const g = drawingGeometry(d, chart, series, candles);
  if (!g) return null;
  if (g.kind === "level") {
    return { a1: { x: HANDLE_INSET + 20, y: g.points[0].y } };
  }
  if (g.kind === "hray") {
    return { a1: { x: g.points[0].x, y: g.points[0].y } };
  }
  if (g.kind === "ray") {
    return { a1: g.points[0], a2: g.guide ?? g.points[1] };
  }
  return { a1: g.points[0], a2: g.points[1] };
}

/** Hit tests if a pointer is touching an anchor handle of a selected drawing. */
export function hitTestAnchor(
  d: Drawing,
  p: Point,
  chart: IChartApi,
  series: ISeriesApi<"Candlestick">,
  tolerance = 8,
  candles?: { time: number }[]
): "a1" | "a2" | null {
  if (d.locked) return null;
  const anchors = drawingAnchorPoints(d, chart, series, candles);
  if (!anchors) return null;
  if (Math.hypot(p.x - anchors.a1.x, p.y - anchors.a1.y) <= tolerance) {
    return "a1";
  }
  if (anchors.a2 && Math.hypot(p.x - anchors.a2.x, p.y - anchors.a2.y) <= tolerance) {
    return "a2";
  }
  return null;
}

class DrawingsRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly owner: DrawingsPrimitive) {}

  draw(target: CanvasRenderingTarget2D): void {
    this.owner.render(target);
  }
}

class DrawingsPaneView implements IPrimitivePaneView {
  constructor(private readonly owner: DrawingsPrimitive) {}

  zOrder() {
    return "normal" as const;
  }

  renderer(): IPrimitivePaneRenderer {
    return new DrawingsRenderer(this.owner);
  }
}

/**
 * Renders the user's drawings straight to the pane canvas.
 */
export class DrawingsPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private series: ISeriesApi<"Candlestick"> | null = null;
  private requestUpdate: () => void = () => {};
  private drawings: Drawing[] = [];
  private draft: Drawing | null = null;
  private hoveredId: string | null = null;
  private selectedId: string | null = null;
  private hidden: boolean = false;
  private style: DrawingsStyle = { labelBg: "#111111" };
  private candles: { time: number }[] = [];
  private readonly views: IPrimitivePaneView[];

  constructor() {
    this.views = [new DrawingsPaneView(this)];
  }

  setDrawings(drawings: Drawing[]): void {
    this.drawings = drawings;
    this.requestUpdate();
  }

  setCandles(candles: { time: number }[]): void {
    this.candles = candles;
    this.requestUpdate();
  }

  setDraft(draft: Drawing | null): void {
    this.draft = draft;
    this.requestUpdate();
  }

  setInteraction(hoveredId: string | null, selectedId: string | null): void {
    this.hoveredId = hoveredId;
    this.selectedId = selectedId;
    this.requestUpdate();
  }

  setStyle(style: DrawingsStyle): void {
    this.style = style;
    this.requestUpdate();
  }

  setHidden(hidden: boolean): void {
    if (this.hidden === hidden) return;
    this.hidden = hidden;
    this.requestUpdate();
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series as ISeriesApi<"Candlestick">;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.chart = null;
    this.series = null;
    this.requestUpdate = () => {};
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this.views;
  }

  /** @internal called by the renderer */
  render(target: CanvasRenderingTarget2D): void {
    const chart = this.chart;
    const series = this.series;
    if (!chart || !series) return;
    if (this.candles.length === 0 && !this.draft) return;

    const items: Drawing[] = this.draft
      ? (this.hidden ? [this.draft] : [...this.drawings, this.draft])
      : (this.hidden ? [] : this.drawings);
    if (items.length === 0) return;

    target.useBitmapCoordinateSpace((scope) => {
      const { context, horizontalPixelRatio: hx, verticalPixelRatio: vy } = scope;
      const px = (x: number) => x * hx;
      const py = (y: number) => y * vy;
      const dash = [6 * hx, 4 * hx];

      context.save();
      context.lineJoin = "round";
      context.lineCap = "round";
      context.font = `${Math.round(10 * vy)}px ${MONO}`;
      context.textBaseline = "middle";

      for (const item of items) {
        const g = drawingGeometry(item, chart, series, this.candles);
        if (!g) continue;

        const isDraft = item === this.draft;
        const isSelected = item.id === this.selectedId;
        const isHovered = item.id === this.hoveredId;
        const [a, b] = g.points;

        const baseWidth = item.lineWidth ?? 1.5;
        const strokeWidth = isSelected || isHovered ? baseWidth + 0.9 : baseWidth;
        context.strokeStyle = item.color;
        context.fillStyle = item.color;
        context.lineWidth = Math.max(
          1,
          Math.round(strokeWidth * hx)
        );
        context.globalAlpha = isDraft ? 0.85 : 1;

        const resolveDash = (style: LineStylePattern | undefined, defaultDash: number[]) => {
          if (style === "dashed") return [6 * hx, 4 * hx];
          if (style === "dotted") return [2 * hx, 3 * hx];
          if (style === "solid") return [];
          return defaultDash;
        };

        if (g.kind === "level") {
          context.setLineDash(isDraft ? dash : resolveDash(item.lineStyle, [5 * hx, 4 * hx]));
          context.beginPath();
          context.moveTo(px(a.x), py(a.y));
          context.lineTo(px(b.x), py(b.y));
          context.stroke();
          context.setLineDash([]);
          this.drawLabel(context, px(b.x), py(b.y), item.price1, item.color, hx, vy);
        } else if (g.kind === "hray") {
          context.setLineDash(isDraft ? dash : resolveDash(item.lineStyle, [6 * hx, 3 * hx]));
          context.beginPath();
          context.moveTo(px(a.x), py(a.y));
          context.lineTo(px(b.x), py(b.y));
          context.stroke();
          context.setLineDash([]);
          this.drawLabel(context, px(b.x), py(b.y), item.price1, item.color, hx, vy);
        } else if (g.kind === "segment" || g.kind === "ray") {
          context.setLineDash(isDraft ? dash : resolveDash(item.lineStyle, []));
          context.beginPath();
          context.moveTo(px(a.x), py(a.y));
          context.lineTo(px(b.x), py(b.y));
          context.stroke();
          context.setLineDash([]);

          // Ray guide point dot
          if (g.kind === "ray" && g.guide) {
            context.beginPath();
            context.arc(px(g.guide.x), py(g.guide.y), 3 * hx, 0, Math.PI * 2);
            context.fillStyle = item.color;
            context.fill();
          }
        } else if (g.kind === "arrow") {
          context.setLineDash(isDraft ? dash : resolveDash(item.lineStyle, []));
          context.beginPath();
          context.moveTo(px(a.x), py(a.y));
          context.lineTo(px(b.x), py(b.y));
          context.stroke();
          context.setLineDash([]);

          // Vector arrowhead at B
          const angle = Math.atan2(b.y - a.y, b.x - a.x);
          const headLen = 10 * hx;
          context.beginPath();
          context.moveTo(px(b.x), py(b.y));
          context.lineTo(
            px(b.x) - headLen * Math.cos(angle - Math.PI / 6),
            py(b.y) - headLen * Math.sin(angle - Math.PI / 6)
          );
          context.lineTo(
            px(b.x) - headLen * Math.cos(angle + Math.PI / 6),
            py(b.y) - headLen * Math.sin(angle + Math.PI / 6)
          );
          context.closePath();
          context.fillStyle = item.color;
          context.fill();
        } else if (g.kind === "fib") {
          const startX = Math.min(px(a.x), px(b.x));
          const endX = Math.max(px(a.x), px(b.x)) + 70 * hx;

          // Shaded Golden Pocket (0.382 to 0.618)
          const y0382 = py(a.y + (b.y - a.y) * 0.382);
          const y0618 = py(a.y + (b.y - a.y) * 0.618);
          context.fillStyle = "rgba(245, 158, 11, 0.12)";
          context.fillRect(
            startX,
            Math.min(y0382, y0618),
            endX - startX,
            Math.abs(y0618 - y0382)
          );

          // Connecting baseline
          context.setLineDash(dash);
          context.strokeStyle = `${item.color}80`;
          context.lineWidth = 1 * hx;
          context.beginPath();
          context.moveTo(px(a.x), py(a.y));
          context.lineTo(px(b.x), py(b.y));
          context.stroke();
          context.setLineDash([]);

          // Fibonacci levels
          for (const lvl of FIB_RATIOS) {
            const lvlY = py(a.y + (b.y - a.y) * lvl.ratio);
            const lvlPrice = item.price1 + (item.price2 - item.price1) * lvl.ratio;

            context.strokeStyle = lvl.color;
            context.lineWidth = Math.max(1, (lvl.ratio === 0.618 ? 1.6 : 1) * hx);
            context.beginPath();
            context.moveTo(startX, lvlY);
            context.lineTo(endX, lvlY);
            context.stroke();

            // Level text label
            const labelStr = `${lvl.ratio} ($${lvlPrice.toFixed(2)})`;
            context.font = `${Math.round(9 * vy)}px ${MONO}`;
            context.fillStyle = lvl.color;
            context.fillText(labelStr, startX + 4 * hx, lvlY - 6 * vy);
          }
        } else if (g.kind === "channel") {
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy);
          if (len > 0) {
            const nx = -dy / len;
            const ny = dx / len;
            const h = Math.max(16, Math.abs(b.y - a.y) * 0.4);

            const pA1 = { x: px(a.x + nx * h), y: py(a.y + ny * h) };
            const pB1 = { x: px(b.x + nx * h), y: py(b.y + ny * h) };
            const pA2 = { x: px(a.x - nx * h), y: py(a.y - ny * h) };
            const pB2 = { x: px(b.x - nx * h), y: py(b.y - ny * h) };

            // Fill channel polygon
            context.globalAlpha = isDraft ? 0.08 : 0.12;
            context.beginPath();
            context.moveTo(pA1.x, pA1.y);
            context.lineTo(pB1.x, pB1.y);
            context.lineTo(pB2.x, pB2.y);
            context.lineTo(pA2.x, pA2.y);
            context.closePath();
            context.fillStyle = item.color;
            context.fill();

            // Boundary strokes
            context.globalAlpha = 1;
            context.strokeStyle = item.color;
            context.lineWidth = Math.max(1, Math.round(strokeWidth * hx));
            context.setLineDash(resolveDash(item.lineStyle, []));
            context.beginPath();
            context.moveTo(pA1.x, pA1.y);
            context.lineTo(pB1.x, pB1.y);
            context.moveTo(pA2.x, pA2.y);
            context.lineTo(pB2.x, pB2.y);
            context.stroke();
            context.setLineDash([]);

            // Centerline
            context.setLineDash(dash);
            context.beginPath();
            context.moveTo(px(a.x), py(a.y));
            context.lineTo(px(b.x), py(b.y));
            context.stroke();
            context.setLineDash([]);
          }
        } else if (g.kind === "position") {
          const isLong = item.tool === "long";
          const entryPrice = item.price1;
          const tpPrice = isLong
            ? Math.max(item.price1 * 1.0005, item.price2)
            : Math.min(item.price1 * 0.9995, item.price2);
          const targetGain = Math.abs(tpPrice - entryPrice);
          const targetPct = (targetGain / entryPrice) * 100;
          const slPrice =
            typeof item.stopPrice === "number"
              ? item.stopPrice
              : isLong
                ? entryPrice - targetGain / 2
                : entryPrice + targetGain / 2;
          const stopLoss = Math.max(0.01, Math.abs(entryPrice - slPrice));
          const slPct = (stopLoss / entryPrice) * 100;
          const rrRatio = targetGain / stopLoss;

          const minX = Math.min(px(a.x), px(b.x));
          const boxW = Math.max(90 * hx, Math.abs(px(b.x) - px(a.x)));
          const yEntry = py(a.y);
          const yTP = py(series.priceToCoordinate(tpPrice) ?? b.y);
          const ySL = py(
            series.priceToCoordinate(slPrice) ??
              (isLong ? a.y + Math.abs(b.y - a.y) / 2 : a.y - Math.abs(b.y - a.y) / 2)
          );

          // 1. Green Take Profit Target Region
          const tpBoxY = Math.min(yEntry, yTP);
          const tpBoxH = Math.abs(yEntry - yTP);
          context.fillStyle = "rgba(34, 197, 94, 0.18)";
          context.fillRect(minX, tpBoxY, boxW, tpBoxH);
          context.strokeStyle = "#22c55e";
          context.lineWidth = 1.2 * hx;
          context.strokeRect(minX, tpBoxY, boxW, tpBoxH);

          // TP text banner
          context.font = `${Math.round(9 * vy)}px ${MONO}`;
          context.fillStyle = "#22c55e";
          context.fillText(
            `Target: +$${targetGain.toFixed(2)} (+${targetPct.toFixed(2)}%)`,
            minX + 6 * hx,
            tpBoxY + 10 * vy
          );
          context.fillText(
            `R:R ${rrRatio.toFixed(2)}${item.label ? ` • ${item.label}` : ""}`,
            minX + 6 * hx,
            tpBoxY + 22 * vy
          );

          // 2. Red Stop Loss Region
          const slBoxY = Math.min(yEntry, ySL);
          const slBoxH = Math.abs(yEntry - ySL);
          context.fillStyle = "rgba(239, 68, 68, 0.18)";
          context.fillRect(minX, slBoxY, boxW, slBoxH);
          context.strokeStyle = "#ef4444";
          context.lineWidth = 1.2 * hx;
          context.strokeRect(minX, slBoxY, boxW, slBoxH);

          // SL text banner
          context.fillStyle = "#ef4444";
          context.fillText(
            `Stop: -$${stopLoss.toFixed(2)} (-${slPct.toFixed(2)}%)`,
            minX + 6 * hx,
            slBoxY + 10 * vy
          );
          context.fillText(`Stop @ $${slPrice.toFixed(2)}`, minX + 6 * hx, slBoxY + 22 * vy);

          // 3. Entry divider line
          context.strokeStyle = "#ffffff";
          context.lineWidth = 1.5 * hx;
          context.beginPath();
          context.moveTo(minX, yEntry);
          context.lineTo(minX + boxW, yEntry);
          context.stroke();
          context.fillStyle = "#ffffff";
          context.fillText(`Entry: $${entryPrice.toFixed(2)}`, minX + 6 * hx, yEntry - 6 * vy);
        } else {
          // Standard rect or ruler
          const rx = Math.min(px(a.x), px(b.x));
          const ry = Math.min(py(a.y), py(b.y));
          const rw = Math.abs(px(b.x) - px(a.x));
          const rh = Math.abs(py(b.y) - py(a.y));
          context.globalAlpha = isDraft ? 0.18 : isHovered || isSelected ? 0.2 : 0.13;
          context.fillRect(rx, ry, rw, rh);
          context.globalAlpha = isDraft ? 0.9 : 1;
          context.setLineDash(isDraft ? dash : resolveDash(item.lineStyle, []));
          context.strokeRect(rx, ry, rw, rh);
          context.setLineDash([]);

          if (item.tool === "ruler") {
            context.setLineDash(dash);
            context.beginPath();
            context.moveTo(px(a.x), py(a.y));
            context.lineTo(px(b.x), py(b.y));
            context.stroke();
            context.setLineDash([]);

            const deltaP = item.price2 - item.price1;
            const deltaPct = item.price1 !== 0 ? (deltaP / item.price1) * 100 : 0;
            const sign = deltaP >= 0 ? "+" : "";
            const priceStr = `${sign}$${deltaP.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} (${sign}${deltaPct.toFixed(2)}%)`;

            const midX = rx + rw / 2;
            const midY = ry + rh / 2;
            const textW = context.measureText(priceStr).width;
            const padX = 6 * hx;
            const padY = 3 * vy;
            const badgeW = textW + padX * 2;
            const badgeH = 12 * vy + padY * 2;

            context.save();
            context.globalAlpha = 0.92;
            context.fillStyle = this.style.labelBg;
            context.fillRect(midX - badgeW / 2, midY - badgeH / 2, badgeW, badgeH);
            context.strokeStyle = item.color;
            context.lineWidth = 1 * hx;
            context.strokeRect(midX - badgeW / 2, midY - badgeH / 2, badgeW, badgeH);

            context.globalAlpha = 1;
            context.fillStyle = item.color;
            context.fillText(priceStr, midX - textW / 2, midY);
            context.restore();
          }
        }

        if (isSelected && !isDraft) {
          this.drawHandles(context, item, g, hx, vy);
        }
      }

      context.restore();
    });
  }

  /** Endpoint dots plus a round delete button for the selected drawing. */
  private drawHandles(
    context: CanvasRenderingContext2D,
    item: Drawing,
    g: DrawingGeometry,
    hx: number,
    vy: number
  ): void {
    context.setLineDash([]);
    const dot = Math.round(3.5 * hx);

    const anchors = drawingAnchorPoints(item, this.chart!, this.series!, this.candles);
    if (anchors) {
      const handlePoints = [anchors.a1, ...(anchors.a2 ? [anchors.a2] : [])];
      for (const p of handlePoints) {
        context.beginPath();
        context.arc(p.x * hx, p.y * vy, dot, 0, Math.PI * 2);
        context.fillStyle = item.locked ? "#4b5563" : this.style.labelBg;
        context.fill();
        context.lineWidth = Math.max(1, Math.round(1.5 * hx));
        context.strokeStyle = item.locked ? "#9ca3af" : item.color;
        context.stroke();
      }
    }

    const del = deleteHandlePoint(item, this.chart!, this.series!, this.candles);
    if (!del) return;
    const cx = del.x * hx;
    const cy = del.y * vy;
    const R = Math.round(8 * hx);

    context.beginPath();
    context.arc(cx, cy, R, 0, Math.PI * 2);
    context.fillStyle = item.locked ? "#4b5563" : item.color;
    context.fill();
    context.lineWidth = Math.max(1, Math.round(1.5 * hx));
    context.strokeStyle = this.style.labelBg;
    context.stroke();

    const s = R * 0.48;
    context.lineWidth = Math.max(1, Math.round(1.8 * hx));
    context.strokeStyle = this.style.labelBg;
    context.beginPath();
    context.moveTo(cx - s, cy - s);
    context.lineTo(cx + s, cy + s);
    context.moveTo(cx + s, cy - s);
    context.lineTo(cx - s, cy + s);
    context.stroke();
  }

  /** Price chip pinned to the right edge of a level or horizontal ray. */
  private drawLabel(
    context: CanvasRenderingContext2D,
    right: number,
    y: number,
    price: number,
    color: string,
    hx: number,
    vy: number
  ): void {
    const text = price.toFixed(2);
    const padX = Math.round(4 * hx);
    const padY = Math.round(2.5 * vy);
    const textWidth = context.measureText(text).width;
    const boxW = textWidth + padX * 2;
    const boxH = Math.round(10 * vy) + padY * 2;
    const boxX = right - boxW - Math.round(2 * hx);
    const boxY = y - boxH / 2;

    context.setLineDash([]);
    context.globalAlpha = 1;
    context.fillStyle = color;
    context.fillRect(boxX, boxY, boxW, boxH);
    context.fillStyle = this.style.labelBg;
    context.fillText(text, boxX + padX, y);
  }
}
