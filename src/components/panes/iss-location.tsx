import { useEffect, useRef, useState } from "react";
import type { MutableRefObject, FunctionComponent } from "react";
import { deepEqual, refEqual, useAppSelector } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import { getAppropriateTLE } from "store/ephemera";
import { setPaneStateValue } from "store/framework";
import { getPlayheadISOString } from "utils/formatting";

import styles from "./iss-location.module.css";
import Marker from "./iss-location-marker";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import mapStyle from "./protomaps-theme.json";

import Terminator from "utils/terminator";
import type { FeatureCollection, Geometry } from "geojson";
import { HelpButton } from "components/interface/pane-help-control-button";
import HelpOverlay from "components/interface/pane-help-overlay";

//tlejs not importable as per module docs
import { getLatLngObj } from "tle.js";
import isNaN from "lodash/isNaN";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock, faLockOpen } from "@fortawesome/free-solid-svg-icons";
import { createRoot } from "react-dom/client";
import ClockInterval from "components/framework/ClockInterval";

type MapMarker = {
  marker: any; //the MapBox marker reference
  markerNode: any; //the real DOM id of the marker
};

export const ISSLocationControls: FunctionComponent<{
  frameID: number;
  frameDimensions: number[];
}> = ({ frameID, frameDimensions }) => {
  const dispatch = useAppDispatch();

  const minWidth = 470;

  const paneStateData: LocationPaneStateData = useAppSelector(
    (state) => state.framework.frames[frameID].paneStateData,
    deepEqual
  );

  const buttonLength = frameDimensions[0] > minWidth ? styles.buttonLong : styles.buttonShort;
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
            {frameDimensions[0] > minWidth ? (
              <span className={styles.buttonLabel}>
                <div>{frameDimensions[0] > minWidth ? "Scroll" : ""}</div>
                <div>
                  <FontAwesomeIcon icon={paneStateData.lockMap ? faLock : faLockOpen} size="sm" />
                </div>
              </span>
            ) : (
              <FontAwesomeIcon icon={paneStateData.lockMap ? faLock : faLockOpen} size="sm" />
            )}
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
};

