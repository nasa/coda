import { useState, useEffect, useRef, FunctionComponent } from "react";
import type { Dispatch, SetStateAction, RefObject } from "react";
import { deepEqual, refEqual, useAppSelector } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import { getPlayheadISOString, isoStringFromAnyDateString } from "utils/formatting";
import { usePlayheadDate } from "store/hooks";

import styles from "./gps-location.module.css";
import TEMarker from "./gps-location-marker";

import mapboxgl, { Map } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import type { FeatureCollection, LineString } from "geojson";
import { setPaneStateDataValue } from "store/framework";
import { HelpButton } from "components/interface/pane-help-control-button";
import HelpOverlay from "components/interface/pane-help-overlay";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock, faLockOpen } from "@fortawesome/free-solid-svg-icons";
import Button, { RoundedVariant } from "components/interface/button";
import { createRoot } from "react-dom/client";
import ClockInterval from "components/framework/ClockInterval";

export const GPSLocationControls: FunctionComponent<{
  paneInstanceId: number;
  frameDimensions: number[];
}> = ({ paneInstanceId, frameDimensions }) => {
  const dispatch = useAppDispatch();

  const minWidth = 470;

  const paneStateData = useAppSelector(
    (state) => state.framework.paneInstances[paneInstanceId].paneStateData as GpsTrackPaneStateData,
    deepEqual
  );

  const gpsTracks = useAppSelector((state) => state.gps.gpsTracks, deepEqual);

  const buttonLength = frameDimensions[0] > minWidth ? styles.buttonLong : styles.buttonShort;
  let lockButtonSelected = "";
  if (typeof paneStateData !== "undefined" && paneStateData.lockMap) {
    lockButtonSelected = styles.lockButtonSelected;
  }

  return (
    <div className={styles.controls}>
      <div className={styles.controlsLeft}>
        <div className={styles.selections}>
          {gpsTracks.map((track, index) => {
            let rounded: RoundedVariant = "none";
            if (index === 0) {
              rounded = "left";
            } else if (index === gpsTracks.length - 1) {
              rounded = "right";
            }

            const color = paneStateData.gpsTrackToggles[track?.name]
              ? "active_selected"
              : "disabled";

            return (
              <Button
                key={"DLBUTTON_" + track.name + "_" + paneInstanceId}
                color={color}
                size="medium"
                rounded={rounded}
                callback={() => {
                  const onOff = !paneStateData.gpsTrackToggles[track.name];

                  const newTogglesData = { ...paneStateData.gpsTrackToggles, [track.name]: onOff };

                  dispatch(
                    setPaneStateDataValue({
                      paneInstanceId,
                      paneStateProperty: "gpsTrackToggles",
                      paneStateValue: newTogglesData,
                    })
                  );
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
            className={`${styles.lockButton} ${buttonLength} ${lockButtonSelected}`}
            title={`Click to toggle map scrolling in relation to GPS position`}
            onClick={() => {
              dispatch(
                setPaneStateDataValue({
                  paneInstanceId,
                  paneStateProperty: "lockMap",
                  paneStateValue: !paneStateData.lockMap,
                })
              );
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
              dispatch(
                setPaneStateDataValue({
                  paneInstanceId,
                  paneStateProperty: "showHelp",
                  paneStateValue: !paneStateData.showHelp,
                })
              );
            }}
            selected={paneStateData.showHelp}
          />
        </div>
      </div>
    </div>
  );
};

const GPSLocation: FunctionComponent<{ paneInstanceId: number; frameDimensions: number[] }> = ({
  paneInstanceId,
  frameDimensions,
}) => {
  const dispatch = useAppDispatch();

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

  const initialTrackFeature: FeatureCollection<LineString> = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [] as number[][],
        } as LineString,
        properties: {},
      },
    ],
  };

  const trackFeatures: Record<string, FeatureCollection<LineString>> = {
    EV1: { ...initialTrackFeature },
    EV2: { ...initialTrackFeature },
    EV3: { ...initialTrackFeature },
    EV4: { ...initialTrackFeature },
    Cart: { ...initialTrackFeature },
    LightCart: { ...initialTrackFeature },
    Staff: { ...initialTrackFeature },
  };

  const gpsState: GPSState = useAppSelector((state) => state.gps, deepEqual);
  const layoutLastChanged = useAppSelector((state) => state.framework.layoutLastChanged, deepEqual);
  const paneStateData = useAppSelector(
    (state) => state.framework.paneInstances[paneInstanceId].paneStateData as GpsTrackPaneStateData,
    deepEqual
  );

  // Clock state from Redux
  const playheadDate = usePlayheadDate();
  const hoverSeconds = useAppSelector((state) => state.clock.hoverSeconds, refEqual);
  const [appSeconds, setLocalAppSeconds] = useState(0);

  const mapContainer = useRef<HTMLDivElement | null>(null);

  const [map, setMap] = useState<Map | null>(null);
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
    //import.meta.env is the vite syntax to get the env variable to client side code
    mapboxgl.accessToken = import.meta.env.VITE_PUBLIC_MAPBOX_KEY;

    if (!map) initializeMap(setMap, mapContainer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initializeMap is a stable module-level function
  }, [map]);

  //redraw the map when the frame dimension change due to window resize or a layout change
  useEffect(() => {
    if (map) {
      map.resize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map instance doesn't change, only need to react to dimension changes
  }, [frameDimensions, layoutLastChanged]);

  useEffect(() => {
    if (!map) return;
    map.setZoom(zoomLevel);
  }, [map, zoomLevel]);

  //update map GPS markers and tracks
  useEffect(() => {
    if (!map || !playheadDate || gpsState.gpsTracks.length === 0) return;

    // set eventType to DRATS if EV1 is present, set as GANDALF if Staff is present
    if (gpsState.gpsTracks.filter((track) => track.name === "EV1").length > 0) {
      setEventType("DRATS");
    } else if (gpsState.gpsTracks.filter((track) => track.name === "Staff").length > 0) {
      setEventType("GANDALF");
    }

    // hide all markers
    for (const key in mapMarkers) {
      const marker = mapMarkers[key as keyof MapMarkers];
      if (marker?.markerNode) {
        marker.markerNode.style.visibility = "hidden";
      }
    }

    const gpsTracks = gpsState.gpsTracks;

    //loop through the gps track objects
    for (let track = 0; track < gpsTracks.length; track++) {
      let markerGPSPoint: GPSPoint | undefined = undefined;

      // make visible the marker for the current track
      const currentMarker = mapMarkers[gpsTracks[track].name as keyof MapMarkers];
      if (paneStateData.gpsTrackToggles[gpsTracks[track].name]) {
        if (currentMarker?.markerNode) {
          currentMarker.markerNode.style.visibility = "visible";
        }
        map.setLayoutProperty(`track${gpsTracks[track].name}Layer`, "visibility", "visible");
      } else {
        if (currentMarker?.markerNode) {
          currentMarker.markerNode.style.visibility = "hidden";
        }
        map.setLayoutProperty(`track${gpsTracks[track].name}Layer`, "visibility", "none");
      }

      let markerIndex = 0;

      const isoDate = hoverSeconds
        ? getPlayheadISOString(playheadDate, hoverSeconds)
        : getPlayheadISOString(playheadDate, appSeconds);

      //Look for the point in each GPS track closest to the playheadTime
      for (let i = 0; i < gpsTracks[track].points.length; i++) {
        if (gpsTracks[track].points[i].time > isoDate) {
          if (i > 0) {
            markerIndex = i - 1;
          }
          break;
        }
      }

      //save the found track point
      markerGPSPoint = gpsTracks[track].points[markerIndex];

      //move the marker to the found point
      if (markerGPSPoint && currentMarker?.marker) {
        currentMarker.marker.setLngLat([markerGPSPoint.lon, markerGPSPoint.lat]);
      }

      if (!markerGPSPoint) continue;

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
        tempInfo[gpsTracks[track].name as keyof MapMarkers] = items;
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
          const panMarker = mapMarkers[key as keyof MapMarkers];
          if (panMarker?.marker) {
            map.panTo(panMarker.marker.getLngLat());
          }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- houstonLatLng, infoDisplay, mapMarkers, sortedEnabledTracks, zoomLevel are stable or would cause infinite loops
  }, [map, playheadDate, appSeconds, hoverSeconds, gpsState.gpsTracks, paneStateData]);

  //Display GPS tracks on map
  useEffect(() => {
    if (!map) return;

    const gpsTracks = gpsState.gpsTracks;
    // Set a delay to get around buggy mapbox not dealing with sources properly
    setTimeout(() => {
      //loop through the gps track objects
      for (let track = 0; track < gpsTracks.length; track++) {
        const gpsTrack = gpsTracks[track];
        const newCoordinates: number[][] = [];
        for (let x = 0; x < gpsTrack.points.length; x++) {
          const thisCoordinate: number[] = [gpsTrack.points[x].lon, gpsTrack.points[x].lat];
          newCoordinates.push(thisCoordinate);
        }

        const trackName = gpsTrack.name;
        trackFeatures[trackName as keyof TrackFeatures].features[0].geometry.coordinates =
          newCoordinates;

        // @ts-ignore: bad mapbox typing
        map.getSource(`track${trackName}Source`).setData(trackFeatures[trackName]);
      }
    }, 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- trackFeatures is defined inline and adding it would cause infinite loops
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
    setMap: Dispatch<SetStateAction<mapboxgl.Map | null>>,
    mapContainer: RefObject<HTMLDivElement | null>
  ) {
    if (!mapContainer.current) return;
    mapContainer.current.innerHTML = ""; // Clear the container
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

  function addMapMarker(thisMap: mapboxgl.Map, typeName: string): MapMarker {
    const markerNode = document.createElement("div");
    markerNode.style.visibility = "hidden";
    const root = createRoot(markerNode);
    const element = <TEMarker id={`${typeName}`} type={`${typeName}`} />;
    root.render(element);
    const marker = new mapboxgl.Marker(markerNode).setLngLat(houstonLatLng);
    marker.addTo(thisMap);
    return { marker: marker, markerNode: markerNode };
  }

  return (
    <>
      <ClockInterval setAppSeconds={setLocalAppSeconds} />
      <div className={styles.container}>
        <div
          ref={mapContainer}
          className={styles.mapContainer}
          onMouseDown={() => {
            dispatch(
              setPaneStateDataValue({
                paneInstanceId,
                paneStateProperty: "lockMap",
                paneStateValue: false,
              })
            );
          }}
        ></div>
        {gpsState.gpsTracks.length > 0 ? showInfo() : <></>}
        <HelpOverlay
          isModalOpen={paneStateData.showHelp}
          closeHandler={() => {
            dispatch(
              setPaneStateDataValue({
                paneInstanceId,
                paneStateProperty: "showHelp",
                paneStateValue: !paneStateData.showHelp,
              })
            );
          }}
        >
          <div>
            <p>
              Displays GPS tracks stored in the{" "}
              <a
                href={"https://wiki.jsc.nasa.gov/exploration/index.php/CODA/External_Data"}
                target={"_blank"}
                rel="noopener noreferrer"
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
                      return <td key={key}>{infoDisplay[key as keyof MapInfoDisplay]?.lat}</td>;
                    })}
                  </tr>
                  <tr>
                    <td>Longitude:</td>
                    {sortedEnabledTracks.map((key) => {
                      return <td key={key}>{infoDisplay[key as keyof MapInfoDisplay]?.lng}</td>;
                    })}
                  </tr>
                  <tr>
                    <td>Elevation (m):</td>
                    {sortedEnabledTracks.map((key) => {
                      return <td key={key}>{infoDisplay[key as keyof MapInfoDisplay]?.ele}</td>;
                    })}
                  </tr>
                  <tr>
                    <td>Timestamp:</td>
                    {sortedEnabledTracks.map((key) => {
                      return <td key={key}>{infoDisplay[key as keyof MapInfoDisplay]?.time}</td>;
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
};

export default GPSLocation;
