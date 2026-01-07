import { Navigate, useLocation } from "react-router";
import { sourceShortVal } from "utils/consts";

export default function RedirectPage(): React.ReactElement {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  searchParams.append("s", sourceShortVal.TEST_EVENTS.toString());
  return <Navigate to={{ pathname: "/view", search: searchParams.toString() }} />;
}
