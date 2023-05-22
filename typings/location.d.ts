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

type mapInfoDisplayItems = {
  lat: string;
  lng: string;
  ele: string;
  hdg: string;
  slope: string;
  date: string;
  time: string;
};

type MapInfoDisplay = {
  EV1?: mapInfoDisplayItems;
  EV2?: mapInfoDisplayItems;
  EV3?: mapInfoDisplayItems;
  EV4?: mapInfoDisplayItems;
  Cart?: mapInfoDisplayItems;
  LightCart?: mapInfoDisplayItems;
  Staff?: mapInfoDisplayItems;
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
