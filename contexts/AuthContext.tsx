import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AUTH_CONFIG } from "../config/config";
import { authService, type AuthGroup } from "../api/services/authService";

type AdminIdentity = {
  AdminID: string;
  AdminEmail: string;
  CustomerID?: string | null;
};

type AuthContextType = {
  token: string | null;
  initialized: boolean;
  isAuthenticated: boolean;
  permissions: string[];
  groups: AuthGroup[];
  admin: AdminIdentity | null;
  permissionsLoaded: boolean;
  can: (permissionId: string) => boolean;
  canAny: (permissionIds: string[]) => boolean;
  saveToken: (
    t: string,
    meta?: {
      permissions?: string[];
      groups?: AuthGroup[];
      admin?: AdminIdentity;
      expiresAt?: string;
    }
  ) => void;
  removeToken: () => void;
  refreshPermissions: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  token: null,
  initialized: false,
  isAuthenticated: false,
  permissions: [],
  groups: [],
  admin: null,
  permissionsLoaded: false,
  can: () => false,
  canAny: () => false,
  saveToken: () => {},
  removeToken: () => {},
  refreshPermissions: async () => {},
});

function readStoredExpiryMs(): number | null {
  const raw = localStorage.getItem(AUTH_CONFIG.TOKEN_EXPIRES_KEY);
  if (!raw) return null;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function isStoredSessionExpired(): boolean {
  const expiresMs = readStoredExpiryMs();
  if (expiresMs === null) return false; // unknown expiry — let API enforce
  return expiresMs <= Date.now();
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [initialized, setInitialized] = useState<boolean>(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [groups, setGroups] = useState<AuthGroup[]>([]);
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  const clearMeta = useCallback(() => {
    setPermissions([]);
    setGroups([]);
    setAdmin(null);
    setPermissionsLoaded(false);
  }, []);

  const removeToken = useCallback(() => {
    localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
    localStorage.removeItem(AUTH_CONFIG.TOKEN_EXPIRES_KEY);
    setToken(null);
    clearMeta();
    window.dispatchEvent(new Event("auth-changed"));
  }, [clearMeta]);

  const refreshPermissions = useCallback(async () => {
    const t = localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
    if (!t) {
      clearMeta();
      return;
    }
    if (isStoredSessionExpired()) {
      removeToken();
      return;
    }
    try {
      const me = await authService.me();
      setAdmin(me.admin);
      setGroups(me.groups || []);
      setPermissions(me.permissions || []);
      setPermissionsLoaded(true);
    } catch (err) {
      console.warn("[AuthProvider] Failed to load /me", err);
      // Keep token; permissions empty until re-login if legacy token
      setPermissions([]);
      setGroups([]);
      setPermissionsLoaded(true);
    }
  }, [clearMeta, removeToken]);

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
    if (stored) {
      if (isStoredSessionExpired()) {
        localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
        localStorage.removeItem(AUTH_CONFIG.TOKEN_EXPIRES_KEY);
        setToken(null);
      } else {
        setToken(stored);
      }
    }
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!initialized) return;
    if (token) {
      void refreshPermissions();
    } else {
      clearMeta();
    }
  }, [token, initialized, refreshPermissions, clearMeta]);

  // Proactively clear local session when expiresAt is reached
  useEffect(() => {
    if (!token) return;
    const expiresMs = readStoredExpiryMs();
    if (expiresMs === null) return;
    const delay = expiresMs - Date.now();
    if (delay <= 0) {
      removeToken();
      return;
    }
    const timer = window.setTimeout(() => {
      console.warn("[AuthProvider] Session TTL reached — clearing token");
      removeToken();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [token, removeToken]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === AUTH_CONFIG.TOKEN_KEY) {
        setToken(e.newValue);
      }
    };

    const onAuthChange = () => {
      const t = localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
      setToken(t);
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("auth-changed", onAuthChange);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("auth-changed", onAuthChange);
    };
  }, []);

  const saveToken = useCallback(
    (
      userToken: string,
      meta?: {
        permissions?: string[];
        groups?: AuthGroup[];
        admin?: AdminIdentity;
        expiresAt?: string;
      }
    ) => {
      localStorage.setItem(AUTH_CONFIG.TOKEN_KEY, userToken);
      if (meta?.expiresAt) {
        localStorage.setItem(AUTH_CONFIG.TOKEN_EXPIRES_KEY, meta.expiresAt);
      } else {
        localStorage.removeItem(AUTH_CONFIG.TOKEN_EXPIRES_KEY);
      }
      setToken(userToken);
      setInitialized(true);
      if (meta?.permissions) setPermissions(meta.permissions);
      if (meta?.groups) setGroups(meta.groups);
      if (meta?.admin) setAdmin(meta.admin);
      if (meta?.permissions) setPermissionsLoaded(true);
      window.dispatchEvent(new Event("auth-changed"));
    },
    []
  );

  const can = useCallback(
    (permissionId: string) => permissions.includes(permissionId),
    [permissions]
  );

  const canAny = useCallback(
    (permissionIds: string[]) =>
      permissionIds.some((p) => permissions.includes(p)),
    [permissions]
  );

  const value = useMemo(
    () => ({
      token,
      initialized,
      isAuthenticated: !!token,
      permissions,
      groups,
      admin,
      permissionsLoaded,
      can,
      canAny,
      saveToken,
      removeToken,
      refreshPermissions,
    }),
    [
      token,
      initialized,
      permissions,
      groups,
      admin,
      permissionsLoaded,
      can,
      canAny,
      saveToken,
      removeToken,
      refreshPermissions,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
