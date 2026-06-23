export type SignedOutAuthMode = "login" | "register";

export function resolveSignedOutAuthMode(value: string | undefined): SignedOutAuthMode {
  return value === "register" ? "register" : "login";
}

export function buildSignedOutAuthModeHref(mode: SignedOutAuthMode, next: string) {
  const query = new URLSearchParams();

  query.set("auth", mode);

  if (next !== "/") {
    query.set("next", next);
  }

  return `/?${query.toString()}`;
}
