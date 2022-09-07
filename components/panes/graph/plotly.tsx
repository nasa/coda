import { MutableRefObject, useEffect, useRef } from "react";

import PlotlyClass from "components/panes/graph/plotly-class";
import { appSecondsFromDateString } from "utils/formatting";
import { changeTime } from "store/playhead";
import { useDispatch } from "react-redux";
import { changeHoverTime } from "store/playheadHover";

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
    plotlyClass.current.drawChart(
      "plotlyChart",
      props.chartData.plotlyChartTraces,
      props.chartData.plotlyChartLayout
    );

    //now that drawChart has been called, the "on" method is now attached to the plotlyChart div. Don't know how to make the error go away
    plotlyChartRef.current.on("plotly_click", (data) => {
      const dateStr = data.points[0].x.replace(" " + "T") + "Z";
      dispatch(changeTime(appSecondsFromDateString(dateStr)));
    });

    // TODO - the nav currently doesn't react to hover in this way, but it should
    plotlyChartRef.current.on("plotly_hover", (data) => {
      const dateStr = data.points[0].x.replace(" " + "T") + "Z";
      dispatch(changeHoverTime(appSecondsFromDateString(dateStr)));
    });

    plotlyChartRef.current.on("plotly_unhover", () => {
      dispatch(changeHoverTime(0));
    });
  }, [plotlyChartRef, props.chartData.plotlyChartTraces]);

  useEffect(() => {
    plotlyClass.current.hoverPoint("plotlyChart", props.plotIndexToHighlight);
  }, [plotlyClass, props.plotIndexToHighlight]);

  return (
    <div>
      <div ref={plotlyChartRef} id="plotlyChart"></div>
    </div>
  );
}

export default PlotlyComponent;
