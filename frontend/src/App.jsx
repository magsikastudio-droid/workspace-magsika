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
                    <ChatProvider>
                      <Layout>
                        <Routes>
                          <Route path="/" element={<Navigate to="/dashboard" replace />} />
                          <Route path="/dashboard" element={<Dashboard />} />
                          <Route path="/board" element={<Board />} />
                          <Route path="/orders" element={<Orders />} />
                          <Route path="/todo" element={<Todo />} />
                          <Route path="/daily-chat" element={<DailyChat />} />
                          <Route path="/invoice" element={<Invoice />} />
                          <Route path="/performance" element={<Performance />} />
                          <Route path="/earnings" element={<Earnings />} />
                          <Route path="/freelance" element={<Freelance />} />
                          <Route path="/settings" element={<Settings />} />
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
