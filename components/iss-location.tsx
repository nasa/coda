import { useState, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction, MutableRefObject } from "react";
import { useSelector } from "react-redux";
import ReactDOM from "react-dom";
import deepEqual from "lodash/isEqual";
import { RootState } from "store/index";
import { PlayheadState } from "store/playhead";
import { EphemeraEntityState, ephemeraSelectors, getAppropriateTLE } from "store/ephemera";
import type { Ephemeris } from "services/spacetrack";
import { getPlayheadISOString } from "utils/formatting";

import styles from "./iss-location.module.css";
import Marker from "./iss-location-marker";

import mapboxgl, { Map } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import Terminator from "utils/terminator";
import type { FeatureCollection, Geometry } from "geojson";

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
    ephemera,
  }: {
    playhead: PlayheadState;
    ephemera: EphemeraEntityState;
  } = useSelector((state: RootState) => state, deepEqual);
  const todayEphemera = ephemeraSelectors.selectAll(ephemera);

  const [map, setMap] = useState<Map>(null);
  const [playheadMarker, setPlayheadMarker] = useState(initialMarker);
  const [hoverMarker, setHoverMarker] = useState(initialMarker);
  const [lockToggle, setLockToggle] = useState(true);

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

    if (!map) initializeMap(setMap, mapContainer);
  }, [map]);

  //update map based on changes in seconds / hoverSeconds
  useEffect(() => {
    if (!map || !playhead.date || todayEphemera.length === 0) {
      return;
    }

    const playHeadISODate = getPlayheadISOString(playhead.date, playhead.seconds);
    const tle = getAppropriateTLE(todayEphemera, playHeadISODate);

    //calculate lat long for timestamp of interest using mostRecentTLE as orbital starting point
    const playheadLatLonObj = getLatLngObj(tle, new Date(playHeadISODate).getTime());
    if (playheadMarker.markerNode.style.visibility === "hidden") {
      playheadMarker.markerNode.style.visibility = "visible";
    }
    playheadMarker.marker.setLngLat(playheadLatLonObj);

    //position hover marker
    if (playhead.hoverSeconds !== 0) {
      hoverMarker.markerNode.style.visibility = "visible";
      const hoverISODate = getPlayheadISOString(playhead.date, playhead.hoverSeconds);
      const tle = getAppropriateTLE(todayEphemera, hoverISODate);

      const hoverLatLonObj = getLatLngObj(tle, new Date(hoverISODate).getTime());
      hoverMarker.marker.setLngLat(hoverLatLonObj);

      updateTerminator(map, hoverISODate);
    } else {
      hoverMarker.markerNode.style.visibility = "hidden";
      //position playhead marker
      updateOrbitLine(map, playHeadISODate);
      updateTerminator(map, playHeadISODate);

      if (lockToggle) {
        map.panTo(playheadLatLonObj);
      }
    }
  }, [ephemera, playhead.date, playhead.seconds, playhead.hoverSeconds]);

  function initializeMap(
    setMap: Dispatch<SetStateAction<mapboxgl.Map>>,
    mapContainer: MutableRefObject<any>
  ) {
    const thisMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/bfeist/ckm6yjob22j6b17o79mq0tvr7", // satellite
      center: houstonLatLng, // starting position [lng, lat]
      zoom: 1, // starting zoom
      attributionControl: false,
      antialias: true,
    });

    thisMap.on("load", () => {
      // add terminator
      addTerminator(thisMap);

      // create playhead marker node
      addMapMarker(thisMap, "playheadMarker", setPlayheadMarker);
      // create hover marker node
      addMapMarker(thisMap, "hoverMarker", setHoverMarker);
      // add orbit path
      addOrbitLine(thisMap);

      thisMap.addControl(new mapboxgl.NavigationControl(), "top-right");
      setMap(thisMap);
      thisMap.resize();
    });
  }

  function addMapMarker(
    thisMap: any,
    typeName: string,
    setMarker: Dispatch<SetStateAction<MapMarker>>
  ) {
    const markerNode = document.createElement("div");
    markerNode.style.visibility = "hidden";
    const element = <Marker id={`${typeName}`} type={`${typeName}`} />;
    ReactDOM.render(element, markerNode);
    const marker = new mapboxgl.Marker(markerNode).setLngLat(houstonLatLng);
    marker.addTo(thisMap);
    setMarker({ marker: marker, markerNode: markerNode });
  }

  function addOrbitLine(thisMap: Map) {
    //part 1 always used
    thisMap.addSource("orbitLine1", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [],
        },
      },
    });

    //part 1 in case line crosses dateline
    thisMap.addSource("orbitLine2", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [],
        },
      },
    });

    thisMap.addLayer({
      id: "orbitLine1",
      type: "line",
      source: "orbitLine1",
      layout: {
        visibility: "visible",
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#ffc000",
        "line-width": 1.5,
      },
    });

    thisMap.addLayer({
      id: "orbitLine2",
      type: "line",
      source: "orbitLine2",
      layout: {
        visibility: "visible",
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#ffc000",
        "line-width": 1.5,
      },
    });
  }

  function updateOrbitLine(thisMap: Map, isoDate: string) {
    const secondsStart = -2000;
    const secondsEnd = 3800;
    const secondsStep = 10;

    const coordinates1 = [];
    const coordinates2 = [];
    let prevIncrement = -1;
    let prevLng = -1;

    let dateLineHit = false;
    let dateLineIncNum = 0;
    for (let i = secondsStart; i < secondsEnd; i = i + secondsStep) {
      const nextPosition = getNextPosition(isoDate, i, todayEphemera);

      let lngIncrement;
      let lngStepSize;
      if (prevLng !== -1) {
        lngIncrement = Math.abs(nextPosition.lng - prevLng);
        lngStepSize = Math.abs(lngIncrement - prevIncrement);
      }

      // if crossing date line, start drawing the second line
      // (this avoids a segment that wraps around the earth)
      if (prevIncrement !== -1 && lngStepSize > 100) {
        dateLineHit = true;
        dateLineIncNum = i;
        break;
      }
      coordinates1.push([nextPosition.lng, nextPosition.lat]);
      prevLng = nextPosition.lng;
      prevIncrement = lngIncrement;
    }

    // draw second line that continues across the date line if path crosses date line
    if (dateLineHit) {
      for (let i = dateLineIncNum; i < secondsEnd; i = i + secondsStep) {
        const nextPosition = getNextPosition(isoDate, i, todayEphemera);
        coordinates2.push([nextPosition.lng, nextPosition.lat]);
      }
    }

    // complex override due to typescript types not being correct in npm library
    const orbitLine1: mapboxgl.GeoJSONSource = thisMap.getSource(
      "orbitLine1"
    ) as mapboxgl.GeoJSONSource;
    orbitLine1.setData({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: coordinates1,
      },
    });

    // complex override due to typescript types not being correct in npm library
    const orbitLine2: mapboxgl.GeoJSONSource = thisMap.getSource(
      "orbitLine2"
    ) as mapboxgl.GeoJSONSource;
    orbitLine2.setData({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: coordinates2,
      },
    });
  }

  function addTerminator(thisMap: Map) {
    thisMap.addSource("terminator", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [],
        },
      },
    });

    thisMap.addLayer({
      id: "terminator",
      type: "fill",
      source: "terminator",
      layout: {},
      paint: {
        "fill-outline-color": "#888",
        "fill-color": "#000",
        "fill-opacity": 0.2,
      },
    });
  }

  function updateTerminator(thisMap: Map, isoDate: string) {
    const terminatorObj = new Terminator({ resolution: 1, time: new Date(isoDate) });
    const terminatorGeoJSON: FeatureCollection<
      Geometry,
      {
        [name: string]: any;
      }
    > = terminatorObj.getTerminator();

    // complex override due to typescript types not being correct in npm library
    const terminator: mapboxgl.GeoJSONSource = thisMap.getSource(
      "terminator"
    ) as mapboxgl.GeoJSONSource;
    terminator.setData(terminatorGeoJSON);
  }

  // toggle button display settings
  let lockButtonStyle = styles.toggleActive;
  if (lockToggle) {
    lockButtonStyle = styles.toggleSelected;
  }
  return (
    <>
      <div className={styles.container}>
        <div
          ref={mapContainer}
          className={styles.mapContainer}
          onMouseDown={() => {
            setLockToggle(false);
          }}
        ></div>
        <div className={styles.overlay}>
          <div
            className={`${styles.toggleButton} ${lockButtonStyle}`}
            title={`Click to toggle map scrolling in relation to ISS position`}
            onClick={() => {
              setLockToggle(!lockToggle);
            }}
          >
            Lock Map to ISS
          </div>
        </div>
      </div>
    </>
  );
}

type lngLat = {
  lng: number;
  lat: number;
};

function getNextPosition(isoDate: string, secondsInc: number, ephemera: Ephemeris[]): lngLat {
  const nextIncrementDate = new Date(isoDate);
  nextIncrementDate.setSeconds(nextIncrementDate.getSeconds() + secondsInc);
  const nextIncremenetDateISO = nextIncrementDate.toISOString();
  const tle = getAppropriateTLE(ephemera, nextIncremenetDateISO);
  const nextPosition = getLatLngObj(tle, new Date(nextIncremenetDateISO).getTime());
  return nextPosition;
}
