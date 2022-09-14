import * as Plotly from "plotly.js";
import { MutableRefObject } from "react";

export default class PlotlyClass {
  constructor() {}

  drawChart(chartID: string, plotlyChartTraces: PlotlyChartTrace[], plotlyChartLayout) {
    Plotly.newPlot(chartID, plotlyChartTraces, plotlyChartLayout, {
      displayModeBar: false,
    });
  }

  hoverPoint(chartRef: MutableRefObject<HTMLDivElement>, pointNumber: number) {
    Plotly.Fx.hover(chartRef.current, [{ curveNumber: 0, pointNumber: pointNumber }]);
  }
}
