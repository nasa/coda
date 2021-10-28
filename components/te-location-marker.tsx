import React from "react";
import styles from "./te-location-marker.module.css";

const TEMarker = (props) => {
  let markerClass = "";
  if (props.type === "EV1") {
    markerClass = styles.ev1Marker;
  } else if (props.type === "EV2") {
    markerClass = styles.ev2Marker;
  } else if (props.type === "Cart") {
    markerClass = styles.cartMarker;
  }

  return <div id={`marker-${props.id}`} className={markerClass} />;
};

export default TEMarker;
