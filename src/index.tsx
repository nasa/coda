import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { BrowserRouter } from "react-router";
import store from "./store";
import { Provider } from "react-redux";
import { CookiesProvider } from "react-cookie";
import { baseUrlNoTrailingSlash } from "utils/basePath";

import "./styles.css";
import "@fortawesome/fontawesome-svg-core/styles.css";

// React Router's basename rejects a trailing slash except for the bare "/"
// root case. baseUrlNoTrailingSlash() returns "" for root deploys (prod,
// int, dev VMs) and "/emss/coda/<branch>" for imago tenants — we map the
// empty string back to "/" so React Router gets a valid basename either
// way. See imago/docs/consumer-base-url-rewrite.md.
const routerBasename = baseUrlNoTrailingSlash() || "/";

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter basename={routerBasename}>
        <CookiesProvider>
          <App />
        </CookiesProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
