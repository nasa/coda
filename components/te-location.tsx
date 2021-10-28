import { useState, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction, MutableRefObject } from "react";
import { useSelector } from "react-redux";
import ReactDOM from "react-dom";
import { RootState } from "store/index";
import { PlayheadState } from "store/playhead";
import { getPlayheadISOString } from "utils/formatting";
import type { PlayheadHoverState } from "store/playheadHover";

import styles from "./te-location.module.css";
import Marker from "./te-location-marker";

import mapboxgl, { LngLatLike, Map } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import type { FeatureCollection } from "geojson";
import { buildGPSTracksStore } from "http-client/ancillary";
import { GPSTrackCollection } from "typings/ancillary";
import type { Point } from "gpxparser";

type MapMarker = {
  marker: any; //the MapBox marker reference
  markerNode: any; //the real DOM id of the marker
};

export default function TELocation(props) {
  const initialMarker: MapMarker = {
    marker: null,
    markerNode: null,
  };

  const trackEV1 = {
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

  const trackEV2 = {
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

  const trackCart = {
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

  const playheadHover: PlayheadHoverState = useSelector((state: RootState) => state.playheadHover);
  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);

  const [map, setMap] = useState<Map>(null);
  const [ev1Marker, setEV1Marker] = useState(initialMarker);
  const [ev2Marker, setEV2Marker] = useState(initialMarker);
  const [cartMarker, setCartMarker] = useState(initialMarker);
  const [lockToggle, setLockToggle] = useState(true);

  const [gpsTracks, setGPSTracks] = useState<GPSTrackCollection>({ gps_tracks: [] });
  // const [gpsTracksIndexes, setGPSTracksIndexes] = useState(null);

  const mapContainer = useRef(null);

  //just need any location for getSatelliteInfo
  const houstonLatLng = {
    lng: -95.3698,
    lat: 29.7604,
  };

  //get GPS tracks
  useEffect(() => {
    if (!playhead) return;

    const d = new Date(playhead.date);

    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();

    if (gpsTracks.gps_tracks.length === 0) {
      (async () => {
        const gpsTracks: GPSTrackCollection = await buildGPSTracksStore(
          year,
          month,
          day,
          props.eventType
        );
        setGPSTracks(gpsTracks);
      })();
    }
  }, [gpsTracks, playhead]);

  //init map app
  useEffect(() => {
    mapboxgl.accessToken =
      "pk.eyJ1IjoiYmZlaXN0IiwiYSI6ImNpbDJva2hseTNnZnd1Z20zNmU0cDExdXUifQ.3acQyDaKU1HS8k5hqPmp1w";

    if (!map) initializeMap(setMap, mapContainer);
  }, [map]);

  //update map GPS track
  useEffect(() => {
    if (!map || !playhead.date || gpsTracks.gps_tracks.length === 0) return;

    let trackIndexes = {
      EV1: {
        currentSecondIndex: null,
        hoverSecondIndex: null,
      },
      EV2: {
        currentSecondIndex: null,
        hoverSecondIndex: null,
      },
      Cart: {
        currentSecondIndex: null,
        hoverSecondIndex: null,
      },
    };

    const playHeadISODate = getPlayheadISOString(playhead.date, playhead.seconds);
    for (let track = 0; track < gpsTracks.gps_tracks.length; track++) {
      let markerGPSPoint: Point = null;

      for (let i = 0; i < gpsTracks.gps_tracks[track].track.points.length; i++) {
        if (gpsTracks.gps_tracks[track].track.points[i].time.toString() > playHeadISODate) {
          if (i > 0) {
            markerGPSPoint = gpsTracks.gps_tracks[track].track.points[i - 1];
            trackIndexes[gpsTracks.gps_tracks[track].identifier].currentSecondIndex = i - 1;

            if (gpsTracks.gps_tracks[track].identifier === "EV1") {
              ev1Marker.marker.setLngLat([markerGPSPoint.lon, markerGPSPoint.lat]);
              if (ev1Marker.markerNode.style.visibility !== "visible") {
                ev1Marker.markerNode.style.visibility = "visible";
                map.setZoom(15);
              }
            } else if (gpsTracks.gps_tracks[track].identifier === "EV2") {
              ev2Marker.marker.setLngLat([markerGPSPoint.lon, markerGPSPoint.lat]);
              ev2Marker.markerNode.style.visibility = "visible";
            } else if (gpsTracks.gps_tracks[track].identifier === "Cart") {
              cartMarker.marker.setLngLat([markerGPSPoint.lon, markerGPSPoint.lat]);
              cartMarker.markerNode.style.visibility = "visible";
            }
          }
          break;
        }
      }
      if (playheadHover.seconds !== 0) {
        const playHeadhoverISODate = getPlayheadISOString(playhead.date, playheadHover.seconds);
        for (let i = 0; i < gpsTracks.gps_tracks[track].track.points.length; i++) {
          if (gpsTracks.gps_tracks[track].track.points[i].time.toString() > playHeadhoverISODate) {
            let foundIndex = 0;
            if (i > 0) {
              foundIndex = i - 1;
            }
            trackIndexes[gpsTracks.gps_tracks[track].identifier].hoverSecondIndex = foundIndex;
            break;
          }
        }

        // const bounds = new mapboxgl.LngLatBounds();
        const [lowerIndex, upperIndex] = getLowerAndUpperIndexes(
          gpsTracks.gps_tracks[track].identifier,
          trackIndexes
        );
        let newCoordinates: LngLatLike[] = [];
        if (lowerIndex < upperIndex && lowerIndex !== null && upperIndex !== null) {
          for (let x = lowerIndex; x < upperIndex; x++) {
            const thisCoordinate: LngLatLike = [
              gpsTracks.gps_tracks[track].track.points[x].lon,
              gpsTracks.gps_tracks[track].track.points[x].lat,
            ];
            newCoordinates.push(thisCoordinate);
          }

          // bounds.extend(newCoordinates[0]);
          // bounds.extend(newCoordinates[newCoordinates.length - 1]);
        }

        if (gpsTracks.gps_tracks[track].identifier === "EV1") {
          trackEV1.features[0].geometry.coordinates = newCoordinates;
          // @ts-ignore: bad mapbox typing
          map.getSource("trackEV1Source").setData(trackEV1);
          // map.setLayoutProperty("trackEV1Layer", "visibility", "visible");
        } else if (gpsTracks.gps_tracks[track].identifier === "EV2") {
          trackEV2.features[0].geometry.coordinates = newCoordinates;
          // @ts-ignore: bad mapbox typing
          map.getSource("trackEV2Source").setData(trackEV2);
          // map.setLayoutProperty("trackEV2Layer", "visibility", "visible");
        } else if (gpsTracks.gps_tracks[track].identifier === "Cart") {
          trackCart.features[0].geometry.coordinates = newCoordinates;
          // @ts-ignore: bad mapbox typing
          map.getSource("trackCartSource").setData(trackCart);
          // map.setLayoutProperty("trackCartLayer", "visibility", "visible");
        }
      } else {
        // map.setLayoutProperty("trackEV1Layer", "visibility", "none");
        // map.setLayoutProperty("trackEV2Layer", "visibility", "none");
        // map.setLayoutProperty("trackCartLayer", "visibility", "none");

        const upperIndex = trackIndexes[gpsTracks.gps_tracks[track].identifier].currentSecondIndex;
        const lowerIndex =
          trackIndexes[gpsTracks.gps_tracks[track].identifier].currentSecondIndex - 20 < 0
            ? 0
            : trackIndexes[gpsTracks.gps_tracks[track].identifier].currentSecondIndex - 20;

        let newCoordinates: LngLatLike[] = [];
        for (let x = lowerIndex; x < upperIndex; x++) {
          const thisCoordinate: LngLatLike = [
            gpsTracks.gps_tracks[track].track.points[x].lon,
            gpsTracks.gps_tracks[track].track.points[x].lat,
          ];
          newCoordinates.push(thisCoordinate);
        }

        if (gpsTracks.gps_tracks[track].identifier === "EV1") {
          trackEV1.features[0].geometry.coordinates = newCoordinates;
          // @ts-ignore: bad mapbox typing
          map.getSource("trackEV1Source").setData(trackEV1);
        } else if (gpsTracks.gps_tracks[track].identifier === "EV2") {
          trackEV2.features[0].geometry.coordinates = newCoordinates;
          // @ts-ignore: bad mapbox typing
          map.getSource("trackEV2Source").setData(trackEV2);
        } else if (gpsTracks.gps_tracks[track].identifier === "Cart") {
          trackCart.features[0].geometry.coordinates = newCoordinates;
          // @ts-ignore: bad mapbox typing
          map.getSource("trackCartSource").setData(trackCart);
        }
      }
    }
    if (lockToggle) {
      map.panTo(ev1Marker.marker._lngLat);
    }

    //use hover to show path
  }, [playhead.date, playhead.seconds, playheadHover.seconds, gpsTracks]);

  function getLowerAndUpperIndexes(identifier: string, trackIndexes) {
    const lowerIndex =
      trackIndexes[identifier].currentSecondIndex < trackIndexes[identifier].hoverSecondIndex
        ? trackIndexes[identifier].currentSecondIndex
        : trackIndexes[identifier].hoverSecondIndex;

    const upperIndex =
      trackIndexes[identifier].currentSecondIndex > trackIndexes[identifier].hoverSecondIndex
        ? trackIndexes[identifier].currentSecondIndex
        : trackIndexes[identifier].hoverSecondIndex;

    return [lowerIndex, upperIndex];
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
      addMapMarker(thisMap, "EV1", setEV1Marker);
      addMapMarker(thisMap, "EV2", setEV2Marker);
      addMapMarker(thisMap, "Cart", setCartMarker);

      thisMap.addSource("trackEV1Source", { type: "geojson", data: trackEV1 as FeatureCollection });
      thisMap.addLayer({
        id: "trackEV1Layer",
        type: "line",
        source: "trackEV1Source",
        paint: {
          "line-color": "red",
          "line-opacity": 0.5,
          "line-width": 5,
        },
      });

      thisMap.addSource("trackEV2Source", { type: "geojson", data: trackEV2 as FeatureCollection });
      thisMap.addLayer({
        id: "trackEV2Layer",
        type: "line",
        source: "trackEV2Source",
        paint: {
          "line-color": "black",
          "line-opacity": 0.5,
          "line-width": 5,
        },
      });

      thisMap.addSource("trackCartSource", {
        type: "geojson",
        data: trackCart as FeatureCollection,
      });
      thisMap.addLayer({
        id: "trackCartLayer",
        type: "line",
        source: "trackCartSource",
        paint: {
          "line-color": "blue",
          "line-opacity": 0.5,
          "line-width": 5,
        },
      });

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
            title={`Click to toggle map scrolling in relation to EV1 position`}
            onClick={() => {
              setLockToggle(!lockToggle);
            }}
          >
            Lock to EV1
          </div>
        </div>
      </div>
    </>
  );
}
