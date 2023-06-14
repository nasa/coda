export function getPlotlyChartLayout(height) {
  const labelcolor = "#999999";
  const chartLayout = {
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
