import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";
import { mockOrders } from "../lib/mockData";
import { useAuth } from "./AuthContext";

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

  const createOrder = useCallback(
    async (payload) => {
      try {
        const res = await api.post("/orders", payload);
        setOrders((current) => [res.data.order, ...current]);
        return res.data.order;
      } catch (error) {
        console.error("Create order failed", error);
        throw error;
      }
    },
    []
  );

  const updateOrder = useCallback(
    async (orderId, payload) => {
      try {
        const res = await api.patch(`/orders/${orderId}`, payload);
        setOrders((current) => current.map((order) => (order.id === orderId ? res.data.order : order)));
        return res.data.order;
      } catch (error) {
        console.error("Update order failed", error);
        throw error;
      }
    },
    []
  );

  useEffect(() => {
    if (!user) return;
    fetchOrders();
  }, [user, fetchOrders]);

  return (
    <OrdersContext.Provider value={{ orders, loading, fetchOrders, createOrder, updateOrder }}>
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  return useContext(OrdersContext);
}
