import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AlarmProvider } from "./context/AlarmContext";
import { OrdersProvider } from "./context/OrdersContext";
import { CurrencyProvider } from "./context/CurrencyContext";
import { TasksProvider } from "./context/TasksContext";
import { ChatProvider } from "./context/ChatContext";
import AlarmOverlay from "./components/AlarmOverlay";
import AlarmController from "./components/AlarmController";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Board from "./pages/Board";
import DailyChat from "./pages/DailyChat";
import Invoice from "./pages/Invoice";
import Performance from "./pages/Performance";
import Orders from "./pages/Orders";
import Settings from "./pages/Settings";
import Todo from "./pages/Todo";
import Freelance from "./pages/Freelance";
import Earnings from "./pages/Earnings";
import Pengumuman from "./pages/Pengumuman";
import Schedule from "./pages/Schedule";
import Notifications from "./pages/Notifications";
import RencanaStrategis from "./pages/RencanaStrategis";
import TeamMemberPage from "./pages/TeamMemberPage";
import DailyReport from "./pages/DailyReport";
import OrderLayout from "./pages/OrderLayout";
import SlipGaji from "./pages/SlipGaji";
import TimDatabase from "./pages/TimDatabase";
import NotFound from "./pages/NotFound";
import { useAuth } from "./context/AuthContext";

function RoleGuard({ allowedRoles, children }) {
  const { user } = useAuth();
  const role = (user?.role || "talent").toLowerCase();
  const effectiveRole = user?.is_superadmin ? "superadmin" : role;
  if (!allowedRoles.includes(role) && !allowedRoles.includes(effectiveRole)) {
    return <Navigate to="/todo" replace />;
  }
  return children;
}

function App() {
  useEffect(() => {
    // AudioContext must be created AND resumed from a user gesture.
    // We wait for the first real click/key, then unlock once — stays unlocked for the session.
    const unlock = () => {
      if (window._audioCtxUnlocked) return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        ctx.resume().then(() => {
          window._audioCtx = ctx;
          window._audioCtxUnlocked = true;
        }).catch(() => {});
      } catch (_) {}
      document.removeEventListener("click", unlock, true);
      document.removeEventListener("keydown", unlock, true);
      document.removeEventListener("touchstart", unlock, true);
    };
    document.addEventListener("click", unlock, true);
    document.addEventListener("keydown", unlock, true);
    document.addEventListener("touchstart", unlock, true);
    return () => {
      document.removeEventListener("click", unlock, true);
      document.removeEventListener("keydown", unlock, true);
      document.removeEventListener("touchstart", unlock, true);
    };
  }, []);

  return (
    <ThemeProvider>
    <AlarmProvider>
      <AuthProvider>
        <BrowserRouter>
          {/* AlarmController di sini: akses auth + alarm, tidak blokirrouter */}
          <AlarmController />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <CurrencyProvider>
                    <OrdersProvider>
                      <TasksProvider>
                        <ChatProvider>
                          <Layout>
                            <Routes>
                              <Route path="/" element={<Navigate to="/dashboard" replace />} />
                              <Route path="/dashboard" element={<RoleGuard allowedRoles={["admin","pm"]}><Dashboard /></RoleGuard>} />
                              <Route path="/daily-chat" element={<RoleGuard allowedRoles={["admin","pm"]}><DailyChat /></RoleGuard>} />
                              <Route path="/orders" element={<RoleGuard allowedRoles={["admin","pm"]}><Orders /></RoleGuard>} />
                              <Route path="/order-layout" element={<RoleGuard allowedRoles={["admin","pm","talent"]}><OrderLayout /></RoleGuard>} />
                              <Route path="/invoice" element={<RoleGuard allowedRoles={["admin","pm"]}><Invoice /></RoleGuard>} />
                              <Route path="/earnings" element={<RoleGuard allowedRoles={["admin","pm"]}><Earnings /></RoleGuard>} />
                              <Route path="/freelance" element={<RoleGuard allowedRoles={["admin","pm"]}><Freelance /></RoleGuard>} />
                              <Route path="/settings" element={<Settings />} />
                              <Route path="/board" element={<Board />} />
                              <Route path="/todo" element={<Todo />} />
                              <Route path="/performance" element={<Performance />} />
                              <Route path="/performance/team/:artistName" element={<TeamMemberPage />} />
                              <Route path="/daily-report" element={<DailyReport />} />
                              <Route path="/pengumuman" element={<Pengumuman />} />
                              <Route path="/schedule" element={<Schedule />} />
                              <Route path="/notifications" element={<RoleGuard allowedRoles={["admin","pm"]}><Notifications /></RoleGuard>} />
                              <Route path="/rencana/:type" element={<RoleGuard allowedRoles={["admin","pm"]}><RencanaStrategis /></RoleGuard>} />
                              <Route path="/rencana" element={<Navigate to="/rencana/teknis" replace />} />
                              <Route path="/slip-gaji" element={<RoleGuard allowedRoles={["admin","pm"]}><SlipGaji /></RoleGuard>} />
                              <Route path="/tim-database" element={<RoleGuard allowedRoles={["admin","pm"]}><TimDatabase /></RoleGuard>} />
                              <Route path="*" element={<NotFound />} />
                            </Routes>
                          </Layout>
                        </ChatProvider>
                      </TasksProvider>
                    </OrdersProvider>
                  </CurrencyProvider>
                </ProtectedRoute>
              }
            />
          </Routes>
          <Toaster position="top-right" richColors closeButton />
          <AlarmOverlay />
        </BrowserRouter>
      </AuthProvider>
    </AlarmProvider>
    </ThemeProvider>
  );
}

export default App;
