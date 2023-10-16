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
import { setPaneStateValue } from "store/framework";
import { HelpButton } from "components/interface/pane-help-control-button";
import HelpOverlay from "components/interface/pane-help-overlay";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faLock, faLockOpen } from "@fortawesome/free-solid-svg-icons";
import Button from "components/interface/button";
library.add(faLock, faLockOpen);

export function GPSLocationControls(props: { frameID: number }) {
  const frameID = props.frameID;
  const dispatch = useDispatch();

  const paneStateData: GpsTrackPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData
  );

  const gpsTracks = useSelector((state: RootState) => state.gps.gpsTracks);

  let lockButtonSelected = "";
  if (typeof paneStateData !== "undefined" && paneStateData.lockMap) {
    lockButtonSelected = styles.lockButtonSelected;
  }

  return (
    <div className={styles.controls}>
      <div className={styles.controlsLeft}>
        <div className={styles.selections}>
          {gpsTracks.map((track, index) => {
            let rounded = "none";
            if (index === 0) {
              rounded = "left";
            } else if (index === gpsTracks.length - 1) {
              rounded = "right";
            }

            const color = paneStateData.gpsTrackToggles[track.name]
              ? "active_selected"
              : "disabled";

            return (
              <Button
                key={"DLBUTTON_" + track.name + "_" + frameID}
                color={color}
                size="medium"
                rounded={rounded}
                callback={() => {
                  const onOff = !paneStateData.gpsTrackToggles[track.name];

                  const newTogglesData = { ...paneStateData.gpsTrackToggles, [track.name]: onOff };

                  setPaneStateValue(dispatch, frameID, "gpsTrackToggles", newTogglesData);
                }}
              >
                <div className={styles.dlLabel}>{track.name}</div>
              </Button>
            );
          })}
        </div>
      </div>
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
    EV3: { ...initialMarker },
    EV4: { ...initialMarker },
    Cart: { ...initialMarker },
    LightCart: { ...initialMarker },
    Staff: { ...initialMarker },
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
    EV3: { ...initialTrackFeature },
    EV4: { ...initialTrackFeature },
    Cart: { ...initialTrackFeature },
    LightCart: { ...initialTrackFeature },
    Staff: { ...initialTrackFeature },
  };

  const playheadHover: PlayheadHoverState = useSelector((state: RootState) => state.playheadHover);
  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);
  const gpsState: GPSState = useSelector((state: RootState) => state.gps, deepEqual);
  const layoutLastChanged = useSelector((state: RootState) => state.framework.layoutLastChanged);
  const paneStateData: GpsTrackPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData
  );
  const mapContainer = useRef(null);

  const [map, setMap] = useState<Map>(null);
  const [mapMarkers, setMapMarkers] = useState(initialMarkers);
  const [eventType, setEventType] = useState<"DRATS" | "GANDALF">("DRATS");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [sortedEnabledTracks, setSortedEnabledTracks] = useState<string[]>([]);

  const infoItemsDefaultValue: MapInfoDisplayItems = {
    lat: "",
    lng: "",
    ele: "",
    hdg: "",
    date: "",
    time: "",
  };
  const [infoDisplay, setInfoDisplay] = useState<MapInfoDisplay>({
    EV1: infoItemsDefaultValue,
    EV2: infoItemsDefaultValue,
    EV3: infoItemsDefaultValue,
    EV4: infoItemsDefaultValue,
    Cart: infoItemsDefaultValue,
    LightCart: infoItemsDefaultValue,
    Staff: infoItemsDefaultValue,
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

  useEffect(() => {
    if (!map) return;
    map.setZoom(zoomLevel);
  }, [map, zoomLevel]);

  //update map GPS markers and tracks
  useEffect(() => {
    if (!map || !playhead.date || gpsState.gpsTracks.length === 0) return;

    // if (map.getZoom() === 1) {
    //   map.setZoom(15);
    // }

    // set eventType to DRATS if EV1 is present, set as GANDALF if Staff is present
    if (gpsState.gpsTracks.filter((track) => track.name === "EV1").length > 0) {
      setEventType("DRATS");
    } else if (gpsState.gpsTracks.filter((track) => track.name === "Staff").length > 0) {
      setEventType("GANDALF");
    }

    // hide all markers
    for (var key in mapMarkers) {
      const marker = mapMarkers[key];
      marker.markerNode.style.visibility = "hidden";
    }

    const gpsTracks = gpsState.gpsTracks;

    //loop through the gps track objects
    for (let track = 0; track < gpsTracks.length; track++) {
      let markerGPSPoint: GPSPoint = null;

      // make visible the marker for the current track
      if (paneStateData.gpsTrackToggles[gpsTracks[track].name]) {
        mapMarkers[gpsTracks[track].name].markerNode.style.visibility = "visible";
        map.setLayoutProperty(`track${gpsTracks[track].name}Layer`, "visibility", "visible");
      } else {
        mapMarkers[gpsTracks[track].name].markerNode.style.visibility = "hidden";
        map.setLayoutProperty(`track${gpsTracks[track].name}Layer`, "visibility", "none");
      }

      let markerIndex = 0;

      let isoDate = null;
      if (playheadHover.seconds === 0) {
        isoDate = getPlayheadISOString(playhead.date, playhead.seconds);
      } else {
        isoDate = getPlayheadISOString(playhead.date, playheadHover.seconds);
      }

      //Look for the point in each GPS track closest to the playheadTime
      for (let i = 0; i < gpsTracks[track].points.length; i++) {
        if (gpsTracks[track].points[i].time.toString() > isoDate) {
          if (i > 0) {
            markerIndex = i - 1;
          }
          break;
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
        const items: MapInfoDisplayItems = {
          lat: markerGPSPoint.lat.toFixed(6),
          lng: markerGPSPoint.lon.toFixed(6),
          ele: markerGPSPoint.ele.toFixed(2).toString(),
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
      // get the name of the first selected track and pan to it
      let somethingSelected = false;
      // loop through the sortedEnabledTracks
      for (const key of sortedEnabledTracks) {
        // if the track is selected
        if (paneStateData.gpsTrackToggles[key]) {
          // pan to the track
          map.panTo(mapMarkers[key].marker.getLngLat());
          somethingSelected = true;
          if (zoomLevel === 1) {
            setZoomLevel(15);
          }
          break;
        }
      }
      // if nothing is selected, pan to Houston
      if (!somethingSelected) {
        map.panTo(houstonLatLng);
        setZoomLevel(1);
      }
    }
  }, [
    map,
    playhead.date,
    playhead.seconds,
    playheadHover.seconds,
    gpsState.gpsTracks,
    paneStateData,
  ]);

  //Display GPS tracks on map
  useEffect(() => {
    if (!map) return;

    const gpsTracks = gpsState.gpsTracks;
    // Set a delay to get around buggy mapbox not dealing with sources properly
    setTimeout(() => {
      //loop through the gps track objects
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

  useEffect(() => {
    const tracksEnabled = Object.entries(paneStateData.gpsTrackToggles).filter((value) => {
      return value[1];
    });

    const sortedEnabledKeys = [];
    for (const [key, value] of tracksEnabled) {
      if (value) {
        sortedEnabledKeys.push(key);
      }
    }
    sortedEnabledKeys.sort();
    setSortedEnabledTracks(sortedEnabledKeys);
  }, [paneStateData.gpsTrackToggles]);

  function addMapSources(thisMap: mapboxgl.Map) {
    thisMap.addSource("trackEV1Source", {
      type: "geojson",
      data: trackFeatures.EV1,
    });
    thisMap.addSource("trackEV2Source", {
      type: "geojson",
      data: trackFeatures.EV2,
    });
    thisMap.addSource("trackEV3Source", {
      type: "geojson",
      data: trackFeatures.EV3,
    });
    thisMap.addSource("trackEV4Source", {
      type: "geojson",
      data: trackFeatures.EV4,
    });
    thisMap.addSource("trackCartSource", {
      type: "geojson",
      data: trackFeatures.Cart,
    });
    thisMap.addSource("trackLightCartSource", {
      type: "geojson",
      data: trackFeatures.LightCart,
    });
    thisMap.addSource("trackStaffSource", {
      type: "geojson",
      data: trackFeatures.Staff,
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
      id: "trackEV3Layer",
      type: "line",
      source: "trackEV3Source",
      paint: {
        "line-color": "orange",
        "line-opacity": 0.6,
        "line-width": 4,
      },
    });

    thisMap.addLayer({
      id: "trackEV4Layer",
      type: "line",
      source: "trackEV4Source",
      paint: {
        "line-color": "green",
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
      id: "trackStaffLayer",
      type: "line",
      source: "trackStaffSource",
      paint: {
        "line-color": "red",
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
        EV3: addMapMarker(thisMap, "EV3"),
        EV4: addMapMarker(thisMap, "EV4"),
        Cart: addMapMarker(thisMap, "cart"),
        LightCart: addMapMarker(thisMap, "LightCart"),
        Staff: addMapMarker(thisMap, "Staff"),
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
                href={"https://wiki.jsc.nasa.gov/exploration/index.php/CODA/External_Data"}
                target={"_blank"}
              >
                Exploration Wiki
              </a>{" "}
              for test events on an interactive map. Hovering over the CODA timeline will move the
              GPS subjects to their corresponding positions for that time.
            </p>
            <p>GPS track types include EV1, EV2, EV3, EV4, Tool Cart, and Light Cart.</p>
          </div>
        </HelpOverlay>
      </div>
    </>
  );

  function showInfo() {
    if (sortedEnabledTracks.length > 0) {
      return (
        <>
          <div className={`${styles.info} ${eventType === "GANDALF" ? styles.info_narrower : ""}`}>
            <div className={styles.infoSection}>
              <table className={styles.valueTable}>
                <tbody>
                  <tr>
                    <td></td>
                    {sortedEnabledTracks.map((key) => {
                      return (
                        <td key={key}>
                          <div className={styles.infoSectionTitle}>
                            <div>
                              <strong>{key}</strong>
                            </div>
                            <div>
                              <img
                                className="infoSectionTitleIcon"
                                src={`/images/marker_${key.toLowerCase()}.png`}
                                width="30px"
                              />
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td>Latitude:</td>
                    {sortedEnabledTracks.map((key) => {
                      return <td key={key}>{infoDisplay[key].lat}</td>;
                    })}
                  </tr>
                  <tr>
                    <td>Longitude:</td>
                    {sortedEnabledTracks.map((key) => {
                      return <td key={key}>{infoDisplay[key].lng}</td>;
                    })}
                  </tr>
                  <tr>
                    <td>Elevation (m):</td>
                    {sortedEnabledTracks.map((key) => {
                      return <td key={key}>{infoDisplay[key].ele}</td>;
                    })}
                  </tr>
                  <tr>
                    <td>Timestamp:</td>
                    {sortedEnabledTracks.map((key) => {
                      return <td key={key}>{infoDisplay[key].time}</td>;
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      );
    } else {
      return <></>;
    }
  }
}
