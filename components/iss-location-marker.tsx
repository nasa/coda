import React from "react";
import styles from "./iss-location-marker.module.css";

const Marker = ({ id }) => <div id={`marker-${id}`} className={styles.marker} />;

export default Marker;
