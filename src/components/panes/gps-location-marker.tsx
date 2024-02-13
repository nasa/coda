import React from "react";
import styles from "./gps-location-marker.module.css";

const GPSMarker = (props) => {
  let markerClass = "";
  if (props.type === "EV1") {
    markerClass = styles.ev1Marker;
  } else if (props.type === "EV2") {
    markerClass = styles.ev2Marker;
  } else if (props.type === "EV3") {
    markerClass = styles.ev3Marker;
  } else if (props.type === "EV4") {
    markerClass = styles.ev4Marker;
  } else if (props.type === "Cart") {
    markerClass = styles.cartMarker;
  } else if (props.type === "LightCart") {
    markerClass = styles.lightCartMarker;
  } else if (props.type === "Staff") {
    markerClass = styles.ev1Marker;
  }

  return <div id={`marker-${props.id}`} className={markerClass} />;
};

export default GPSMarker;
