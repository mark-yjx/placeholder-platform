import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState
} from 'react';
import {
  confirmTotpEnrollment,
  fetchCurrentAdmin,
  loginAdminLocal,
  logoutAdmin,
  microsoftLoginUrl,
  verifyAdminTotp
} from './client';
import { clearStoredAdminToken, readStoredAdminToken, storeAdminToken } from './storage';
import type { AdminSessionState, AdminUser, AuthStatus } from './types';

type AuthContextValue = {
  status: AuthStatus;
  user: AdminUser | null;
  pendingExpiresAt: string | null;
  loginLocal: (email: string, password: string) => Promise<AuthStatus>;
  beginMicrosoftLogin: () => void;
  completeCallback: (token: string) => Promise<AuthStatus>;
  verifyTotp: (code: string) => Promise<void>;
  refreshSession: () => Promise<AuthStatus>;
  confirmEnrollment: (code: string) => Promise<void>;
  logout: () => Promise<void>;
};

type AuthProviderProps = PropsWithChildren<{
  initialSession?: AdminSessionState;
}>;

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapStateToContext(nextState: AdminSessionState): {
  status: AuthStatus;
  user: AdminUser | null;
  pendingExpiresAt: string | null;
} {
  return {
    status: nextState.state,
    user: nextState.user,
    pendingExpiresAt: nextState.pendingExpiresAt ?? null
  };
}

export function AuthProvider({ children, initialSession }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>(() => {
    if (initialSession) {
      return initialSession.state;
    }

    return readStoredAdminToken() ? 'loading' : 'unauthenticated';
  });
  const [user, setUser] = useState<AdminUser | null>(initialSession?.user ?? null);
  const [pendingExpiresAt, setPendingExpiresAt] = useState<string | null>(
    initialSession?.pendingExpiresAt ?? null
  );

  async function refreshSession(): Promise<AuthStatus> {
    const storedToken = readStoredAdminToken();

    const nextState = await fetchCurrentAdmin(storedToken);
    if (nextState.state === 'unauthenticated') {
      clearStoredAdminToken();
    }

    const mapped = mapStateToContext(nextState);
    setStatus(mapped.status);
    setUser(mapped.user);
    setPendingExpiresAt(mapped.pendingExpiresAt);
    return mapped.status;
  }

  useEffect(() => {
    if (initialSession) {
      return;
    }

    let cancelled = false;

    refreshSession()
      .catch(() => {
        clearStoredAdminToken();
        if (cancelled) {
          return;
        }

        setStatus('unauthenticated');
        setUser(null);
        setPendingExpiresAt(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value: AuthContextValue = {
    status,
    user,
    pendingExpiresAt,
    async loginLocal(email: string, password: string) {
      const response = await loginAdminLocal(email, password);
      storeAdminToken(response.token);
      setStatus(response.state);
      setUser(response.user);
      setPendingExpiresAt(response.pendingExpiresAt ?? null);
      return response.state;
    },
    beginMicrosoftLogin() {
      window.location.assign(microsoftLoginUrl());
    },
    async completeCallback(token: string) {
      storeAdminToken(token);
      return refreshSession();
    },
    async verifyTotp(code: string) {
      const storedToken = readStoredAdminToken();
      if (!storedToken) {
        throw new Error('Pending admin verification is missing or expired.');
      }

      const response = await verifyAdminTotp(storedToken, code);
      storeAdminToken(response.token);
      setStatus('authenticated_admin');
      setUser(response.user);
      setPendingExpiresAt(null);
    },
    async confirmEnrollment(code: string) {
      const storedToken = readStoredAdminToken();
      if (!storedToken) {
        throw new Error('Admin session is invalid.');
      }

      await confirmTotpEnrollment(storedToken, code);
      await refreshSession();
    },
    refreshSession,
    async logout() {
      const storedToken = readStoredAdminToken();
      try {
        await logoutAdmin(storedToken);
      } finally {
        clearStoredAdminToken();
        setStatus('unauthenticated');
        setUser(null);
        setPendingExpiresAt(null);
      }
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
}
