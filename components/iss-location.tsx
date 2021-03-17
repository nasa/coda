import { RootState } from "store/index";
import { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { useSelector, useStore } from "react-redux";
import deepEqual from "lodash/isEqual";
import { PlayheadState, diff } from "store/playhead";

import styles from "./iss-location.module.css";
import Marker from "./iss-location-marker";

import { ephemeraSelectors } from "store/ephemera";
import type { Ephemeris } from "services/spacetrack";
import { getPlayheadISOString } from "utils/formatting";
import { isNull } from "lodash";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

//tlejs not importable as per module docs
const {
  getLatLngObj,
  getEpochTimestamp,
  getSatelliteInfo,
  getFirstTimeDerivative,
  getSecondTimeDerivative,
  getBstarDrag,
  getEccentricity,
} = require("tle.js/dist/tlejs.cjs");

export default function ISSLocation() {
  const {
    playhead,
  }: {
    playhead: PlayheadState;
  } = useSelector((state: RootState) => state, deepEqual);
  const ephemera = ephemeraSelectors.selectAll(useStore().getState());

  const [map, setMap] = useState(null);
  const [marker, setMarker] = useState(null);
  const mapContainer = useRef(null);

  const [TLE, setTLE] = useState("");

  //just need any location for getSatelliteInfo
  const houstonLatLng = {
    lng: -95.3698,
    lat: 29.7604,
  };

  //init map app
  useEffect(() => {
    mapboxgl.accessToken =
      "pk.eyJ1IjoiYmZlaXN0IiwiYSI6ImNpbDJva2hseTNnZnd1Z20zNmU0cDExdXUifQ.3acQyDaKU1HS8k5hqPmp1w";
    const initializeMap = ({ setMap, mapContainer }) => {
      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/bfeist/ckm6yjob22j6b17o79mq0tvr7", // satellite
        center: houstonLatLng, // starting position [lng, lat]
        zoom: 2, // starting zoom
        attributionControl: false,
        antialias: true,
      });

      // create marker node
      const markerNode = document.createElement("div");
      ReactDOM.render(<Marker id={"marker"} />, markerNode);
      // add marker to map
      const thisMarker = new mapboxgl.Marker(markerNode).setLngLat(houstonLatLng);
      thisMarker.addTo(map);
      setMarker(thisMarker);

      map.on("load", () => {
        setMap(map);
        map.resize();
      });
    };

    if (!map) initializeMap({ setMap, mapContainer });
  }, [map]);

  //put TLE in state when ephemera changes
  useEffect(() => {
    if (!map || !playhead.date || ephemera.length === 0) {
      return;
    }

    // playheadZuluDate = new Date(playhead.date)
    const playHeadISODate = getPlayheadISOString(playhead.date, playhead.seconds);

    const tle = getAppropriateTLE(ephemera, playHeadISODate);
    if (tle.length === 0) {
      return;
    }
    setTLE(tle);

    //calculate lat long for timestamp of interest using mostRecentTLE as orbital starting point
    const latLonObj = getLatLngObj(tle, playHeadISODate);

    //move the map and center the marker
    map.setCenter(latLonObj);
    marker.setLngLat(latLonObj);
  }, [ephemera, playhead.date, playhead.seconds]);

  return (
    <>
      <div className={styles.placeholderDiv}></div>
      <div key={`iss-position_element`} className={styles.container}>
        <div ref={(el) => (mapContainer.current = el)} style={{ height: 250 }}></div>
      </div>
    </>
  );
}

function getAppropriateTLE(ephemera: Ephemeris[], dateTimeWanted: string): string {
  let thisDateDiff;
  let lastDateDiff = -1;
  let mostRecentEphemeris = "";
  // chew through ephemiris data looking for the most recent TLE for the timestamp of interest
  for (let i = 0; i < ephemera.length; i++) {
    thisDateDiff = diff(new Date(ephemera[i].EPOCH + "Z"), new Date(dateTimeWanted));
    if (i !== 0 && Math.abs(thisDateDiff) > Math.abs(lastDateDiff)) {
      // we have passed the TLE epoch closest to the wanted date (before the wanted date)
      const tleObj = ephemera[i - 1];
      mostRecentEphemeris = `${tleObj.TLE_LINE0}
                  ${tleObj.TLE_LINE1}
                  ${tleObj.TLE_LINE2}`;
    }
    lastDateDiff = thisDateDiff;
  }
  return mostRecentEphemeris;
}
