import * as WikiService from "server/services/wiki-api";
import type { WrappedResponse } from "typings";
import type { Sequence } from "typings/index";

export default async function getTestEventsData(): Promise<WrappedResponse<Sequence[]>> {
  return WikiService.getAllTestEventsData();
}
