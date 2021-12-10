import { FeatureCollection } from "geojson";
import { Marker } from "mapbox-gl";

type MapMarker = {
  marker: Marker; //the MapBox marker reference
  markerNode: HTMLDivElement; //the real DOM id of the marker
};

type MapMarkers = {
  EV1: MapMarker;
  EV2: MapMarker;
  Cart: MapMarker;
};

type mapInfoDisplayItems = {
  lat: string;
  lng: string;
  ele: string;
  hdg: string;
  slope: string;
  date: string;
  time: string;
};

type mapInfoDisplay = {
  ev1: mapInfoDisplayItems;
  ev2: mapInfoDisplayItems;
  cart: mapInfoDisplayItems;
};

type TrackFeatures = {
  EV1: FeatureCollection;
  EV2: FeatureCollection;
  Cart: FeatureCollection;
};
