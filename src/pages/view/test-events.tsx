import { Navigate, useLocation } from "react-router-dom";
import { SourceShortVal } from "utils/enums";

export default function RedirectPage() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  searchParams.append("s", SourceShortVal.TEST_EVENTS.toString());
  return <Navigate to={{ pathname: "/view", search: searchParams.toString() }} />;
}
