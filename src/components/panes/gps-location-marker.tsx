import { FunctionComponent } from "react";
import styles from "./gps-location-marker.module.css";

const GPSMarker: FunctionComponent<{ type: string; id: string | number }> = ({ type, id }) => {
  let markerClass = "";
  if (type === "EV1") {
    markerClass = styles.ev1Marker;
  } else if (type === "EV2") {
    markerClass = styles.ev2Marker;
  } else if (type === "EV3") {
    markerClass = styles.ev3Marker;
  } else if (type === "EV4") {
    markerClass = styles.ev4Marker;
  } else if (type === "Cart") {
    markerClass = styles.cartMarker;
  } else if (type === "LightCart") {
    markerClass = styles.lightCartMarker;
  } else if (type === "Staff") {
    markerClass = styles.ev1Marker;
  }

  return <div id={`marker-${id}`} className={markerClass} />;
};

export default GPSMarker;
