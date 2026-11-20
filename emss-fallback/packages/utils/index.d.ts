export declare const asError: (maybeError: unknown, cause?: unknown) => Error;

export declare const assertEnvVarsExist: <T extends Record<keyof T, string>>(
  ...keys: (keyof T)[]
) => T;