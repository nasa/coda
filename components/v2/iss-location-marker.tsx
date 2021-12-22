import React from "react";
import styles from "./iss-location-marker.module.css";

const Marker = (props) => {
  let markerClass = "";
  if (props.type === "playheadMarker") {
    markerClass = styles.playheadMarker;
  } else if (props.type === "hoverMarker") {
    markerClass = styles.hoverMarker;
  }

  return <div id={`marker-${props.id}`} className={markerClass} />;
};

export default Marker;
