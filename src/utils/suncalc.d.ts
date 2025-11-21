export interface SunTimes {
  solarNoon: Date;
  nadir: Date;
  sunrise: Date;
  sunset: Date;
  sunriseEnd: Date;
  sunsetStart: Date;
  dawn: Date;
  dusk: Date;
  nauticalDawn: Date;
  nauticalDusk: Date;
  nightEnd: Date;
  night: Date;
  goldenHourEnd: Date;
  goldenHour: Date;
  [key: string]: Date;
}

export interface SunPosition {
  azimuth: number;
  altitude: number;
}

export interface MoonPosition extends SunPosition {
  distance: number;
  parallacticAngle: number;
}

export interface MoonIllumination {
  fraction: number;
  phase: number;
  angle: number;
}

export interface MoonTimes {
  rise?: Date;
  set?: Date;
  alwaysUp?: boolean;
  alwaysDown?: boolean;
}

export interface TimeConfig {
  angle: number;
  riseName: string;
  setName: string;
}

export function getPosition(date: Date, lat: number, lng: number): SunPosition;

export function getTimes(date: Date, lat: number, lng: number, height?: number): SunTimes;

export function getMoonPosition(date: Date, lat: number, lng: number): MoonPosition;

export function getMoonIllumination(date?: Date): MoonIllumination;

export function getMoonTimes(date: Date, lat: number, lng: number, inUTC?: boolean): MoonTimes;

export function addTime(angle: number, riseName: string, setName: string): void;

export const times: TimeConfig[];

declare const SunCalc: {
  getPosition: typeof getPosition;
  getTimes: typeof getTimes;
  getMoonPosition: typeof getMoonPosition;
  getMoonIllumination: typeof getMoonIllumination;
  getMoonTimes: typeof getMoonTimes;
  addTime: typeof addTime;
  times: typeof times;
};

export default SunCalc;
