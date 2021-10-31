import { useState, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction, MutableRefObject } from "react";
import { useSelector } from "react-redux";
import ReactDOM from "react-dom";
import { RootState } from "store/index";
import { PlayheadState } from "store/playhead";
import { AncillaryState } from "store/ancillary";
import { getPlayheadISOString } from "utils/formatting";
import type { PlayheadHoverState } from "store/playheadHover";

import styles from "./te-location.module.css";
import Marker from "./te-location-marker";

import mapboxgl, { LngLatLike, Map } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import type { FeatureCollection } from "geojson";
import type { Point } from "gpxparser";

type MapMarker = {
  marker: any; //the MapBox marker reference
  markerNode: any; //the real DOM id of the marker
};

export default function TELocation() {
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
  const [photoMarkers, setPhotoMarkers] = useState([]);
  const [lockToggle, setLockToggle] = useState(true);

  const ancillaryState: AncillaryState = useSelector((state: RootState) => state.ancillary);

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

  //update map GPS track
  useEffect(() => {
    if (!map || !playhead.date || ancillaryState.ancillaryData.gpsTracks.length === 0) return;

    const gpsTracks = ancillaryState.ancillaryData.gpsTracks;

    if (map.getZoom() === 1) {
      map.setZoom(15);
    }
    ev1Marker.markerNode.style.visibility = "visible";
    ev2Marker.markerNode.style.visibility = "visible";
    cartMarker.markerNode.style.visibility = "visible";

    const trackIndexes = {
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
    //loop through the gps track objects (EV1, EV2, and Cart)
    for (let track = 0; track < gpsTracks.length; track++) {
      //Look for the point in each GPS track closest to the playheadTime
      let markerGPSPoint: Point = null;
      let foundIndex = 0;
      for (let i = 0; i < gpsTracks[track].points.length; i++) {
        if (gpsTracks[track].points[i].time.toString() > playHeadISODate) {
          if (i > 0) {
            foundIndex = i - 1;
          }
          break;
        }
      }

      //save the track index of the found point
      trackIndexes[gpsTracks[track].name].currentSecondIndex = foundIndex;

      //move the markers to the found point
      markerGPSPoint = gpsTracks[track].points[foundIndex];
      if (gpsTracks[track].name === "EV1") {
        ev1Marker.marker.setLngLat([markerGPSPoint.lon, markerGPSPoint.lat]);
      } else if (gpsTracks[track].name === "EV2") {
        ev2Marker.marker.setLngLat([markerGPSPoint.lon, markerGPSPoint.lat]);
      } else if (gpsTracks[track].name === "Cart") {
        cartMarker.marker.setLngLat([markerGPSPoint.lon, markerGPSPoint.lat]);
      }

      //if mousing over the timeline and hovering, set the trail range to be the playhead time to the hover time
      let newCoordinates: LngLatLike[] = [];
      if (playheadHover.seconds !== 0) {
        //Look for the point in each GPS track closest to the hover time
        const playHeadhoverISODate = getPlayheadISOString(playhead.date, playheadHover.seconds);
        let foundIndex = 0;
        for (let i = 0; i < gpsTracks[track].points.length; i++) {
          if (gpsTracks[track].points[i].time.toString() > playHeadhoverISODate) {
            if (i > 0) {
              foundIndex = i - 1;
            }
            break;
          }
        }
        //save the track index of the found point
        trackIndexes[gpsTracks[track].name].hoverSecondIndex = foundIndex;

        //retrieve lower and upper indexes from the saved points to use the trail range
        const [lowerIndex, upperIndex] = getLowerAndUpperIndexes(
          gpsTracks[track].name,
          trackIndexes
        );

        //populate newCoordinates with subrange of gps track (can't use splice here because gpx points and mapbox points are incompatible)
        if (lowerIndex < upperIndex && lowerIndex !== null && upperIndex !== null) {
          for (let x = lowerIndex; x <= upperIndex; x++) {
            const thisCoordinate: LngLatLike = [
              gpsTracks[track].points[x].lon,
              gpsTracks[track].points[x].lat,
            ];
            newCoordinates.push(thisCoordinate);
          }
        }
      } else {
        //if not hovering the timeline, set the trail range to be 20 track points behind the current time
        const upperIndex = trackIndexes[gpsTracks[track].name].currentSecondIndex;
        const lowerIndex =
          trackIndexes[gpsTracks[track].name].currentSecondIndex - 20 < 0
            ? 0
            : trackIndexes[gpsTracks[track].name].currentSecondIndex - 20;

        //populate newCoordinates with subrange of gps track
        for (let x = lowerIndex; x <= upperIndex; x++) {
          const thisCoordinate: LngLatLike = [
            gpsTracks[track].points[x].lon,
            gpsTracks[track].points[x].lat,
          ];
          newCoordinates.push(thisCoordinate);
        }
      }

      //draw the trails using the coordinate ranges calculted above
      if (gpsTracks[track].name === "EV1") {
        trackEV1.features[0].geometry.coordinates = newCoordinates;
        // @ts-ignore: bad mapbox typing
        map.getSource("trackEV1Source").setData(trackEV1);
      } else if (gpsTracks[track].name === "EV2") {
        trackEV2.features[0].geometry.coordinates = newCoordinates;
        // @ts-ignore: bad mapbox typing
        map.getSource("trackEV2Source").setData(trackEV2);
      } else if (gpsTracks[track].name === "Cart") {
        trackCart.features[0].geometry.coordinates = newCoordinates;
        // @ts-ignore: bad mapbox typing
        map.getSource("trackCartSource").setData(trackCart);
      }
    }
    if (lockToggle) {
      map.panTo(ev1Marker.marker._lngLat);
    }
  }, [
    playhead.date,
    playhead.seconds,
    playheadHover.seconds,
    ancillaryState.ancillaryData.gpsTracks,
  ]);

  //update photo markers
  useEffect(() => {
    if (!map || !playhead.date || ancillaryState.ancillaryData.photos.length === 0) return;

    // Display photos up until current playhead time
    let targetISODate = getPlayheadISOString(playhead.date, playhead.seconds);
    if (playheadHover.seconds !== 0) {
      // Display photos up until hover time
      targetISODate = getPlayheadISOString(playhead.date, playheadHover.seconds);
    }

    //remove all photo markers
    for (let i = 0; i < photoMarkers.length; i++) {
      photoMarkers[i].marker.remove();
    }

    //draw new set of photo markers
    const newPhotoMarkers = [];
    for (let i = 0; i < ancillaryState.ancillaryData.photos.length; i++) {
      const thisPhoto = ancillaryState.ancillaryData.photos[i];

      if (thisPhoto.hasOwnProperty("gps") && thisPhoto.datetimeTaken <= targetISODate) {
        const markerNode = document.createElement("div");
        markerNode.style.visibility = "visible";
        const element = <Marker id={`Photo_${i}`} type={`Photo`} />;
        ReactDOM.render(element, markerNode);
        const marker = new mapboxgl.Marker(markerNode).setLngLat([
          thisPhoto.gps.lng,
          thisPhoto.gps.lat,
        ]);
        marker.addTo(map);

        newPhotoMarkers.push({ marker: marker, markerNode: markerNode });
      }
    }
    setPhotoMarkers(newPhotoMarkers);
  }, [playhead.date, playhead.seconds, playheadHover.seconds, ancillaryState.ancillaryData.photos]);

  /**
   * Returns lowerIndex and upperIndex between currentSecondsIndex and hoverSecondsIndex
   * @param identifier EV1, EV2 or Cart
   * @param trackIndexes Track index object where indexes have been stored
   * @returns Array containing lowerIndex, upperIndex
   */
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
          "line-color": "blue",
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
          "line-color": "black",
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
