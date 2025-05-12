// This file ensures JSX namespace compatibility for libraries like FontAwesome
// that may reference JSX.Element directly
// It should be temporary. When upgrading packages, check to see if this is still needed

import React from "react";

declare global {
  namespace JSX {
    interface Element extends React.ReactElement {}
    interface IntrinsicElements extends React.JSX.IntrinsicElements {}
    interface ElementChildrenAttribute extends React.JSX.ElementChildrenAttribute {}
  }
}

export {};
