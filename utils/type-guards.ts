/**
 * A type guard that checks if a variable is an object and it has the specified property.
 */
export const hasProp = <K extends string>(
  obj: unknown,
  property: K
): obj is { [property in K]: unknown } => {
  return obj && typeof obj === "object" ? property in obj : false;
};
