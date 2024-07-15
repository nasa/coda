declare module "tle.js" {
  export default class TLE {
    constructor();
    // Add any specific methods or properties you use from tle.js here.
    static getLatLngObj(tle: string[], time?: Date): { lat: number; lng: number };
    static getSatelliteInfo(
      tle: string[],
      time: Date
    ): { lat: number; lng: number; altitude: number; velocity: number };
  }
}