export const ISSLocation: FunctionComponent<{ frameID: number; frameDimensions: number[] }> = ({
  frameID,
  frameDimensions,
}) => {
  const dispatch = useAppDispatch();

  const initialMarker: MapMarker = {
    marker: null,
    markerNode: null,
  };

  const ephemera: EphemeraState = useAppSelector((state) => state.ephemera, deepEqual);
  const layoutLastChanged = useAppSelector((state) => state.framework.layoutLastChanged, refEqual);
  const paneStateData: LocationPaneStateData = useAppSelector(
    (state) => state.framework.frames[frameID].paneStateData,
    deepEqual
  );
  const todayEphemera = ephemera.ephemerisFiles;

  const mapRef = useRef<maplibregl.Map>(null);
  const playheadMarkerRef = useRef<MapMarker>(initialMarker);
  const hoverMarkerRef = useRef<MapMarker>(initialMarker);

  // Clock state from Redux
  const playheadDate = useAppSelector((state) => state.clock.date, refEqual);
  const hoverSeconds = useAppSelector((state) => state.clock.hoverSeconds, refEqual);
  const [appSeconds, setLocalAppSeconds] = useState(0);

  const mapContainer = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false); // Added state to track map load

  //just need any location for getSatelliteInfo
  const houstonLatLng = {
    lng: -95.3698,
    lat: 29.7604,
  };

  //init map app
  useEffect(() => {
    if (!mapRef.current) initializeMap(mapContainer);
  }, [mapRef.current]);

  //redraw the map when the frame dimension change due to window resize or a layout change
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.resize();
    }
  }, [frameDimensions, layoutLastChanged]);

  //update map based on changes in seconds / hoverSeconds only after map loading
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !playheadDate || todayEphemera?.length === 0) return;

    const playHeadISODate = getPlayheadISOString(playheadDate, appSeconds);
    const tle = getAppropriateTLE(todayEphemera, playHeadISODate);

    const playheadLatLonObj = getLatLngObj(tle, new Date(playHeadISODate).getTime());
    if (playheadMarkerRef.current.markerNode) {
      playheadMarkerRef.current.markerNode.style.visibility = "visible";
    }
    if (!isNaN(playheadLatLonObj.lat) && !isNaN(playheadLatLonObj.lng)) {
      playheadMarkerRef.current.marker.setLngLat(playheadLatLonObj);
    }

    if (hoverSeconds) {
      hoverMarkerRef.current.markerNode.style.visibility = "visible";
      const hoverISODate = getPlayheadISOString(playheadDate, hoverSeconds);
      const hoverTle = getAppropriateTLE(todayEphemera, hoverISODate);

      const hoverLatLonObj = getLatLngObj(hoverTle, new Date(hoverISODate).getTime());
      if (!isNaN(hoverLatLonObj.lat) && !isNaN(hoverLatLonObj.lng)) {
        hoverMarkerRef.current.marker.setLngLat(hoverLatLonObj);
      }

      updateTerminator(mapRef.current, hoverISODate);
    } else {
      hoverMarkerRef.current.markerNode.style.visibility = "hidden";
    }

    updateOrbitLine(mapRef.current, playHeadISODate);
    updateTerminator(mapRef.current, playHeadISODate);

    if (paneStateData.lockMap) {
      if (!isNaN(playheadLatLonObj.lat) && !isNaN(playheadLatLonObj.lng)) {
        mapRef.current.panTo(playheadLatLonObj);
      }
    }
  }, [ephemera, playheadDate, appSeconds, hoverSeconds, mapLoaded]);

  function initializeMap(mapContainer: MutableRefObject<HTMLDivElement>) {
    mapContainer.current.innerHTML = ""; // Clear the container

    let protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);

    const maplibreBaseUrl = import.meta.env.VITE_PUBLIC_MAPLIBRE_BASE_URL;
    const pmtilesFilename = import.meta.env.VITE_PUBLIC_MAPLIBRE_PMTILES_FILENAME;

    const overrideStyle = {
      ...mapStyle,
      sources: {
        protomaps: {
          type: "vector",
          url: `pmtiles://${maplibreBaseUrl}/${pmtilesFilename}`,
        },
      },
      sprite: `${maplibreBaseUrl}/basemaps-assets-main/sprites/v4/light`,
      glyphs: `${maplibreBaseUrl}/basemaps-assets-main/fonts/{fontstack}/{range}.pbf`,
      layers:
        mapStyle.layers?.map((layer) =>
          layer.id === "background"
            ? { ...layer, paint: { ...layer.paint, "background-color": "rgba(0,0,0,0)" } }
            : layer
        ) || [],
    };

    const thisMap = new maplibregl.Map({
      container: mapContainer.current,
      style: overrideStyle as any,
      center: houstonLatLng,
      zoom: 2,
      attributionControl: false,
    });

    thisMap.on("load", () => {
      // add terminator
      addTerminator(thisMap);

      // create playhead marker node
      addMapMarker(thisMap, "playheadMarker", playheadMarkerRef);
      // create hover marker node
      addMapMarker(thisMap, "hoverMarker", hoverMarkerRef);
      // add orbit path
      addOrbitLine(thisMap);

      // thisMap.addControl(new maplibregl.NavigationControl(), "top-right");
      mapRef.current = thisMap;
      setMapLoaded(true); // Mark map as loaded
      thisMap.resize();
    });
  }

  function addMapMarker(
    thisMap: maplibregl.Map,
    typeName: string,
    markerRef: MutableRefObject<MapMarker>
  ) {
    const markerNode = document.createElement("div");
    markerNode.style.visibility = "hidden";
    const root = createRoot(markerNode);
    const element = <Marker id={`${typeName}`} type={`${typeName}`} />;
    root.render(element);
    const marker = new maplibregl.Marker({
      element: markerNode,
    }).setLngLat(houstonLatLng);
    marker.addTo(thisMap);
    markerRef.current = { marker: marker, markerNode: markerNode };
  }

  function addOrbitLine(thisMap: maplibregl.Map) {
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

  function updateOrbitLine(thisMap: maplibregl.Map, isoDate: string) {
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
    const orbitLine1: maplibregl.GeoJSONSource = thisMap.getSource(
      "orbitLine1"
    ) as maplibregl.GeoJSONSource;
    orbitLine1.setData({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: coordinates1,
      },
    });

    // complex override due to typescript types not being correct in npm library
    const orbitLine2: maplibregl.GeoJSONSource = thisMap.getSource(
      "orbitLine2"
    ) as maplibregl.GeoJSONSource;
    orbitLine2.setData({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: coordinates2,
      },
    });
  }

  function addTerminator(thisMap: maplibregl.Map) {
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

  function updateTerminator(thisMap: maplibregl.Map, isoDate: string) {
    const terminatorObj = new Terminator({ resolution: 1, time: new Date(isoDate) });
    const terminatorGeoJSON: FeatureCollection<
      Geometry,
      {
        [name: string]: any;
      }
    > = terminatorObj.getTerminator();

    // complex override due to typescript types not being correct in npm library
    const terminator: maplibregl.GeoJSONSource = thisMap.getSource(
      "terminator"
    ) as maplibregl.GeoJSONSource;
    terminator.setData(terminatorGeoJSON);
  }

  // toggle button display settings
  return (
    <div className={styles.container}>
      <ClockInterval setAppSeconds={setLocalAppSeconds} />
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
            the current CODA time. The map is shaded to indicate the terminator shadow on the Earth.
            Hovering over the CODA timeline will show a white "X" indicating where the ISS will be
            at the hovered CODA time.
          </p>
          <p>
            ISS Location, along with insolation/eclipse, is calculated using orbital ephemeris data
            retrieved from an external data source.{" "}
          </p>
          <p></p>
        </div>
      </HelpOverlay>
    </div>
  );
};

type lngLat = {
  lng: number;
  lat: number;
};

function getNextPosition(isoDate: string, secondsInc: number, ephemera: EphemerisEntry[]): lngLat {
  const incrementDate = new Date(isoDate).valueOf();
  const nextIncrementDate = new Date(incrementDate + secondsInc * 1000);
  const nextIncremenetDateISO = nextIncrementDate.toISOString();
  const tle = getAppropriateTLE(ephemera, nextIncremenetDateISO);
  const nextPosition = getLatLngObj(tle, new Date(nextIncremenetDateISO).getTime());
  return nextPosition;
}
