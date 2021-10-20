import * as WikiService from "server/services/wiki-api";
import type { WrappedResponse } from "typings";
import type { Sequence } from "typings/index";

export default async function getEVAData(): Promise<WrappedResponse<Sequence[]>> {
  return WikiService.getAllEVAData();
}
