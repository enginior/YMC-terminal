import type {
  ISeriesPrimitive,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";

/**
 * A translucent horizontal band between two price levels, painted across the
 * whole pane the series lives in.
 *
 * lightweight-charts has no "fill between two prices" series, and a price line
 * only strokes — so the shaded zone (e.g. the neutral RSI band) is drawn as a
 * series primitive straight to the pane canvas, like the day separators and the
 * user drawings.
 */
class BandRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly owner: PriceBandPrimitive) {}

  draw(target: CanvasRenderingTarget2D): void {
    this.owner.render(target);
  }
}

class BandPaneView implements IPrimitivePaneView {
  constructor(private readonly owner: PriceBandPrimitive) {}

  zOrder() {
    return "bottom" as const;
  }

  renderer(): IPrimitivePaneRenderer {
    return new BandRenderer(this.owner);
  }
}

export class PriceBandPrimitive implements ISeriesPrimitive<Time> {
  private series: SeriesAttachedParameter<Time>["series"] | null = null;
  private upper = 100;
  private lower = 0;
  private color = "rgba(128,128,128,0.13)";
  private redraw: () => void = () => {};
  private readonly views: IPrimitivePaneView[];

  constructor() {
    // Stable array reference: the library caches on identity.
    this.views = [new BandPaneView(this)];
  }

  /** Set the band's price bounds (and optional fill colour). */
  setBand(upper: number, lower: number, color: string): void {
    this.upper = upper;
    this.lower = lower;
    this.color = color;
    this.redraw();
  }

  attached({ series, requestUpdate }: SeriesAttachedParameter<Time>): void {
    this.series = series;
    this.redraw = requestUpdate;
  }

  detached(): void {
    this.series = null;
    this.redraw = () => {};
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this.views;
  }

  /** @internal called by the renderer */
  render(target: CanvasRenderingTarget2D): void {
    const series = this.series;
    if (!series) return;

    const yUpper = series.priceToCoordinate(this.upper);
    const yLower = series.priceToCoordinate(this.lower);
    if (yUpper === null || yLower === null) return;

    target.useBitmapCoordinateSpace((scope) => {
      const { context, mediaSize, horizontalPixelRatio, verticalPixelRatio } = scope;
      const top = Math.min(yUpper, yLower) * verticalPixelRatio;
      const bottom = Math.max(yUpper, yLower) * verticalPixelRatio;
      const width = mediaSize.width * horizontalPixelRatio;

      context.save();
      context.fillStyle = this.color;
      context.fillRect(0, top, width, bottom - top);
      context.restore();
    });
  }
}
