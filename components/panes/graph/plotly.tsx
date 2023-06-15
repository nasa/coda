import { MutableRefObject, useEffect, useRef } from "react";

import PlotlyClass from "components/panes/graph/plotly-class";
import { appSecondsFromDateString } from "utils/formatting";
import { changeTime } from "store/playhead";
import { useDispatch } from "react-redux";

//disgusting hack to make IDE errors go away in the useEffect below
type HTMLDivElementExtended = HTMLDivElement & { on: Function };

function PlotlyComponent(props) {
  const dispatch = useDispatch();

  const plotlyClass: MutableRefObject<PlotlyClass> = useRef(null);
  const plotlyChartRef: MutableRefObject<HTMLDivElementExtended> = useRef(null);

  useEffect(() => {
    plotlyClass.current = new PlotlyClass();
  }, []);

  useEffect(() => {
    if (!plotlyChartRef.current) {
      return;
    }
    plotlyClass.current.drawChart(
      `plotlyChart${props.frameID}`,
      props.chartData.plotlyChartTraces,
      props.chartData.plotlyChartLayout
    );

    //now that drawChart has been called, the "on" method is now attached to the plotlyChart div
    plotlyChartRef.current.on("plotly_click", (data) => {
      // ignore errors caused by graph data being unavailable for a given point
      try {
        const dateStr = data.points[0].x.replace(" " + "T") + "Z";
        dispatch(changeTime(Math.round(appSecondsFromDateString(dateStr))));
      } catch {
        //do nothing
      }
    });
  }, [plotlyChartRef, props.chartData.plotlyChartTraces]);

  useEffect(() => {
    plotlyClass.current.hoverPoint(plotlyChartRef, props.plotIndexToHighlight);
  }, [plotlyClass, props.plotIndexToHighlight]);

  return (
    <div>
      <div ref={plotlyChartRef} id={`plotlyChart${props.frameID}`}></div>
    </div>
  );
}

export default PlotlyComponent;
