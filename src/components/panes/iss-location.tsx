import { useState, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction, MutableRefObject } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "store/index";
import { getAppropriateTLE } from "store/ephemera";
import { setPaneStateValue } from "store/framework";
import { getPlayheadISOString } from "utils/formatting";

import styles from "./iss-location.module.css";
import Marker from "./iss-location-marker";

import mapboxgl, { Map } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import Terminator from "utils/terminator";
import type { FeatureCollection, Geometry } from "geojson";
import { HelpButton } from "components/interface/pane-help-control-button";
import HelpOverlay from "components/interface/pane-help-overlay";

//tlejs not importable as per module docs
import { getLatLngObj } from "tle.js";
import _ from "lodash";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faLock, faLockOpen } from "@fortawesome/free-solid-svg-icons";
import { createRoot } from "react-dom/client";
library.add(faLock, faLockOpen);

type MapMarker = {
  marker: any; //the MapBox marker reference
  markerNode: any; //the real DOM id of the marker
};

export function ISSLocationControls(props: { frameID: number; frameDimensions: number[] }) {
  const frameID = props.frameID;
  const dispatch = useDispatch();

  const minWidth = 470;

  const paneStateData: LocationPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData
  );

  const buttonLength = props.frameDimensions[0] > minWidth ? styles.buttonLong : styles.buttonShort;
  let lockButtonSelected = "";
  if (typeof paneStateData !== "undefined" && paneStateData.lockMap) {
    lockButtonSelected = styles.lockButtonSelected;
  }
  return (
    <div className={styles.controls}>
      <div className={styles.controlsLeft}></div>
      <div className={styles.rightButtons}>
        <div className={styles.verticalCenter}>
          <button
            className={`${styles.lockButton} ${buttonLength} ${lockButtonSelected}`}
            title={`Click to toggle map scrolling in relation to ISS position`}
            onClick={() => {
              setPaneStateValue(dispatch, frameID, "lockMap", !paneStateData.lockMap);
            }}
          >
            <span className={styles.buttonLabel}>
              <div>{props.frameDimensions[0] > minWidth ? "Scroll" : ""}</div>
              <div>
                <FontAwesomeIcon icon={paneStateData.lockMap ? faLock : faLockOpen} size="sm" />
              </div>
            </span>
          </button>
        </div>
        <div className={styles.verticalCenter}>
          <HelpButton
            clickHandler={() => {
              setPaneStateValue(dispatch, frameID, "showHelp", !paneStateData.showHelp);
            }}
            selected={paneStateData.showHelp}
          />
        </div>
      </div>
    </div>
  );
}

