import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import { OrdersProvider } from "./context/OrdersContext";
import { CurrencyProvider } from "./context/CurrencyContext";
import { TasksProvider } from "./context/TasksContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Board from "./pages/Board";
import DailyChat from "./pages/DailyChat";
import Invoice from "./pages/Invoice";
import Performance from "./pages/Performance";
import Orders from "./pages/Orders";
import Settings from "./pages/Settings";
import Todo from "./pages/Todo";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <CurrencyProvider>
                  <OrdersProvider>
                    <TasksProvider>
                      <Layout>
                      <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/board" element={<Board />} />
                        <Route path="/orders" element={<Orders />} />
                        <Route path="/daily-chat" element={<DailyChat />} />
                        <Route path="/invoice" element={<Invoice />} />
                        <Route path="/todo" element={<Todo />} />
                        <Route path="/performance" element={<Performance />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                      </Layout>
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
