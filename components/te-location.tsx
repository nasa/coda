import { useState, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction, MutableRefObject } from "react";
import { useSelector } from "react-redux";
import ReactDOM from "react-dom";
import { RootState } from "store/index";
import { PlayheadState } from "store/playhead";
import { AncillaryState } from "store/ancillary";
import { getPlayheadISOString, isoStringFromAnyDateString } from "utils/formatting";
import type { PlayheadHoverState } from "store/playheadHover";

import styles from "./te-location.module.css";
import Marker from "./te-location-marker";

import mapboxgl, { LngLatLike, Map } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import type { FeatureCollection } from "geojson";
import type { Point } from "gpxparser";
import { PhotosEntityState, photosSelectors } from "store/photos";

type MapMarker = {
  marker: any; //the MapBox marker reference
  markerNode: any; //the real DOM id of the marker
};

type infoItems = {
  lat: string;
  lng: string;
  ele: string;
  hdg: string;
  slope: string;
  date: string;
  time: string;
};

type InfoDisplay = {
  ev1: infoItems;
  ev2: infoItems;
  cart: infoItems;
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
  const photos: PhotosEntityState = useSelector((state: RootState) => state.photos);
  const photoFiles = photosSelectors.selectAll(photos);

  const [map, setMap] = useState<Map>(null);
  const [ev1Marker, setEV1Marker] = useState(initialMarker);
  const [ev2Marker, setEV2Marker] = useState(initialMarker);
  const [cartMarker, setCartMarker] = useState(initialMarker);
  const [photoMarkers, setPhotoMarkers] = useState([]);
  const [photoMarkerCount, setPhotoMarkerCount] = useState(0);
  const [lockToggle, setLockToggle] = useState(true);

  const infoItemsDefaultValue = {
    lat: "",
    lng: "",
    ele: "",
    hdg: "",
    slope: "",
    date: "",
    time: "",
  };
  const [infoDisplay, setInfoDisplay] = useState<InfoDisplay>({
    ev1: infoItemsDefaultValue,
    ev2: infoItemsDefaultValue,
    cart: infoItemsDefaultValue,
  });

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
    if (!map || !playhead.date || ancillaryState.dataItems.gpsTracks.length === 0) return;

    const gpsTracks = ancillaryState.dataItems.gpsTracks;

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

      //if mousing over the timeline and hovering, set the trail range to be the playhead time to the hover time
      let newCoordinates: LngLatLike[] = [];
      if (playheadHover.seconds !== 0) {
        //Look for the point in each GPS track closest to the hover time
        const playHeadhoverISODate = getPlayheadISOString(playhead.date, playheadHover.seconds);
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
        //if not hovering the timeline, set the trail range to be 30 track points behind the current time
        const upperIndex = trackIndexes[gpsTracks[track].name].currentSecondIndex;
        const lowerIndex =
          trackIndexes[gpsTracks[track].name].currentSecondIndex - 30 < 0
            ? 0
            : trackIndexes[gpsTracks[track].name].currentSecondIndex - 30;

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

      let markerGPSPoint: Point = null;

      const timestampArr = (
        isoStringFromAnyDateString(gpsTracks[track].points[foundIndex].time.toString()).split(
          "."
        )[0] + "Z"
      ).split("T");

      //update infoDisplay
      const items: infoItems = {
        lat: gpsTracks[track].points[foundIndex].lat.toFixed(7),
        lng: gpsTracks[track].points[foundIndex].lon.toFixed(7),
        ele: gpsTracks[track].points[foundIndex].ele.toFixed(4).toString(),
        slope: gpsTracks[track].slopes[foundIndex].toFixed(4).toString(),
        date: timestampArr[0],
        time: timestampArr[1],
        hdg: "",
      };
      const tempInfo = infoDisplay;
      tempInfo[gpsTracks[track].name.toLowerCase()] = items;
      setInfoDisplay(tempInfo);

      //move the markers to the found point and infoDisplay
      markerGPSPoint = gpsTracks[track].points[foundIndex];
      if (gpsTracks[track].name === "EV1") {
        ev1Marker.marker.setLngLat([markerGPSPoint.lon, markerGPSPoint.lat]);
      } else if (gpsTracks[track].name === "EV2") {
        ev2Marker.marker.setLngLat([markerGPSPoint.lon, markerGPSPoint.lat]);
      } else if (gpsTracks[track].name === "Cart") {
        cartMarker.marker.setLngLat([markerGPSPoint.lon, markerGPSPoint.lat]);
      }
    }
    if (lockToggle) {
      map.panTo(ev1Marker.marker._lngLat);
    }
  }, [playhead.date, playhead.seconds, playheadHover.seconds, ancillaryState.dataItems.gpsTracks]);

  //update photo markers
  useEffect(() => {
    if (!map || !playhead.date || photoFiles.length === 0) return;

    // Display photos up until current playhead time
    let targetISODate = getPlayheadISOString(playhead.date, playhead.seconds);
    if (playheadHover.seconds !== 0) {
      // Display photos up until hover time
      targetISODate = getPlayheadISOString(playhead.date, playheadHover.seconds);
    }

    // create a list of photo markers to show
    const photoMarkerList = [];
    let lastPhotoDate = null;
    for (let i = 0; i < photoFiles.length; i++) {
      const thisPhoto = photoFiles[i];
      if (thisPhoto.hasOwnProperty("gps") && thisPhoto.datetimeTaken <= targetISODate) {
        if (thisPhoto.datetimeTaken !== lastPhotoDate) {
          photoMarkerList.push(thisPhoto);
          lastPhotoDate = thisPhoto.datetimeTaken;
        }
      }
    }

    //redraw photo markers if the number to show has differed
    if (photoMarkerList.length !== photoMarkerCount) {
      //remove all photo markers
      for (let i = 0; i < photoMarkers.length; i++) {
        photoMarkers[i].marker.remove();
      }
      const newPhotoMarkers = [];
      for (let i = 0; i < photoMarkerList.length; i++) {
        const thisPhoto = photoMarkerList[i];

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
      setPhotoMarkers(newPhotoMarkers);
      setPhotoMarkerCount(photoMarkerList.length);
    }

    //draw new set of photo markers
  }, [playhead.date, playhead.seconds, playheadHover.seconds, photoFiles]);

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
        {ancillaryState.dataItems.gpsTracks.length > 0 ? showInfo() : <></>}
      </div>
    </>
  );

  function showInfo() {
    return (
      <>
        <div className={styles.info}>
          <div className={styles.infoSection}>
            <table className={styles.valueTable}>
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
              {/* <tr>
                  <td>Bearing (deg):</td>
                  <td>{infoDisplay.ev1.hdg}</td>
                  <td>{infoDisplay.ev2.hdg}</td>
                </tr> */}
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
            </table>
          </div>
        </div>
      </>
    );
  }
}
