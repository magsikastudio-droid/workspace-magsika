import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, setAuthToken } from "../lib/api";

const AuthContext = createContext(null);
const TOKEN_KEY = "admin_dashboard_token";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const saveToken = (token) => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      setAuthToken(token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      setAuthToken(null);
    }
  };

  const fetchUser = useCallback(async () => {
    try {
      const res = await api.get("/auth/me");
      setUser(res.data.user);
    } catch {
      saveToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      setAuthToken(token);
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [fetchUser]);

  const login = async ({ username, password }) => {
    const res = await api.post("/auth/login", { username, password });
    saveToken(res.data.access_token);
    await fetchUser();
    return res.data;
  };

  const logout = () => {
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
