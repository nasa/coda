import { RootState } from "store/index";
import { useState, useEffect, useRef } from "react";
// import useInterval from "utils/useInterval";
import ReactDOM from "react-dom";
import { useSelector, useStore } from "react-redux";
import deepEqual from "lodash/isEqual";
import { PlayheadState, diff } from "store/playhead";

import styles from "./iss-location.module.css";
import Marker from "./iss-location-marker";

import { ephemeraSelectors } from "store/ephemera";
import type { Ephemeris } from "services/spacetrack";
import { getPlayheadISOString, hhmmssmmmFromSeconds } from "utils/formatting";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

//tlejs not importable as per module docs
const { getLatLngObj } = require("tle.js/dist/tlejs.cjs");

type MapMarker = {
  marker: any; //the MapBox marker reference
  markerNode: any; //the real DOM id of the marker
};

export default function ISSLocation() {
  const initialMarker: MapMarker = {
    marker: null,
    markerNode: null,
  };

  const {
    playhead,
  }: {
    playhead: PlayheadState;
  } = useSelector((state: RootState) => state, deepEqual);
  const ephemera = ephemeraSelectors.selectAll(useStore().getState());
  // const [TLE, setTLE] = useState(null);

  const [map, setMap] = useState(null);
  const [playheadMarker, setPlayheadMarker] = useState(initialMarker);
  const [hoverMarker, setHoverMarker] = useState(initialMarker);
  // const [markerIntervalTicks, setMarkerIntervalTicks] = useState(0);

  const mapContainer = useRef(null);

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
      const thisMap = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/bfeist/ckm6yjob22j6b17o79mq0tvr7", // satellite
        center: houstonLatLng, // starting position [lng, lat]
        zoom: 1, // starting zoom
        attributionControl: false,
        antialias: true,
      });

      // create playhead marker node
      const playheadMarkerNode = document.createElement("div");
      ReactDOM.render(<Marker id="playheadMarker" type="playheadMarker" />, playheadMarkerNode);
      const thisPlayheadMarker = new mapboxgl.Marker(playheadMarkerNode).setLngLat(houstonLatLng);
      thisPlayheadMarker.addTo(thisMap);
      setPlayheadMarker({ marker: thisPlayheadMarker, markerNode: playheadMarkerNode });

      // create hover marker node
      const hoverMarkerNode = document.createElement("div");
      ReactDOM.render(<Marker id="hoverMarker" type="hoverMarker" />, hoverMarkerNode);
      const thisHoverMarker = new mapboxgl.Marker(hoverMarkerNode).setLngLat(houstonLatLng);
      thisHoverMarker.addTo(thisMap);
      setHoverMarker({ marker: thisHoverMarker, markerNode: hoverMarkerNode });

      thisMap.on("load", () => {
        setMap(thisMap);
        thisMap.resize();
      });
    };

    if (!map) initializeMap({ setMap, mapContainer });
  }, [map]);

  //put TLE in state when ephemera changes
  useEffect(() => {
    if (!map || !playhead.date || ephemera.length === 0) {
      return;
    }

    const playHeadISODate = getPlayheadISOString(playhead.date, playhead.seconds);

    const tle = getAppropriateTLE(ephemera, playHeadISODate);
    if (tle.length === 0) {
      return;
    }

    //calculate lat long for timestamp of interest using mostRecentTLE as orbital starting point
    const playheadLatLonObj = getLatLngObj(tle, playHeadISODate);
    playheadMarker.marker.setLngLat(playheadLatLonObj);

    //position hover marker
    if (playhead.hoverSeconds !== 0) {
      hoverMarker.markerNode.style.visibility = "visible";
      const hoverISODate = getPlayheadISOString(playhead.date, playhead.hoverSeconds);
      const hoverLatLonObj = getLatLngObj(tle, hoverISODate);
      hoverMarker.marker.setLngLat(hoverLatLonObj);
    } else {
      hoverMarker.markerNode.style.visibility = "hidden";
    }

    //center the map every x seconds
    if (playhead.seconds % 5 === 0) {
      // map.setCenter(latLonObj);
    }
    // move the marker
  }, [ephemera, playhead.date, playhead.seconds, playhead.hoverSeconds]);

  // //move marker much more quickly than once per second
  // useInterval(() => {
  //   if (!TLE) {
  //     return;
  //   }
  //   const playHeadISODate = getPlayheadISOString(playhead.date, playhead.seconds);

  //   //increment milliseconds
  //   if (markerIntervalTicks > 10) {
  //     setMarkerIntervalTicks(0);
  //   } else {
  //     setMarkerIntervalTicks(markerIntervalTicks + 1);
  //   }

  //   const playHeadDateWithAddedMS = new Date(playHeadISODate).getTime() + markerIntervalTicks * 100;
  //   const playheadISOWithAddedMS = new Date(playHeadDateWithAddedMS).toISOString();

  //   //calculate lat long for timestamp of interest using mostRecentTLE as orbital starting point
  //   const latLonObj = getLatLngObj(TLE, playheadISOWithAddedMS);
  //   console.log(playheadISOWithAddedMS);

  //   // move the marker
  //   marker.setLngLat(latLonObj);
  // }, 100);

  return (
    <>
      <div className={styles.placeholderDiv}></div>
      <div key={`iss-position_element`} className={styles.container}>
        <div ref={(el) => (mapContainer.current = el)} style={{ height: 250 }}></div>
      </div>
    </>
  );

  function intersectRect(r1, r2) {
    return !(r2.left > r1.right || r2.right < r1.left || r2.top > r1.bottom || r2.bottom < r1.top);
  }

  function isMarkerVisible(): boolean {
    var cc = map.getContainer();
    var els = cc.getElementsByClassName("marker");
    var ccRect = cc.getBoundingClientRect();
    var visibles = [];
    for (var i = 0; i < els.length; i++) {
      var el = els.item(i);
      var elRect = el.getBoundingClientRect();
      intersectRect(ccRect, elRect) && visibles.push(el);
    }
    if (visibles.length > 0) console.log(visibles);
    return visibles.length > 0;
  }
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
