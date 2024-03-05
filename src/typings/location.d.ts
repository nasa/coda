type MapMarker = {
  marker: Marker; //the MapBox marker reference
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
  EV1?: FeatureCollection;
  EV2?: FeatureCollection;
  EV3?: FeatureCollection;
  EV4?: FeatureCollection;
  Cart?: FeatureCollection;
  LightCart?: FeatureCollection;
  Staff?: FeatureCollection;
};
