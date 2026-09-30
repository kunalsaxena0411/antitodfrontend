import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { AUTH_CONFIG } from "../config/config";

type AuthContextType = {
  token: string | null;
  initialized: boolean;
  isAuthenticated: boolean;
  saveToken: (t: string) => void;
  removeToken: () => void;
};

const AuthContext = createContext<AuthContextType>({
  token: null,
  initialized: false,
  isAuthenticated: false,
  saveToken: () => {},
  removeToken: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [initialized, setInitialized] = useState<boolean>(false);

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
    if (stored) {
      setToken(stored);
    }
    setInitialized(true);
  }, []);

  useEffect(() => {}, [token]);

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

  const saveToken = useCallback((userToken: string) => {
    localStorage.setItem(AUTH_CONFIG.TOKEN_KEY, userToken);
    setToken(userToken);
    setInitialized(true);
    window.dispatchEvent(new Event("auth-changed"));
  }, []);

  const removeToken = useCallback(() => {
    localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
    setToken(null);
    window.dispatchEvent(new Event("auth-changed"));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token,
        initialized,
        isAuthenticated: !!token,
        saveToken,
        removeToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
