const SUPERUSER_ROLES: EMSSRole[] = ["EMSS-Superuser", "CODA-Superuser"];

export const isSuperuser = (user: EmssUser | null | undefined): boolean => {
  const roles = user?.roles;
  if (!roles) return false;

  return SUPERUSER_ROLES.some((role) => roles.includes(role));
};
