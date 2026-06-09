import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import { OrdersProvider } from "./context/OrdersContext";
import { CurrencyProvider } from "./context/CurrencyContext";
import { TasksProvider } from "./context/TasksContext";
import { ChatProvider } from "./context/ChatContext";
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
import NotFound from "./pages/NotFound";
import { useAuth } from "./context/AuthContext";

function RoleGuard({ allowedRoles, children }) {
  const { user } = useAuth();
  const role = user?.role || "talent";
  if (!allowedRoles.includes(role)) {
    return <Navigate to="/todo" replace />;
  }
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
                            <Route path="/invoice" element={<RoleGuard allowedRoles={["admin","pm"]}><Invoice /></RoleGuard>} />
                            <Route path="/earnings" element={<RoleGuard allowedRoles={["admin","pm"]}><Earnings /></RoleGuard>} />
                            <Route path="/freelance" element={<RoleGuard allowedRoles={["admin","pm"]}><Freelance /></RoleGuard>} />
                            <Route path="/settings" element={<RoleGuard allowedRoles={["admin","pm"]}><Settings /></RoleGuard>} />
                            <Route path="/board" element={<Board />} />
                            <Route path="/todo" element={<Todo />} />
                            <Route path="/performance" element={<Performance />} />
                            <Route path="/pengumuman" element={<Pengumuman />} />
                            <Route path="/schedule" element={<Schedule />} />
                            <Route path="/notifications" element={<RoleGuard allowedRoles={["admin","pm"]}><Notifications /></RoleGuard>} />
                            <Route path="/rencana/:type" element={<RoleGuard allowedRoles={["admin","pm"]}><RencanaStrategis /></RoleGuard>} />
                            <Route path="/rencana" element={<Navigate to="/rencana/teknis" replace />} />
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
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
