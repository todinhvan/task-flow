import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, configureApiClient, unwrapEnvelope } from "@/lib/api";
import type { AuthSession, SessionUser } from "@/types/api";

const STORAGE_KEY = "taskflow.session";

type StoredSession = {
  accessToken: string;
  user: SessionUser;
};

type AuthContextValue = {
  accessToken: string | null;
  refreshToken: string | null;
  user: SessionUser | null;
  isLoading: boolean;
  login: (payload: {
    email: string;
    password: string;
    captchaToken?: string;
  }) => Promise<AuthSession>;
  register: (payload: {
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
    captchaToken?: string;
  }) => Promise<AuthSession>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<SessionUser | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function loadStoredSession() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredSession;
    return {
      ...parsed,
      refreshToken: null,
    } satisfies AuthSession;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() =>
    loadStoredSession(),
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    configureApiClient({
      getToken: () => session?.accessToken ?? null,
      onUnauthorized: () => {
        setSession(null);
        localStorage.removeItem(STORAGE_KEY);
      },
      onRefreshSession: async () => {
        if (!session?.refreshToken) {
          return null;
        }

        try {
          const response = await api.post("/auth/refresh", {
            refreshToken: session.refreshToken,
          });
          const nextSession = unwrapEnvelope<AuthSession>(response.data);
          persistSession(nextSession);
          return nextSession.accessToken;
        } catch {
          persistSession(null);
          return null;
        }
      },
    });
  }, [session]);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      if (!session?.accessToken) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const response = await api.get("/auth/me");
        const user = unwrapEnvelope<SessionUser>(response.data);

        if (!isMounted) {
          return;
        }

        startTransition(() => {
          const nextSession = session
            ? {
                ...session,
                user,
              }
            : null;

          setSession(nextSession);
          if (nextSession) {
            persistStoredSession(nextSession);
          }
        });
      } catch {
        if (!isMounted) {
          return;
        }

        startTransition(() => {
          setSession(null);
          localStorage.removeItem(STORAGE_KEY);
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  const persistSession = (nextSession: AuthSession | null) => {
    setSession(nextSession);
    if (nextSession) {
      persistStoredSession(nextSession);
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken: session?.accessToken ?? null,
      refreshToken: session?.refreshToken ?? null,
      user: session?.user ?? null,
      isLoading,
      login: async (payload) => {
        const response = await api.post("/auth/login", payload);
        const nextSession = unwrapEnvelope<AuthSession>(response.data);
        persistSession(nextSession);
        return nextSession;
      },
      register: async (payload) => {
        const response = await api.post("/auth/register", payload);
        const nextSession = unwrapEnvelope<AuthSession>(response.data);
        persistSession(nextSession);
        return nextSession;
      },
      logout: async () => {
        if (session?.refreshToken) {
          try {
            await api.post("/auth/logout", {
              refreshToken: session.refreshToken,
            });
          } catch {
            // Ignore logout errors and clear the local session regardless.
          }
        }

        persistSession(null);
      },
      refreshUser: async () => {
        if (!session?.accessToken) {
          return null;
        }

        const response = await api.get("/auth/me");
        const user = unwrapEnvelope<SessionUser>(response.data);
        persistSession(
          session
            ? {
                ...session,
                user,
              }
            : null,
        );
        return user;
      },
    }),
    [isLoading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function persistStoredSession(session: AuthSession) {
  const storedSession: StoredSession = {
    accessToken: session.accessToken,
    user: session.user,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(storedSession));
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
