import React from "react";
import { Route, Routes } from "react-router-dom";
import Index from "pages/index";
import View from "pages/view";
import Iss from "pages/view/iss";
import Nbl from "pages/view/nbl";
import TestEvents from "pages/view/test-events";

const App = (): React.ReactElement => {
  return (
    <>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/view" element={<View />} />
        <Route path="/view/iss" element={<Iss />} />
        <Route path="/view/nbl" element={<Nbl />} />
        <Route path="/view/test-events" element={<TestEvents />} />
      </Routes>
    </>
  );
};

export default App;
