import _ from "lodash";
import { useState, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction, MutableRefObject } from "react";
import { useDispatch, useSelector } from "react-redux";
import ReactDOM from "react-dom";
import deepEqual from "lodash/isEqual";
import { RootState } from "store/index";
import { getPlayheadISOString, isoStringFromAnyDateString } from "utils/formatting";

import styles from "./gps-location.module.css";
import TEMarker from "./gps-location-marker";

import mapboxgl, { LngLatLike, Map } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import type { FeatureCollection } from "geojson";
import type { Point } from "gpxparser";
import { setPaneStateValue } from "store/framework";
import { HelpButton } from "components/interface/pane-help-control-button";
import HelpOverlay from "components/interface/pane-help-overlay";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faLock, faLockOpen } from "@fortawesome/free-solid-svg-icons";
library.add(faLock, faLockOpen);

export function GPSLocationControls(props: { frameID: number }) {
  const frameID = props.frameID;
  const dispatch = useDispatch();

  const paneStateData: LocationPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData
  );

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
            className={`${styles.lockButton} ${lockButtonSelected}`}
            title={`Click to toggle map scrolling in relation to GPS position`}
            onClick={() => {
              setPaneStateValue(dispatch, frameID, "lockMap", !paneStateData.lockMap);
            }}
          >
            <span className={styles.buttonLabel}>
              <div>Scroll</div>
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

