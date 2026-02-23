import { FunctionComponent, useEffect, useRef } from "react";

import PlotlyClass from "components/panes/graph/plotly-class";
import { appSecondsFromDateString } from "utils/formatting";
import { ChartLayout } from "./graphProperties";
import { Layout } from "plotly.js-basic-dist";
import { useAppDispatch } from "utils/useAppDispatch";
import { setAppSeconds } from "store/clock";

//disgusting hack to make IDE errors go away in the useEffect below
type HTMLDivElementExtended = HTMLDivElement & { on: Function };

const PlotlyComponent: FunctionComponent<{
  paneInstanceId: number;
  chartData: {
    plotlyChartTraces: PlotlyChartTrace[];
    plotlyChartLayout: ChartLayout;
  };
  plotIndexToHighlight: number;
}> = ({ paneInstanceId, chartData, plotIndexToHighlight }) => {
  const dispatch = useAppDispatch();

  const plotlyClass = useRef<PlotlyClass | null>(null);
  const plotlyChartRef = useRef<HTMLDivElementExtended | null>(null);

  useEffect(() => {
    plotlyClass.current = new PlotlyClass();
  }, []);

  useEffect(() => {
    if (!plotlyChartRef.current || !plotlyClass.current) return;

    plotlyClass.current.drawChart(
      `plotlyChart${paneInstanceId}`,
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
          dispatch(setAppSeconds(appSecondsFromDateString(dateStr)));
        } catch {
          //do nothing
        }
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispatch is stable, paneInstanceId doesn't change after mount
  }, [plotlyChartRef, chartData]);

  useEffect(() => {
    plotlyClass.current?.hoverPoint(plotlyChartRef, plotIndexToHighlight);
  }, [plotlyClass, plotIndexToHighlight]);

  return (
    <div>
      <div ref={plotlyChartRef} id={`plotlyChart${paneInstanceId}`}></div>
    </div>
  );
};

export default PlotlyComponent;
