import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, setAuthToken } from "../lib/api";
import { connect as wsConnect, disconnect as wsDisconnect } from "../lib/ws";

const AuthContext = createContext(null);
const TOKEN_KEY = "admin_dashboard_token";

export { TOKEN_KEY };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const retryTimerRef = useRef(null);
  const retryCountRef = useRef(0);

  const saveToken = (token) => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      setAuthToken(token);
      wsConnect(token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      setAuthToken(null);
      wsDisconnect();
    }
  };

  const fetchUser = useCallback(async () => {
    try {
      const res = await api.get("/auth/me");
      retryCountRef.current = 0;
      setUser(res.data.user);
      setLoading(false);
    } catch (err) {
      if (err?.response?.status === 401) {
        // Token expired or invalid — must re-login
        retryCountRef.current = 0;
        saveToken(null);
        setUser(null);
        setLoading(false);
      } else {
        // Transient error (network blip, server restart) — retry a few times
        retryCountRef.current += 1;
        if (retryCountRef.current <= 3) {
          retryTimerRef.current = setTimeout(fetchUser, 3000);
        } else {
          // Retries exhausted — keep token, let user manually retry
          retryCountRef.current = 0;
          setLoading(false);
        }
      }
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      setAuthToken(token);
      wsConnect(token);
      fetchUser();
    } else {
      setLoading(false);
    }
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [fetchUser]);

  const login = async ({ username, password }) => {
    const res = await api.post("/auth/login", { username, password });
    saveToken(res.data.access_token);
    await fetchUser();
    return res.data;
  };

  const logout = () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    saveToken(null);
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
