import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState
} from 'react';
import { clearStoredAdminToken, readStoredAdminToken, storeAdminToken } from './storage';
import { fetchCurrentAdmin, loginAdmin } from './client';
import type { AdminUser } from './types';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  status: AuthStatus;
  user: AdminUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>(() =>
    readStoredAdminToken() ? 'loading' : 'unauthenticated'
  );
  const [user, setUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    const storedToken = readStoredAdminToken();
    if (!storedToken) {
      setStatus('unauthenticated');
      return;
    }

    let cancelled = false;

    fetchCurrentAdmin(storedToken)
      .then((adminUser) => {
        if (cancelled) {
          return;
        }

        setUser(adminUser);
        setStatus('authenticated');
      })
      .catch(() => {
        clearStoredAdminToken();
        if (cancelled) {
          return;
        }

        setUser(null);
        setStatus('unauthenticated');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value: AuthContextValue = {
    status,
    user,
    async login(email: string, password: string) {
      const response = await loginAdmin(email, password);
      storeAdminToken(response.token);
      setUser(response.user);
      setStatus('authenticated');
    },
    logout() {
      clearStoredAdminToken();
      setUser(null);
      setStatus('unauthenticated');
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