export function ISSLocation(props: { frameID: number; frameDimensions: number[] }) {
  const frameID = props.frameID;
  const dispatch = useDispatch();

  const initialMarker: MapMarker = {
    marker: null,
    markerNode: null,
  };

  const ephemera: EphemeraState = useSelector((state: RootState) => state.ephemera);
  const playheadHover: PlayheadHoverState = useSelector((state: RootState) => state.playheadHover);
  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);
  const layoutLastChanged = useSelector((state: RootState) => state.framework.layoutLastChanged);
  const paneStateData: LocationPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData
  );
  const todayEphemera = ephemera.ephemerisFiles;

  const [map, setMap] = useState<Map>(null);
  const [playheadMarker, setPlayheadMarker] = useState(initialMarker);
  const [hoverMarker, setHoverMarker] = useState(initialMarker);

  const mapContainer = useRef(null);

  //just need any location for getSatelliteInfo
  const houstonLatLng = {
    lng: -95.3698,
    lat: 29.7604,
  };

  //init map app
  useEffect(() => {
    mapboxgl.accessToken = import.meta.env.VITE_PUBLIC_MAPBOX_KEY;
    if (!map) initializeMap(setMap, mapContainer);
  }, [map]);

  //redraw the map when the frame dimension change due to window resize or a layout change
  useEffect(() => {
    if (map) {
      map.resize();
    }
  }, [props.frameDimensions, layoutLastChanged]);

  //update map based on changes in seconds / hoverSeconds
  useEffect(() => {
    if (!map || !playhead.date || todayEphemera?.length === 0) {
      return;
    }

    const playHeadISODate = getPlayheadISOString(playhead.date, playhead.seconds);
    const tle = getAppropriateTLE(todayEphemera, playHeadISODate);

    //calculate lat long for timestamp of interest using mostRecentTLE as orbital starting point
    const playheadLatLonObj = getLatLngObj(tle, new Date(playHeadISODate).getTime());
    if (playheadMarker.markerNode.style.visibility === "hidden") {
      playheadMarker.markerNode.style.visibility = "visible";
    }
    if (!_.isNaN(playheadLatLonObj.lat) && !_.isNaN(playheadLatLonObj.lng)) {
      playheadMarker.marker.setLngLat(playheadLatLonObj);
    }

    //position hover marker
    if (playheadHover.seconds !== 0) {
      hoverMarker.markerNode.style.visibility = "visible";
      const hoverISODate = getPlayheadISOString(playhead.date, playheadHover.seconds);
      const tle = getAppropriateTLE(todayEphemera, hoverISODate);

      const hoverLatLonObj = getLatLngObj(tle, new Date(hoverISODate).getTime());
      if (!_.isNaN(hoverLatLonObj.lat) && !_.isNaN(hoverLatLonObj.lng)) {
        hoverMarker.marker.setLngLat(hoverLatLonObj);
      }

      updateTerminator(map, hoverISODate);
    } else {
      hoverMarker.markerNode.style.visibility = "hidden";
      //position playhead marker
      updateOrbitLine(map, playHeadISODate);
      updateTerminator(map, playHeadISODate);

      if (paneStateData.lockMap) {
        if (!_.isNaN(playheadLatLonObj.lat) && !_.isNaN(playheadLatLonObj.lng)) {
          map.panTo(playheadLatLonObj);
        }
      }
    }
  }, [ephemera, playhead.date, playhead.seconds, playheadHover.seconds]);

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
    const root = createRoot(markerNode);
    const element = <Marker id={`${typeName}`} type={`${typeName}`} />;
    root.render(element);
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
  return (
    <>
      <div className={styles.container}>
        <div
          ref={mapContainer}
          className={styles.mapContainer}
          onMouseDown={() => {
            setPaneStateValue(dispatch, frameID, "lockMap", false);
          }}
        ></div>
        <HelpOverlay
          isModalOpen={paneStateData.showHelp}
          closeHandler={() => {
            setPaneStateValue(dispatch, frameID, "showHelp", !paneStateData.showHelp);
          }}
        >
          <div>
            <p>
              Displays the ISS position as a red "X" at the current CODA time on an interactive map.
              The map shows a yellow line representing the orbit of the ISS immediately surrounding
              the current CODA time. The map is shaded to indicate the terminator shadow on the
              Earth. Hovering over the CODA timeline will show a white "X" indicating where the ISS
              will be at the hovered CODA time.
            </p>
            <p>
              ISS Location, along with insolation/eclipse, is calculated using orbital ephemeris
              data retrieved from an external data source.{" "}
            </p>
            <p></p>
          </div>
        </HelpOverlay>
      </div>
    </>
  );
}

type lngLat = {
  lng: number;
  lat: number;
};

function getNextPosition(isoDate: string, secondsInc: number, ephemera: EphemerisFile[]): lngLat {
  const incrementDate = new Date(isoDate).valueOf();
  const nextIncrementDate = new Date(incrementDate + secondsInc * 1000);
  const nextIncremenetDateISO = nextIncrementDate.toISOString();
  const tle = getAppropriateTLE(ephemera, nextIncremenetDateISO);
  const nextPosition = getLatLngObj(tle, new Date(nextIncremenetDateISO).getTime());
  return nextPosition;
}
