type MapMarker = {
  marker: Marker; //the MapBox marker reference
  markerNode: HTMLDivElement; //the real DOM id of the marker
};

type MapMarkers = {
  EV1?: MapMarker;
  EV2?: MapMarker;
  Cart?: MapMarker;
  LightCart?: MapMarker;
  RUN1?: MapMarker;
  RUN2?: MapMarker;
  RUN3?: MapMarker;
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
  Cart?: mapInfoDisplayItems;
  LightCart?: mapInfoDisplayItems;
  RUN1?: mapInfoDisplayItems;
  RUN2?: mapInfoDisplayItems;
  RUN3?: mapInfoDisplayItems;
};

type TrackFeatures = {
  EV1?: FeatureCollection;
  EV2?: FeatureCollection;
  Cart?: FeatureCollection;
  LightCart?: FeatureCollection;
  RUN1?: FeatureCollection;
  RUN2?: FeatureCollection;
  RUN3?: FeatureCollection;
};
