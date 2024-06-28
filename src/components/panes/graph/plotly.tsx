import { FunctionComponent, MutableRefObject, useEffect, useRef } from "react";

import PlotlyClass from "components/panes/graph/plotly-class";
import { appSecondsFromDateString } from "utils/formatting";
import { changeTime } from "store/playhead";
import { useDispatch } from "react-redux";
import { ChartLayout } from "./graphProperties";
import { Layout } from "plotly.js";

//disgusting hack to make IDE errors go away in the useEffect below
type HTMLDivElementExtended = HTMLDivElement & { on: Function };

const PlotlyComponent: FunctionComponent<{
  frameID: number;
  chartData: {
    plotlyChartTraces: PlotlyChartTrace[];
    plotlyChartLayout: ChartLayout;
  };
  plotIndexToHighlight: number;
}> = ({ frameID, chartData, plotIndexToHighlight }) => {
  const dispatch = useDispatch();

  const plotlyClass: MutableRefObject<PlotlyClass> = useRef(null);
  const plotlyChartRef: MutableRefObject<HTMLDivElementExtended> = useRef(null);

  useEffect(() => {
    plotlyClass.current = new PlotlyClass();
  }, []);

  useEffect(() => {
    if (!plotlyChartRef.current) return;

    plotlyClass.current.drawChart(
      `plotlyChart${frameID}`,
      chartData.plotlyChartTraces,
      chartData.plotlyChartLayout as Partial<Layout>
    );

    //now that drawChart has been called, the "on" method is now attached to the plotlyChart div
    plotlyChartRef.current.on(
      "plotly_click",
      (data: { points: { x: { replace: (arg0: string) => string } }[] }) => {
        // ignore errors caused by graph data being unavailable for a given point
        try {
          const dateStr = data.points[0].x.replace(" " + "T") + "Z";
          dispatch(changeTime(Math.round(appSecondsFromDateString(dateStr))));
        } catch {
          //do nothing
        }
      }
    );
  }, [plotlyChartRef, chartData]);

  useEffect(() => {
    plotlyClass.current.hoverPoint(plotlyChartRef, plotIndexToHighlight);
  }, [plotlyClass, plotIndexToHighlight]);

  return (
    <div>
      <div ref={plotlyChartRef} id={`plotlyChart${frameID}`}></div>
    </div>
  );
};

export default PlotlyComponent;