export default function GPSLocation(props: { frameID: number; frameDimensions: number[] }) {
  const frameID = props.frameID;
  const dispatch = useDispatch();

  const initialMarker: MapMarker = {
    marker: null,
    markerNode: null,
  };

  const initialMarkers: MapMarkers = {
    EV1: { ...initialMarker },
    EV2: { ...initialMarker },
    Cart: { ...initialMarker },
    LightCart: { ...initialMarker },
    RUN1: { ...initialMarker },
    RUN2: { ...initialMarker },
    RUN3: { ...initialMarker },
  };

  const initialTrackFeature: FeatureCollection = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [],
        },
        properties: {},
      },
    ],
  };

  let trackFeatures: TrackFeatures = {
    EV1: { ...initialTrackFeature },
    EV2: { ...initialTrackFeature },
    Cart: { ...initialTrackFeature },
    LightCart: { ...initialTrackFeature },
    RUN1: { ...initialTrackFeature },
    RUN2: { ...initialTrackFeature },
    RUN3: { ...initialTrackFeature },
  };

  const playheadHover: PlayheadHoverState = useSelector((state: RootState) => state.playheadHover);
  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);
  const gpsState: GPSState = useSelector((state: RootState) => state.gps, deepEqual);
  const layoutLastChanged = useSelector((state: RootState) => state.framework.layoutLastChanged);
  const paneStateData: LocationPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData
  );
  const mapContainer = useRef(null);

  const [map, setMap] = useState<Map>(null);
  const [mapMarkers, setMapMarkers] = useState(initialMarkers);
  const [eventType, setEventType] = useState<"DRATS" | "GANDALF">("DRATS");

  const infoItemsDefaultValue = {
    lat: "",
    lng: "",
    ele: "",
    hdg: "",
    slope: "",
    date: "",
    time: "",
  };
  const [infoDisplay, setInfoDisplay] = useState<MapInfoDisplay>({
    EV1: infoItemsDefaultValue,
    EV2: infoItemsDefaultValue,
    Cart: infoItemsDefaultValue,
    LightCart: infoItemsDefaultValue,
    RUN1: infoItemsDefaultValue,
    RUN2: infoItemsDefaultValue,
    RUN3: infoItemsDefaultValue,
  });

  //just need any location for getSatelliteInfo
  const houstonLatLng = {
    lng: -95.3698,
    lat: 29.7604,
  };

  //init map app
  useEffect(() => {
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_KEY;

    if (!map) initializeMap(setMap, mapContainer);
  }, [map]);

  //redraw the map when the frame dimension change due to window resize or a layout change
  useEffect(() => {
    if (map) {
      map.resize();
    }
  }, [props.frameDimensions, layoutLastChanged]);

  //update map GPS markers
  useEffect(() => {
    if (!map || !playhead.date || gpsState.gpsTracks.length === 0) return;

    if (map.getZoom() === 1) {
      map.setZoom(15);
      // map.setPitch(45);
    }

    // set eventType to DRATS if EV1 is present, set as GANDALF if RUN1 is present
    if (gpsState.gpsTracks.filter((track) => track.name === "EV1").length > 0) {
      setEventType("DRATS");
    } else if (gpsState.gpsTracks.filter((track) => track.name === "RUN1").length > 0) {
      setEventType("GANDALF");
    }

    // hide all markers
    for (var key in mapMarkers) {
      const marker = mapMarkers[key];
      marker.markerNode.style.visibility = "hidden";
    }

    const gpsTracks = gpsState.gpsTracks;

    const playHeadISODate = getPlayheadISOString(playhead.date, playhead.seconds);
    //loop through the gps track objects (EV1, EV2, and Cart)
    for (let track = 0; track < gpsTracks.length; track++) {
      let markerGPSPoint: Point = null;

      // make visible the marker for the current track
      mapMarkers[gpsTracks[track].name].markerNode.style.visibility = "visible";

      let markerIndex = 0;
      // If not hovering move the markers to the playheadTime
      if (playheadHover.seconds === 0) {
        //Look for the point in each GPS track closest to the playheadTime
        for (let i = 0; i < gpsTracks[track].points.length; i++) {
          if (gpsTracks[track].points[i].time.toString() > playHeadISODate) {
            if (i > 0) {
              markerIndex = i - 1;
            }
            break;
          }
        }
      } else {
        //if mousing over the timeline and hovering move markers to hover time point
        //Look for the point in each GPS track closest to the hover time
        const playHeadhoverISODate = getPlayheadISOString(playhead.date, playheadHover.seconds);
        for (let i = 0; i < gpsTracks[track].points.length; i++) {
          if (gpsTracks[track].points[i].time.toString() > playHeadhoverISODate) {
            if (i > 0) {
              markerIndex = i - 1;
            }
            break;
          }
        }
      }
      //save the found track point
      markerGPSPoint = gpsTracks[track].points[markerIndex];

      //move the marker to the found point
      mapMarkers[gpsTracks[track].name].marker.setLngLat([markerGPSPoint.lon, markerGPSPoint.lat]);

      //update infoDisplay
      const timestampArr = (
        isoStringFromAnyDateString(markerGPSPoint.time.toString()).split(".")[0] + "Z"
      ).split("T");

      try {
        const items: mapInfoDisplayItems = {
          lat: markerGPSPoint.lat.toFixed(6),
          lng: markerGPSPoint.lon.toFixed(6),
          ele: markerGPSPoint.ele.toFixed(2).toString(),
          slope: !_.isNil(gpsTracks[track].slopes[markerIndex])
            ? gpsTracks[track].slopes[markerIndex].toFixed(3).toString()
            : "",
          date: timestampArr[0],
          time: timestampArr[1],
          hdg: "",
        };
        const tempInfo = infoDisplay;
        tempInfo[gpsTracks[track].name] = items;
        setInfoDisplay(tempInfo);
      } catch (error) {
        console.log("Info display error: ", error);
      }
    }

    if (paneStateData.lockMap) {
      // check if there is an EV1 value in store. If so, we're tracking DRATS so track EV1.
      if (eventType === "DRATS") {
        map.panTo(mapMarkers.EV1.marker.getLngLat());
        // check if there is an RUN1 value in store. If so, we're tracking Gandalf's Staff so track RUN1.
      } else if (eventType === "GANDALF") {
        map.panTo(mapMarkers.RUN1.marker.getLngLat());
      } else {
        map.panTo(houstonLatLng);
      }
    }
  }, [map, playhead.date, playhead.seconds, playheadHover.seconds, gpsState.gpsTracks]);

  //Display GPS tracks on map
  useEffect(() => {
    if (!map) return;

    const gpsTracks = gpsState.gpsTracks;
    // Set a delay to get around buggy mapbox not dealing with sources properly
    setTimeout(() => {
      //loop through the gps track objects (EV1, EV2, Cart, and LightCart)
      for (let track = 0; track < gpsTracks.length; track++) {
        const gpsTrack = gpsTracks[track];
        const newCoordinates: LngLatLike[] = [];
        for (let x = 0; x < gpsTrack.points.length; x++) {
          const thisCoordinate: LngLatLike = [gpsTrack.points[x].lon, gpsTrack.points[x].lat];
          newCoordinates.push(thisCoordinate);
        }

        const trackName = gpsTrack.name;
        trackFeatures[trackName].features[0].geometry.coordinates = newCoordinates;

        // @ts-ignore: bad mapbox typing
        map.getSource(`track${trackName}Source`).setData(trackFeatures[trackName]);
      }
    }, 500);
  }, [map, gpsState.gpsTracks]);

  function addMapSources(thisMap: mapboxgl.Map) {
    thisMap.addSource("trackEV1Source", {
      type: "geojson",
      data: trackFeatures.EV1,
    });
    thisMap.addSource("trackEV2Source", {
      type: "geojson",
      data: trackFeatures.EV2,
    });
    thisMap.addSource("trackCartSource", {
      type: "geojson",
      data: trackFeatures.Cart,
    });
    thisMap.addSource("trackLightCartSource", {
      type: "geojson",
      data: trackFeatures.Cart,
    });
    thisMap.addSource("trackRUN1Source", {
      type: "geojson",
      data: trackFeatures.RUN1,
    });
    thisMap.addSource("trackRUN2Source", {
      type: "geojson",
      data: trackFeatures.RUN2,
    });
    thisMap.addSource("trackRUN3Source", {
      type: "geojson",
      data: trackFeatures.RUN3,
    });
  }

  function addMapLayers(thisMap: mapboxgl.Map) {
    thisMap.addLayer({
      id: "trackEV1Layer",
      type: "line",
      source: "trackEV1Source",
      paint: {
        "line-color": "red",
        "line-opacity": 0.3,
        "line-width": 4,
      },
    });

    thisMap.addLayer({
      id: "trackEV2Layer",
      type: "line",
      source: "trackEV2Source",
      paint: {
        "line-color": "blue",
        "line-opacity": 0.3,
        "line-width": 4,
      },
    });

    thisMap.addLayer({
      id: "trackCartLayer",
      type: "line",
      source: "trackCartSource",
      paint: {
        "line-color": "black",
        "line-opacity": 0.3,
        "line-width": 2,
      },
    });

    thisMap.addLayer({
      id: "trackLightCartLayer",
      type: "line",
      source: "trackLightCartSource",
      paint: {
        "line-color": "yellow",
        "line-opacity": 0.3,
        "line-width": 2,
      },
    });

    thisMap.addLayer({
      id: "trackRun1Layer",
      type: "line",
      source: "trackRUN1Source",
      paint: {
        "line-color": "red",
        "line-opacity": 0.3,
        "line-width": 2,
      },
    });

    thisMap.addLayer({
      id: "trackRun2Layer",
      type: "line",
      source: "trackRUN2Source",
      paint: {
        "line-color": "blue",

        "line-opacity": 0.3,
        "line-width": 2,
      },
    });
    thisMap.addLayer({
      id: "trackRun3Layer",
      type: "line",
      source: "trackRUN3Source",
      paint: {
        "line-color": "orange",
        "line-opacity": 0.3,
        "line-width": 2,
      },
    });
  }

  function initializeMap(
    setMap: Dispatch<SetStateAction<mapboxgl.Map>>,
    mapContainer: MutableRefObject<any>
  ) {
    const thisMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/bfeist/ckm6yjob22j6b17o79mq0tvr7", // satellite
      // style: "mapbox://styles/bfeist/ckv9vbn5lakyz15qf3ps2f2uo", // outdoors
      center: houstonLatLng, // starting position [lng, lat]
      zoom: 1, // starting zoom
      attributionControl: false,
      antialias: true,
    });

    thisMap.on("load", () => {
      const newMarkers: MapMarkers = {
        EV1: addMapMarker(thisMap, "EV1"),
        EV2: addMapMarker(thisMap, "EV2"),
        Cart: addMapMarker(thisMap, "cart"),
        LightCart: addMapMarker(thisMap, "LightCart"),
        RUN1: addMapMarker(thisMap, "RUN1"),
        RUN2: addMapMarker(thisMap, "RUN2"),
        RUN3: addMapMarker(thisMap, "RUN3"),
      };
      setMapMarkers(newMarkers);

      addMapSources(thisMap);
      addMapLayers(thisMap);

      thisMap.addControl(new mapboxgl.NavigationControl(), "top-right");
      thisMap.addControl(new mapboxgl.ScaleControl(), "top-left");
      setMap(thisMap);
      thisMap.resize();
    });
  }

  function addMapMarker(thisMap: any, typeName: string): MapMarker {
    const markerNode = document.createElement("div");
    markerNode.style.visibility = "hidden";
    const element = <TEMarker id={`${typeName}`} type={`${typeName}`} />;
    ReactDOM.render(element, markerNode);
    const marker = new mapboxgl.Marker(markerNode).setLngLat(houstonLatLng);
    marker.addTo(thisMap);
    return { marker: marker, markerNode: markerNode };
  }

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
        {gpsState.gpsTracks.length > 0 ? showInfo() : <></>}
        <HelpOverlay
          isModalOpen={paneStateData.showHelp}
          closeHandler={() => {
            setPaneStateValue(dispatch, frameID, "showHelp", !paneStateData.showHelp);
          }}
        >
          <div>
            <p>
              Displays GPS tracks stored in the{" "}
              <a
                href={"https://wiki.jsc.nasa.gov/exploration/index.php/CODA/D-RATS_2021_Data"}
                target={"_blank"}
              >
                Exploration Wiki
              </a>{" "}
              for test events on an interactive map. Hovering over the CODA timeline will move the
              GPS subjects to their corresponding positions for that time.
            </p>
            <p>GPS track types include EV1, EV2, Tool Cart, and Light Cart.</p>
            <p>
              Currently the only GPS data events available are for the 2021 D-RATS activites, such
              as{" "}
              <a href={"https://coda.fit.nasa.gov/view?v=2.0&date=2021-10-21&gmt=04:13:20"}>
                this one
              </a>
              .
            </p>
          </div>
        </HelpOverlay>
      </div>
    </>
  );

  function showInfo() {
    return (
      <>
        <div className={`${styles.info} ${eventType === "GANDALF" ? styles.info_wider : ""}`}>
          <div className={styles.infoSection}>
            <table className={styles.valueTable}>
              <tbody>
                <tr>
                  <td></td>
                  <td>
                    <div className={styles.infoSectionTitle}>
                      <div>
                        <strong>{eventType === "DRATS" ? "EV1" : "RUN1"}</strong>
                      </div>
                      <div>
                        <img
                          className="infoSectionTitleIcon"
                          src="/images/marker_ev1.png"
                          width="30px"
                        />
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className={styles.infoSectionTitle}>
                      <div>
                        <strong>{eventType === "DRATS" ? "EV2" : "RUN2"}</strong>
                      </div>
                      <div>
                        <img
                          className="infoSectionTitleIcon"
                          src="/images/marker_ev2.png"
                          width="30px"
                        />
                      </div>
                    </div>
                  </td>
                  {eventType === "GANDALF" && (
                    <td>
                      <div className={styles.infoSectionTitle}>
                        <div>
                          <strong>{"RUN3"}</strong>
                        </div>
                        <div>
                          <img
                            className="infoSectionTitleIcon"
                            src="/images/marker_ev3.png"
                            width="30px"
                          />
                        </div>
                      </div>
                    </td>
                  )}
                </tr>
                <tr>
                  <td>Latitude:</td>
                  <td>{eventType === "DRATS" ? infoDisplay.EV1.lat : infoDisplay.RUN1.lat}</td>
                  <td>{eventType === "DRATS" ? infoDisplay.EV2.lat : infoDisplay.RUN2.lat}</td>
                  {eventType === "GANDALF" && <td>{infoDisplay.RUN3.lat}</td>}
                </tr>
                <tr>
                  <td>Longitude:</td>
                  <td>{eventType === "DRATS" ? infoDisplay.EV1.lng : infoDisplay.RUN1.lng}</td>
                  <td>{eventType === "DRATS" ? infoDisplay.EV2.lng : infoDisplay.RUN2.lng}</td>
                  {eventType === "GANDALF" && <td>{infoDisplay.RUN3.lng}</td>}
                </tr>
                <tr>
                  <td>Elevation (m):</td>
                  <td>{eventType === "DRATS" ? infoDisplay.EV1.ele : infoDisplay.RUN1.ele}</td>
                  <td>{eventType === "DRATS" ? infoDisplay.EV2.ele : infoDisplay.RUN2.ele}</td>
                  {eventType === "GANDALF" && <td>{infoDisplay.RUN3.ele}</td>}
                </tr>
                {/* <tr>
                  <td>Slope:</td>
                  <td>{eventType === "DRATS" ? infoDisplay.EV1.slope : infoDisplay.RUN1.slope}</td>
                  <td>{eventType === "DRATS" ? infoDisplay.EV2.slope : infoDisplay.RUN2.slope}</td>
                  {eventType === "GANDALF" && <td>{infoDisplay.RUN3.slope}</td>}
                </tr> */}
                <tr>
                  <td>Timestamp:</td>
                  <td>
                    {eventType === "DRATS" ? infoDisplay.EV1.date : infoDisplay.RUN1.date}
                    <br />
                    {eventType === "DRATS" ? infoDisplay.EV1.time : infoDisplay.RUN1.time}
                  </td>
                  <td>
                    {eventType === "DRATS" ? infoDisplay.EV2.date : infoDisplay.RUN2.date}
                    <br />
                    {eventType === "DRATS" ? infoDisplay.EV2.time : infoDisplay.RUN2.time}
                  </td>
                  {eventType === "GANDALF" && (
                    <td>
                      {infoDisplay.RUN3.date}
                      <br />
                      {infoDisplay.RUN3.time}
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }
}
