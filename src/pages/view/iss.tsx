import { Navigate, useLocation } from "react-router-dom";
import { sourceShortVal } from "utils/consts";

export default function RedirectPage() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  searchParams.append("s", sourceShortVal.ISS.toString());
  return <Navigate to={{ pathname: "/view", search: searchParams.toString() }} />;
}
