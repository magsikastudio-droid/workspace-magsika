import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, setAuthToken } from "../lib/api";
import { connect as wsConnect, disconnect as wsDisconnect, subscribe } from "../lib/ws";
import { initNotifications, showTaskAlarm } from "../lib/notifications";

const AuthContext = createContext(null);
const TOKEN_KEY = "admin_dashboard_token";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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
      wsConnect(token);
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [fetchUser]);

  // Init notifikasi, pasang WS listener, dan polling fallback
  const lastUnreadCount = useRef(-1);

  useEffect(() => {
    if (!user) {
      lastUnreadCount.current = -1;
      return;
    }

    initNotifications();

    // WS: instant notification saat task jadi menunggu_review
    const unsubWS = subscribe("task_alert", (msg) => {
      showTaskAlarm(msg.task_title, msg.assignee);
    });

    // Polling fallback tiap 20 detik (untuk saat WS belum aktif di server)
    const poll = async () => {
      try {
        const res = await api.get("/notifications/unread-count");
        const count = res.data.count ?? 0;
        if (lastUnreadCount.current >= 0 && count > lastUnreadCount.current) {
          showTaskAlarm("Ada task menunggu review", "Cek notifikasi baru");
        }
        lastUnreadCount.current = count;
      } catch {}
    };

    poll(); // cek langsung saat login
    const interval = setInterval(poll, 20000);

    return () => {
      unsubWS();
      clearInterval(interval);
    };
  }, [user]);

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
