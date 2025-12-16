import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { BrowserRouter } from "react-router";
import store from "./store";
import { Provider } from "react-redux";
import { CookiesProvider } from "react-cookie";
import { ConsoleLogger, LogLevel } from "./utils/logging/consoleLogger";

import "./styles.css";
import "@fortawesome/fontawesome-svg-core/styles.css";

// Set console logging level on the client side based on the environment variable
const logLevel = (import.meta.env.VITE_PUBLIC_LOG_LEVEL as LogLevel) || "off";
ConsoleLogger.setLevel(logLevel);

const root = createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <CookiesProvider>
          <App />
        </CookiesProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
