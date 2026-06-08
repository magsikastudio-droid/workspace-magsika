import React, { createContext, useCallback, useContext, useState } from "react";
import { api } from "../lib/api";

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchEntries = useCallback(async (month) => {
    setLoading(true);
    try {
      const res = await api.get("/chat-entries", { params: month ? { month } : {} });
      setEntries(res.data.entries);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const createEntry = useCallback(async (payload) => {
    const res = await api.post("/chat-entries", payload);
    setEntries((curr) => [...curr, res.data.entry]);
    return res.data.entry;
  }, []);

  const updateEntry = useCallback(async (id, payload) => {
    try {
      const res = await api.patch(`/chat-entries/${id}`, payload);
      setEntries((curr) => curr.map((e) => (e.id === id ? res.data.entry : e)));
      return res.data.entry;
    } catch (err) {
      console.error("Update chat entry failed", err);
      throw err;
    }
  }, []);

  const deleteEntry = useCallback(async (id) => {
    await api.delete(`/chat-entries/${id}`);
    setEntries((curr) => curr.filter((e) => e.id !== id));
  }, []);

  return (
    <ChatContext.Provider value={{ entries, loading, fetchEntries, createEntry, updateEntry, deleteEntry }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  return useContext(ChatContext);
}
