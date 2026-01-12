import * as Plotly from "plotly.js-basic-dist";
import { MutableRefObject } from "react";

declare module "plotly.js" {
  namespace Fx {
    function hover(element: HTMLElement, eventData: unknown[], mode?: string): void;
  }
}

export default class PlotlyClass {
  constructor() {}

  drawChart(
    chartID: string,
    plotlyChartTraces: PlotlyChartTrace[],
    plotlyChartLayout: Partial<Plotly.Layout>
  ): void {
    Plotly.newPlot(chartID, plotlyChartTraces as Plotly.Data[], plotlyChartLayout, {
      displayModeBar: false,
    });
  }

  hoverPoint(chartRef: MutableRefObject<HTMLDivElement>, pointNumber: number): void {
    Plotly.Fx.hover(chartRef.current, [{ curveNumber: 0, pointNumber: pointNumber }]);
  }
}
