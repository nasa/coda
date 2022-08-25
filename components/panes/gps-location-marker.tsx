import React from "react";
import styles from "./gps-location-marker.module.css";

const GPSMarker = (props) => {
  let markerClass = "";
  if (props.type === "EV1") {
    markerClass = styles.ev1Marker;
  } else if (props.type === "EV2") {
    markerClass = styles.ev2Marker;
  } else if (props.type === "Cart") {
    markerClass = styles.cartMarker;
  } else if (props.type === "LightCart") {
    markerClass = styles.lightCartMarker;
  } else if (props.type === "Photo") {
    markerClass = styles.photoMarker;
  } else if (props.type === "RUN1") {
    markerClass = styles.ev1Marker;
  } else if (props.type === "RUN2") {
    markerClass = styles.ev2Marker;
  } else if (props.type === "RUN3") {
    markerClass = styles.ev3Marker;
  }

  return <div id={`marker-${props.id}`} className={markerClass} />;
};

export default GPSMarker;
