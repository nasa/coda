import * as Plotly from "plotly.js";
import { PlotlyChartTrace } from "utils/charts";

export default class PlotlyClass {
  constructor() {}

  drawChart(chartID: string, plotlyChartTraces: PlotlyChartTrace[], plotlyChartLayout) {
    Plotly.newPlot(chartID, plotlyChartTraces, plotlyChartLayout, {
      displayModeBar: false,
    });
  }

  hoverPoint(chartID: string, pointNumber: number) {
    Plotly.Fx.hover(chartID, [
      { curveNumber: 0, pointNumber: pointNumber },
      { curveNumber: 1, pointNumber: pointNumber },
    ]);
  }
}
