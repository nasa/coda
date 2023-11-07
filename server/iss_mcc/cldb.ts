import * as CLDBService from "server/services/cldb";

export default async function getConsoleLog(
  disciplines: string,
  year: number,
  julianday: number
): Promise<WrappedResponse<any>> {
  return await CLDBService.fetchConsoleLog(disciplines, year, julianday);
}
