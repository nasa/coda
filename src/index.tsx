import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import store from "./store";
import { Provider } from "react-redux";
import PulseAnalytics from "components/pulse";

import "./styles.css";
import "@fortawesome/fontawesome-svg-core/styles.css";

const root = createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
    <PulseAnalytics />
  </React.StrictMode>
);
