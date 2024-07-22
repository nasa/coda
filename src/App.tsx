import React from "react";
import { Route, Routes } from "react-router-dom";
import Index from "pages/index";
import View from "pages/view";
import Iss from "pages/view/iss";
import Nbl from "pages/view/nbl";
import TestEvents from "pages/view/test-events";
import Admin from "pages/admin";
import AdminGps from "pages/admin/gps";
import AdminMediaOverrides from "pages/admin/mediaOverrides";
import AdminAncillaryData from "pages/admin/ancillaryData";
import { EditGPSRecord } from "pages/admin/gpsUpsert";
import { EditMediaOverridesRecord } from "pages/admin/mediaOverridesUpsert";
import { EditAncillaryDataRecord } from "pages/admin/ancillaryDataUpsert";
import { EnsureLogin } from "./packages/EnsureLogin";

const App = (): React.ReactElement => {
  return (
    <>
      <EnsureLogin />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/view" element={<View />} />
        <Route path="/view/iss" element={<Iss />} />
        <Route path="/view/nbl" element={<Nbl />} />
        <Route path="/view/test-events" element={<TestEvents />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/gps" element={<AdminGps />} />
        <Route path="/admin/mediaOverrides" element={<AdminMediaOverrides />} />
        <Route path="/admin/ancillaryData" element={<AdminAncillaryData />} />
        <Route path="/admin/gpsUpsert" element={<EditGPSRecord />} />
        <Route path="/admin/mediaOverridesUpsert" element={<EditMediaOverridesRecord />} />
        <Route path="/admin/ancillaryDataUpsert" element={<EditAncillaryDataRecord />} />
      </Routes>
    </>
  );
};

export default App;
