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

export type DrawingTool = "level" | "trend" | "rect" | "ruler";

export interface Drawing {
  id: string;
  tool: DrawingTool;
  time1: number;
  price1: number;
  time2: number;
  price2: number;
  color: string;
}

export interface DrawingsStyle {
  /** Chip background for the price label drawn on a level line. */
  labelBg: string;
}

/** A point in chart (pane) CSS pixels. */
export interface Point {
  x: number;
  y: number;
}

export interface DrawingGeometry {
  kind: "level" | "segment" | "rect";
  /** Defining points in pane CSS pixels. Level points are the two pane edges. */
  points: [Point, Point];
}

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
/** Click tolerance, and the gap between a drawing's end and its delete button. */
const HIT_TOLERANCE = 6;
const HANDLE_INSET = 14;

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
  const step = candles.length >= 2 ? Math.max(1, lastCandle.time - candles[candles.length - 2].time) : 60;
  const lastIdx = candles.length - 1;
  const targetLogical = lastIdx + (time - lastCandle.time) / step;

  // 1. Try native logicalToCoordinate
  const directLogicalCoord = timeScale.logicalToCoordinate(targetLogical as Logical);
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
  candles?: { time: number }[]
): DrawingGeometry | null {
  const timeScale = chart.timeScale();
  if (d.tool === "level") {
    const y = series.priceToCoordinate(d.price1);
    if (y === null) return null;
    const w = timeScale.width();
    return { kind: "level", points: [{ x: 0, y }, { x: w, y }] };
  }
  const x1 = timeToCoordinateExtrapolated(d.time1, timeScale, candles);
  const x2 = timeToCoordinateExtrapolated(d.time2, timeScale, candles);
  const y1 = series.priceToCoordinate(d.price1);
  const y2 = series.priceToCoordinate(d.price2);
  if (x1 === null || x2 === null || y1 === null || y2 === null) return null;
  return {
    kind: d.tool === "trend" ? "segment" : "rect",
    points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
  };
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** True when a point is on / near a drawing. Rectangles hit on edges or inside. */
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

  const [a, b] = g.points;
  if (g.kind === "segment") return distanceToSegment(p, a, b) <= tolerance;

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
    // Keep clear of the right-edge price chip.
    return { x: HANDLE_INSET, y: g.points[0].y };
  }
  const [a, b] = g.points;
  return { x: b.x, y: b.y };
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
 * Renders the user's level / trend / box drawings straight to the pane canvas.
 *
 * Line series can't do this job: `setData` collapses same-time points, so a
 * vertical box edge or a full-width level won't render, and a rectangle has no
 * series representation at all. A primitive also lets the in-progress draft be
 * painted without touching React state on every pointer move, and lets a
 * selected drawing show editable-looking handles like a charting platform.
 */
export class DrawingsPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private series: ISeriesApi<"Candlestick"> | null = null;
  private requestUpdate: () => void = () => {};
  private drawings: Drawing[] = [];
  private draft: Drawing | null = null;
  private hoveredId: string | null = null;
  private selectedId: string | null = null;
  private style: DrawingsStyle = { labelBg: "#111111" };
  private candles: { time: number }[] = [];
  private readonly views: IPrimitivePaneView[];

  constructor() {
    // Stable array reference: the library caches on identity
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

  /** The shape currently being dragged out; null when idle. */
  setDraft(draft: Drawing | null): void {
    this.draft = draft;
    this.requestUpdate();
  }

  /** Which drawing is under the cursor and which is selected. */
  setInteraction(hoveredId: string | null, selectedId: string | null): void {
    this.hoveredId = hoveredId;
    this.selectedId = selectedId;
    this.requestUpdate();
  }

  setStyle(style: DrawingsStyle): void {
    this.style = style;
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

    const items: Drawing[] = this.draft
      ? [...this.drawings, this.draft]
      : this.drawings;
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

        context.strokeStyle = item.color;
        context.fillStyle = item.color;
        context.lineWidth = Math.max(
          1,
          Math.round((isSelected || isHovered ? 2.4 : 1.5) * hx)
        );
        context.globalAlpha = isDraft ? 0.85 : 1;

        if (g.kind === "level") {
          context.setLineDash(isDraft ? dash : [5 * hx, 4 * hx]);
          context.beginPath();
          context.moveTo(px(a.x), py(a.y));
          context.lineTo(px(b.x), py(b.y));
          context.stroke();
          context.setLineDash([]);
          this.drawLabel(context, px(b.x), py(b.y), item.price1, item.color, hx, vy);
        } else if (g.kind === "segment") {
          context.setLineDash(isDraft ? dash : []);
          context.beginPath();
          context.moveTo(px(a.x), py(a.y));
          context.lineTo(px(b.x), py(b.y));
          context.stroke();
          context.setLineDash([]);
        } else {
          const rx = Math.min(px(a.x), px(b.x));
          const ry = Math.min(py(a.y), py(b.y));
          const rw = Math.abs(px(b.x) - px(a.x));
          const rh = Math.abs(py(b.y) - py(a.y));
          context.globalAlpha = isDraft ? 0.18 : isHovered || isSelected ? 0.2 : 0.13;
          context.fillRect(rx, ry, rw, rh);
          context.globalAlpha = isDraft ? 0.9 : 1;
          context.setLineDash(isDraft ? dash : []);
          context.strokeRect(rx, ry, rw, rh);
          context.setLineDash([]);

          if (item.tool === "ruler") {
            // Draw diagonal line connecting anchor points
            context.setLineDash(dash);
            context.beginPath();
            context.moveTo(px(a.x), py(a.y));
            context.lineTo(px(b.x), py(b.y));
            context.stroke();
            context.setLineDash([]);

            // Calculate price delta and percentage
            const deltaP = item.price2 - item.price1;
            const deltaPct = item.price1 !== 0 ? (deltaP / item.price1) * 100 : 0;
            const sign = deltaP >= 0 ? "+" : "";
            const priceStr = `${sign}$${deltaP.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${sign}${deltaPct.toFixed(2)}%)`;

            // Draw delta badge in center of measurement region
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

    if (g.kind !== "level") {
      for (const p of g.points) {
        context.beginPath();
        context.arc(p.x * hx, p.y * vy, dot, 0, Math.PI * 2);
        context.fillStyle = this.style.labelBg;
        context.fill();
        context.lineWidth = Math.max(1, Math.round(1.5 * hx));
        context.strokeStyle = item.color;
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
    context.fillStyle = item.color;
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

  /** Price chip pinned to the right edge of a level line. */
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
