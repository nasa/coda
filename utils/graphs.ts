/**
 *  create an object of functions that parse graph data as defined in manifest
 */
export const getGraphParser = (graph: Graph) => {
  const graphParser = eval(graph.dataParserFunctionName);

  return graphParser;
};

export const parseGandalfHeartrateDataFile = (data: string, startDate: string): HeartrateData[] => {
  const lines = data.split("\n");
  const heartrateData: HeartrateData[] = [];

  // Get the date of the hr data file

  let startTime = null;
  let startDateTime = null;
  for (let i = 1; i < lines.length; i++) {
    // if line matches "Start,hh:mm:ss", then store the start time
    if (lines[i].match(/^Start,/)) {
      startTime = lines[i].split(",")[1].trim();
      startDateTime = new Date(`${startDate}T${startTime}Z`);
      break;
    }
  }

  let startRecording = false;
  for (let i = 1; i < lines.length; i++) {
    // if end of heart rate data then stop processing values and ignore lines of garbage
    if (lines[i].match(/^\r/)) {
      startRecording = false;
    }
    if (lines[i].match(/^Sec,HR_bpm,DeltaRR_ms/)) {
      startRecording = true;
    } else if (startRecording) {
      // process each line of hr data
      const line = lines[i].split(",");

      const timestamp = new Date(startDateTime.getTime() + parseInt(line[0]) * 1000);
      const timestampStr = timestamp.toISOString();
      const heartrate: HeartrateData = {
        timestamp: timestampStr,
        heartrate: parseInt(line[1]),
      };
      heartrateData.push(heartrate);
    }
  }
  return heartrateData;
};

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
      l: 25, //left margin
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
