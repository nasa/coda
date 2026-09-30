export type EMSSRole =
  | "AEGIS-Editor"
  | "AEGIS-Superuser"
  | "CODA-Superuser"
  | "Maestro-Superuser"
  | "EMSS-Superuser";

export type EmssUser = {
  uupic: string;
  email: string;
  auid: string;
  givenname: string;
  surname: string;
  display_name: string;
  roles?: EMSSRole[] | EMSSRole;
  uscitizen: boolean;
  legal_permanent_resident: boolean;
  usperson: boolean;
  ip_address: string;
};

export type AuthPopup = (props: {
  loginURL: string;
  userInfoURL: string;
  period?: number;
  retry?: number;
}) => Promise<void>;