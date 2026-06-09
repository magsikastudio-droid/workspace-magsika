import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";
import { mockOrders } from "../lib/mockData";
import { useAuth } from "./AuthContext";
import { subscribe } from "../lib/ws";

const OrdersContext = createContext(null);

export function OrdersProvider({ children }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState(mockOrders);
  const [loading, setLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/orders");
      setOrders(res.data.orders);
    } catch {
      setOrders(mockOrders);
    } finally {
      setLoading(false);
    }
  }, []);

  const createOrder = useCallback(async (payload) => {
    try {
      const res = await api.post("/orders", payload);
      setOrders((curr) => [res.data.order, ...curr]);
      return res.data.order;
    } catch (error) {
      console.error("Create order failed", error);
      throw error;
    }
  }, []);

  const updateOrder = useCallback(async (orderId, payload) => {
    try {
      const res = await api.patch(`/orders/${orderId}`, payload);
      setOrders((curr) => curr.map((o) => (o.id === orderId ? res.data.order : o)));
      return res.data.order;
    } catch (error) {
      console.error("Update order failed", error);
      throw error;
    }
  }, []);

  const deleteOrder = useCallback(async (orderId) => {
    try {
      await api.delete(`/orders/${orderId}`);
      setOrders((curr) => curr.filter((o) => o.id !== orderId));
    } catch (error) {
      console.error("Delete order failed", error);
      throw error;
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchOrders();
    const unsub = subscribe("orders_updated", fetchOrders);
    return unsub;
  }, [user, fetchOrders]);

  return (
    <OrdersContext.Provider value={{ orders, loading, fetchOrders, createOrder, updateOrder, deleteOrder }}>
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  return useContext(OrdersContext);
}
