import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "./AuthContext";
import { subscribe } from "../lib/ws";

const TasksContext = createContext(null);

export function TasksProvider({ children }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  // Beda dari `loading` — cuma true SEBELUM data pertama kali kebaca. Tiap
  // ada perubahan task (hapus/approve/dll, dari siapa pun), WS broadcast
  // "tasks_updated" ke SEMUA klien yang lagi buka To Do, yang bikin
  // fetchTasks() jalan lagi di background. Kalau halaman nge-gate render-nya
  // pakai `loading` biasa, list-nya sempat diganti "Memuat..." tiap kali itu
  // kejadian — kelihatan kayak "refresh" dan scroll balik ke atas walau
  // datanya sendiri gak berubah drastis. Pakai `initialLoading` buat render
  // gate, biar refetch di background gak nampilin placeholder lagi.
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchTasks = useCallback(
    async (date) => {
      setLoading(true);
      try {
        const res = await api.get("/tasks", { params: date ? { date } : {} });
        setTasks(res.data.tasks);
      } catch (error) {
        setTasks([]);
        console.error("Failed to fetch tasks", error);
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    },
    []
  );

  const createTask = useCallback(async (payload) => {
    const res = await api.post("/tasks", payload);
    setTasks((current) => [res.data.task, ...current]);
    return res.data.task;
  }, []);

  const updateTask = useCallback(async (id, payload) => {
    const res = await api.patch(`/tasks/${id}`, payload);
    setTasks((current) => current.map((task) => (task.id === id ? res.data.task : task)));
    return res.data.task;
  }, []);

  const deleteTask = useCallback(async (id) => {
    await api.delete(`/tasks/${id}`);
    setTasks((current) => current.filter((task) => task.id !== id));
  }, []);

  useEffect(() => {
    if (!user) {
      setTasks([]);
      return;
    }
    fetchTasks();
    const unsub = subscribe("tasks_updated", () => fetchTasks());
    return unsub;
  }, [user, fetchTasks]);

  return (
    <TasksContext.Provider value={{ tasks, loading, initialLoading, fetchTasks, createTask, updateTask, deleteTask }}>
      {children}
    </TasksContext.Provider>
  );
}

export function useTasks() {
  return useContext(TasksContext);
}
