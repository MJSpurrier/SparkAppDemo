export interface AccountProfile {
  email: string;
  realName: string;
  username: string;
}

export type AccountField = "email" | "realName" | "username";
export type AccountError = "required" | "email" | "username";
export type AccountFieldErrors = Partial<Record<AccountField, AccountError>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Letters or numbers, then letters, numbers, dot, underscore, or hyphen. 2–24 characters. */
const USERNAME = /^[\p{L}\p{N}][\p{L}\p{N}_.-]{1,23}$/u;

export function validateAccount(input: {
  email: string;
  realName: string;
  username: string;
}): { ok: true; value: AccountProfile } | { ok: false; errors: AccountFieldErrors } {
  const email = input.email.trim().toLowerCase();
  const realName = input.realName.trim().replace(/\s+/g, " ");
  const username = input.username.trim();
  const errors: AccountFieldErrors = {};
  if (!email) errors.email = "required";
  else if (!EMAIL.test(email) || email.length > 254) errors.email = "email";
  if (!realName) errors.realName = "required";
  else if (realName.length > 80) errors.realName = "required";
  if (!username) errors.username = "required";
  else if (!USERNAME.test(username)) errors.username = "username";
  if (errors.email || errors.realName || errors.username) return { ok: false, errors };
  return { ok: true, value: { email, realName, username } };
}

export interface AuthResult {
  ok: true;
  profile: AccountProfile;
}

export interface AuthFailure {
  ok: false;
  message: string;
}

/**
 * The only thing the screen needs from an account system.
 * Swap this for Supabase later (magic link or password, then cloud sync) without rewriting the form.
 */
export interface AuthProvider {
  createAccount(profile: AccountProfile): Promise<AuthResult | AuthFailure>;
}

/** Keeps the account on this device. It does not contact a server. */
export function createDeviceAuth(): AuthProvider {
  return {
    async createAccount(profile) {
      return { ok: true, profile: { ...profile } };
    },
  };
}
