import * as Plotly from "plotly.js-basic-dist";

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

  hoverPoint(chartRef: { current: HTMLDivElement | null }, pointNumber: number): void {
    if (!chartRef.current) return;
    Plotly.Fx.hover(chartRef.current, [{ curveNumber: 0, pointNumber: pointNumber }]);
  }
}
