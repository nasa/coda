const SUPERUSER_ROLES: EMSSRole[] = ["EMSS-Superuser", "CODA-Superuser"];

export const isSuperuser = (user: EmssUser | null | undefined): boolean => {
  if (!user?.roles) return false;

  return SUPERUSER_ROLES.some((role) => user.roles.includes(role));
};
