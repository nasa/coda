import { FeatureCollection } from "geojson";
import { Marker } from "mapbox-gl";

export type MapMarker = {
  marker: Marker; //the MapBox marker reference
  markerNode: HTMLDivElement; //the real DOM id of the marker
};

export type MapMarkers = {
  EV1: MapMarker;
  EV2: MapMarker;
  Cart: MapMarker;
};

export type mapInfoDisplayItems = {
  lat: string;
  lng: string;
  ele: string;
  hdg: string;
  slope: string;
  date: string;
  time: string;
};

export type mapInfoDisplay = {
  ev1: mapInfoDisplayItems;
  ev2: mapInfoDisplayItems;
  cart: mapInfoDisplayItems;
};

export type TrackFeatures = {
  EV1: FeatureCollection;
  EV2: FeatureCollection;
  Cart: FeatureCollection;
};
