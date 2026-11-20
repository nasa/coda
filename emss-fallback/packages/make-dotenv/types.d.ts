type EnvValue = string | number | boolean;
type EnvVarSettings =
  | EnvValue
  | { type: "required-from-secret" }
  | { type: "make-directory-if-missing"; value: string }
  | { type: "generate-to-secret-if-missing"; length?: number; characters?: string }
  | { type: "alternate-varname-from-secret-file"; value: string };
type AllEnvironments<T extends readonly string[]> = Record<T[number], EnvVarSettings>;
type PartialEnvironmentsWithDefault<T extends readonly string[]> = Partial<AllEnvironments<T>> & {
  default: EnvVarSettings;
};

export type DotenvConfig<T extends readonly string[]> = Record<
  string,
  AllEnvironments<T> | PartialEnvironmentsWithDefault<T>
>;