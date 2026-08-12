import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, setAuthToken } from "../lib/api";
import { connect as wsConnect, disconnect as wsDisconnect } from "../lib/ws";
import { sendLocationToServer, startLocationTracking } from "../lib/location";

const AuthContext = createContext(null);
const TOKEN_KEY = "admin_dashboard_token";

export { TOKEN_KEY };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || null);
  const [loading, setLoading] = useState(true);
  const retryTimerRef = useRef(null);
  const retryCountRef = useRef(0);

  const saveToken = (tok) => {
    if (tok) {
      localStorage.setItem(TOKEN_KEY, tok);
      setAuthToken(tok);
      setToken(tok);
      wsConnect(tok);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      setAuthToken(null);
      setToken(null);
      wsDisconnect();
    }
  };

  const fetchUser = useCallback(async () => {
    try {
      const res = await api.get("/auth/me");
      retryCountRef.current = 0;
      setUser(res.data.user);
      setLoading(false);
      sendLocationToServer();
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
    const stopTracking = startLocationTracking();
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      stopTracking();
    };
  }, [fetchUser]);

  const login = async ({ email, password }) => {
    const res = await api.post("/auth/login", { email, password });
    saveToken(res.data.access_token);
    setUser(res.data.user);
    return res.data;
  };

  // Kept for backwards compat (no longer used for OTP flow)
  const loginWithToken = (accessToken, userData) => {
    saveToken(accessToken);
    setUser(userData);
  };

  const logout = () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    saveToken(null);
    setUser(null);
    window.location.href = "/login";
  };

  // Update sebagian field user tanpa refetch — dipakai abis panggil endpoint
  // kecil kayak /presence/toggle yang langsung balikin state terbaru.
  const patchUser = (partial) => setUser((prev) => (prev ? { ...prev, ...partial } : prev));

  return (
    <AuthContext.Provider value={{ user, token, loading, login, loginWithToken, logout, patchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
