import { FunctionComponent } from "react";
import styles from "./iss-location-marker.module.css";

const Marker: FunctionComponent<{ type: string; id: string }> = ({ type, id }) => {
  let markerClass = "";
  if (type === "playheadMarker") {
    markerClass = styles.playheadMarker;
  } else if (type === "hoverMarker") {
    markerClass = styles.hoverMarker;
  }

  return <div id={`marker-${id}`} className={markerClass} />;
};

export default Marker;
