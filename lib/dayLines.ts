import type {
  ISeriesPrimitive,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  SeriesAttachedParameter,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";

const DAY = 86400;

/**
 * Epoch seconds at 00:00 UTC for every UTC day touched by the candles.
 *
 * Values are floored to whole days in UTC, not the viewer's local zone, so the
 * separators always line up with 00:00 UTC regardless of where the user is.
 */
export function utcDayBoundaries(times: number[]): UTCTimestamp[] {
  const out: UTCTimestamp[] = [];
  let prev = -1;
  for (const t of times) {
    const dayStart = Math.floor(t / DAY) * DAY;
    if (dayStart !== prev) {
      out.push(dayStart as UTCTimestamp);
      prev = dayStart;
    }
  }
  return out;
}

/**
 * Vertical separators drawn at UTC midnight.
 *
 * A line series cannot do this: `setData` de-duplicates by timestamp, so the
 * usual "two points at the same time with different values" trick collapses to a
 * single point and never renders. A series primitive draws straight to the
 * canvas instead, which also keeps the lines off the price scale.
 */
class DayLinesRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly owner: DayLinesPrimitive) {}

  draw(target: CanvasRenderingTarget2D): void {
    this.owner.render(target);
  }
}

class DayLinesPaneView implements IPrimitivePaneView {
  constructor(private readonly owner: DayLinesPrimitive) {}

  zOrder() {
    return "bottom" as const;
  }

  renderer(): IPrimitivePaneRenderer {
    return new DayLinesRenderer(this.owner);
  }
}

export class DayLinesPrimitive implements ISeriesPrimitive<Time> {
  private chart: SeriesAttachedParameter<Time>["chart"] | null = null;
  private boundaries: UTCTimestamp[] = [];
  private color = "#666666";
  private alpha = 0.55;
  private redraw: () => void = () => {};
  private readonly views: IPrimitivePaneView[];

  constructor() {
    // Stable array reference: the library caches on identity
    this.views = [new DayLinesPaneView(this)];
  }

  /** Replace the separators. Pass an empty array to hide them. */
  setBoundaries(boundaries: UTCTimestamp[], color: string, alpha = 1): void {
    this.boundaries = boundaries;
    this.color = color;
    this.alpha = alpha;
    this.redraw();
  }

  attached({ chart, requestUpdate }: SeriesAttachedParameter<Time>): void {
    this.chart = chart;
    this.redraw = requestUpdate;
  }

  detached(): void {
    this.chart = null;
    this.redraw = () => {};
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this.views;
  }

  /** @internal called by the renderer */
  render(target: CanvasRenderingTarget2D): void {
    const chart = this.chart;
    if (!chart || this.boundaries.length === 0) return;

    const timeScale = chart.timeScale();

    target.useBitmapCoordinateSpace((scope) => {
      const { context, mediaSize, horizontalPixelRatio, verticalPixelRatio } = scope;

      context.save();
      context.beginPath();
      context.strokeStyle = this.color;
      // Day boundaries must read clearly above the panel background but stay
      // below the candles, so they're drawn dimmed rather than at full strength.
      context.globalAlpha = this.alpha;
      // Hairline that stays 1 physical pixel regardless of DPR
      context.lineWidth = Math.max(1, Math.round(horizontalPixelRatio));

      const heightPx = mediaSize.height * verticalPixelRatio;
      let drawn = 0;

      for (const t of this.boundaries) {
        const x = timeScale.timeToCoordinate(t);
        if (x === null) continue;
        // Cull anything off-canvas; high-frequency charts can span thousands of days
        if (x < -1 || x > mediaSize.width + 1) continue;

        const px = Math.round(x * horizontalPixelRatio);
        context.moveTo(px, 0);
        context.lineTo(px, heightPx);
        drawn++;
      }

      if (drawn > 0) context.stroke();
      context.restore();
    });
  }
}
