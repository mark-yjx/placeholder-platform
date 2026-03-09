export type AuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'pending_tfa'
  | 'authenticated_admin';

export type AdminUser = {
  email: string;
  userId?: string | null;
  role: 'admin';
  totpEnabled: boolean;
};

export type AdminSessionState = {
  state: AuthStatus;
  user: AdminUser | null;
  pendingExpiresAt?: string | null;
};

export type SessionResponse = {
  state: 'pending_tfa' | 'authenticated_admin';
  token: string;
  user: AdminUser;
  pendingExpiresAt?: string | null;
};

export type TotpEnrollment = {
  secret: string;
  otpauthUri: string;
  issuer: string;
  accountName: string;
};
