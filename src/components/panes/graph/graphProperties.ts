export interface ChartLayout {
  autosize: boolean;
  height: number;
  showlegend: boolean;
  plot_bgcolor: string;
  paper_bgcolor: string;
  margin: {
    t: number;
    l: number;
    r: number;
    b: number;
  };
  xaxis: {
    autorange: boolean;
    range?: string[];
    showgrid: boolean;
    zeroline: boolean;
    showline: boolean;
    autotick: boolean;
    linecolor: string;
    linewidth: number;
    showticklabels: boolean;
    nticks: number;
    ticks: string;
    tickfont: {
      size: number;
      color: string;
    };
    tickformat: string;
    automargin: boolean;
    hoverinfo: string;
    type: string;
  };
  yaxis: {
    autorange: boolean;
    range?: string[];
    linecolor: string;
    linewidth: number;
    showticklabels: boolean;
    ticks: string;
    tickfont: {
      size: number;
      color: string;
    };
  };
}

export function getPlotlyChartLayout(height: number) {
  const labelcolor = "#999999";
  const chartLayout: ChartLayout = {
    autosize: true,
    height,
    showlegend: false,
    plot_bgcolor: "#19181b",
    paper_bgcolor: "#19181b",
    margin: {
      t: 10, //top margin
      l: 40, //left margin
      r: 0, //right margin
      b: 60, //bottom margin
    },
    xaxis: {
      autorange: true,
      showgrid: true,
      zeroline: false,
      showline: true,
      autotick: true,
      linecolor: "#96a5a7",
      linewidth: 1,
      showticklabels: true,
      nticks: 50,
      ticks: "inside",
      tickfont: {
        size: 11,
        color: labelcolor,
      },
      tickformat: "%H:%M:%S",
      automargin: true,
      hoverinfo: "y",
      // hoverformat: '.2r',
      type: "date",
    },
    yaxis: {
      autorange: true,
      linecolor: labelcolor,
      linewidth: 1,
      showticklabels: true,
      ticks: "inside",
      tickfont: {
        size: 12,
        color: labelcolor,
      },
    },
  };

  return chartLayout;
}
