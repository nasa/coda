type MapMarker = {
  marker: import("mapbox-gl").Marker; //the MapBox marker reference
  markerNode: HTMLDivElement; //the real DOM id of the marker
};

type MapMarkers = {
  EV1?: MapMarker;
  EV2?: MapMarker;
  EV3?: MapMarker;
  EV4?: MapMarker;
  Cart?: MapMarker;
  LightCart?: MapMarker;
  Staff?: MapMarker;
};

type MapInfoDisplayItems = {
  lat: string;
  lng: string;
  ele: string;
  hdg: string;
  date: string;
  time: string;
};

type MapInfoDisplay = {
  EV1?: MapInfoDisplayItems;
  EV2?: MapInfoDisplayItems;
  EV3?: MapInfoDisplayItems;
  EV4?: MapInfoDisplayItems;
  Cart?: MapInfoDisplayItems;
  LightCart?: MapInfoDisplayItems;
  Staff?: MapInfoDisplayItems;
};

type TrackFeatures = {
  EV1?: import("geojson").FeatureCollection;
  EV2?: import("geojson").FeatureCollection;
  EV3?: import("geojson").FeatureCollection;
  EV4?: import("geojson").FeatureCollection;
  Cart?: import("geojson").FeatureCollection;
  LightCart?: import("geojson").FeatureCollection;
  Staff?: import("geojson").FeatureCollection;
};
