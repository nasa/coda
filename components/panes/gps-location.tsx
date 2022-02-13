import { useState, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction, MutableRefObject } from "react";
import { useDispatch, useSelector } from "react-redux";
import ReactDOM from "react-dom";
import deepEqual from "lodash/isEqual";
import { RootState } from "store/index";
import { GPSState } from "store/gps";
import { getPlayheadISOString, isoStringFromAnyDateString } from "utils/formatting";

import styles from "./gps-location.module.css";
import TEMarker from "./gps-location-marker";

import mapboxgl, { LngLatLike, Map } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import type { FeatureCollection } from "geojson";
import type { Point } from "gpxparser";
import { setPaneStateDataValue } from "store/framework";
import { HelpButton } from "components/interface/controlsHelpButton";

export function GPSLocationControls(props: { frameID: number }) {
  const frameID = props.frameID;
  const dispatch = useDispatch();

  const paneStateData: LocationPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData
  );

  function setPaneStateValue(propertyName, propertyValue) {
    dispatch(
      setPaneStateDataValue({
        frameID,
        paneStateProperty: propertyName,
        paneStateValue: propertyValue,
      })
    );
  }

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
              setPaneStateValue("lockMap", !paneStateData.lockMap);
            }}
          >
            <span className={styles.lockButtonLabel}>Lock Map to GPS</span>
          </button>
        </div>
        <div className={styles.verticalCenter}>
          <HelpButton
            clickHandler={() => {
              setPaneStateValue("showHelp", !paneStateData.showHelp);
            }}
            selected={paneStateData.showHelp}
          />
        </div>
      </div>
    </div>
  );
}

export default function GPSLocation(props: { frameID: number }) {
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
  };

  const playheadHover: PlayheadHoverState = useSelector((state: RootState) => state.playheadHover);
  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);
  const gpsState: GPSState = useSelector((state: RootState) => state.gps, deepEqual);
  const paneStateData: LocationPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData
  );
  const mapContainer = useRef(null);

  const [map, setMap] = useState<Map>(null);
  const [mapMarkers, setMapMarkers] = useState(initialMarkers);

  const infoItemsDefaultValue = {
    lat: "",
    lng: "",
    ele: "",
    hdg: "",
    slope: "",
    date: "",
    time: "",
  };
  const [infoDisplay, setInfoDisplay] = useState<mapInfoDisplay>({
    ev1: infoItemsDefaultValue,
    ev2: infoItemsDefaultValue,
    cart: infoItemsDefaultValue,
    lightCart: infoItemsDefaultValue,
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

  //update map GPS markers
  useEffect(() => {
    if (!map || !playhead.date || gpsState.gpsTracks.length === 0) return;

    if (map.getZoom() === 1) {
      map.setZoom(15);
      // map.setPitch(45);
    }

    for (var key in mapMarkers) {
      if (mapMarkers.hasOwnProperty(key)) {
        const marker = mapMarkers[key];
        marker.markerNode.style.visibility = "visible";
      }
    }

    const gpsTracks = gpsState.gpsTracks;

    const playHeadISODate = getPlayheadISOString(playhead.date, playhead.seconds);
    //loop through the gps track objects (EV1, EV2, and Cart)
    for (let track = 0; track < gpsTracks.length; track++) {
      let markerGPSPoint: Point = null;

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
          slope: gpsTracks[track].slopes[markerIndex].toFixed(3).toString(),
          date: timestampArr[0],
          time: timestampArr[1],
          hdg: "",
        };
        const tempInfo = infoDisplay;
        tempInfo[gpsTracks[track].name.toLowerCase()] = items;
        setInfoDisplay(tempInfo);
      } catch (error) {
        console.log("Info display error: ", error);
      }
    }
    if (paneStateData.lockMap) {
      map.panTo(mapMarkers.EV1.marker.getLngLat());
    }
  }, [map, playhead.date, playhead.seconds, playheadHover.seconds, gpsState.gpsTracks]);

  //Display GPS tracks on map
  useEffect(() => {
    if (!map || gpsState.gpsTracks.length === 0) return;

    //add a timeout to fix buggy mapboxgl not displaying tracks randomly
    const timer = setTimeout(() => {
      const gpsTracks = gpsState.gpsTracks;
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
      clearTimeout(timer);
    }, 100);
  }, [map, gpsState.gpsTracks]);

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
      const newMarkers = {
        EV1: addMapMarker(thisMap, "EV1"),
        EV2: addMapMarker(thisMap, "EV2"),
        Cart: addMapMarker(thisMap, "Cart"),
        LightCart: addMapMarker(thisMap, "LightCart"),
      };
      setMapMarkers(newMarkers);

      thisMap.addSource("trackEV1Source", {
        type: "geojson",
        data: trackFeatures.EV1,
      });
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

      thisMap.addSource("trackEV2Source", {
        type: "geojson",
        data: trackFeatures.EV2,
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

      thisMap.addSource("trackCartSource", {
        type: "geojson",
        data: trackFeatures.Cart,
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

      thisMap.addSource("trackLightCartSource", {
        type: "geojson",
        data: trackFeatures.Cart,
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
            dispatch(
              setPaneStateDataValue({
                frameID,
                paneStateProperty: "lockMap",
                paneStateValue: false,
              })
            );
          }}
        >
          {gpsState.gpsTracks.length > 0 ? showInfo() : <></>}
        </div>
      </div>
    </>
  );

  function showInfo() {
    return (
      <>
        <div className={styles.info}>
          <div className={styles.infoSection}>
            <table className={styles.valueTable}>
              <tbody>
                <tr>
                  <td></td>
                  <td>
                    <div className={styles.infoSectionTitle}>
                      <div>
                        <strong>EV1</strong>
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
                        <strong>EV2</strong>
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
                </tr>
                <tr>
                  <td>Latitude:</td>
                  <td>{infoDisplay.ev1.lat}</td>
                  <td>{infoDisplay.ev2.lat}</td>
                </tr>
                <tr>
                  <td>Longitude:</td>
                  <td>{infoDisplay.ev1.lng}</td>
                  <td>{infoDisplay.ev2.lng}</td>
                </tr>
                <tr>
                  <td>Elevation (m):</td>
                  <td>{infoDisplay.ev1.ele}</td>
                  <td>{infoDisplay.ev2.ele}</td>
                </tr>
                <tr>
                  <td>Slope:</td>
                  <td>{infoDisplay.ev1.slope}</td>
                  <td>{infoDisplay.ev2.slope}</td>
                </tr>
                <tr>
                  <td>Timestamp:</td>
                  <td>
                    {infoDisplay.ev1.date}
                    <br />
                    {infoDisplay.ev1.time}
                  </td>
                  <td>
                    {infoDisplay.ev2.date}
                    <br />
                    {infoDisplay.ev2.time}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }
}
