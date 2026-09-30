export type LogLevel =
  | "emergency"
  | "alert"
  | "critical"
  | "error"
  | "warning"
  | "notice"
  | "info"
  | "debug";

type Primitive = string | number | boolean | bigint | null | undefined;
export type Loggable = { logId: string } & Record<
  string,
  Primitive | Primitive[] | Record<string, Primitive>
>;