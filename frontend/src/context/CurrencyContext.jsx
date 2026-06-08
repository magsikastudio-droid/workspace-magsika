import React, { createContext, useContext, useMemo, useState } from "react";

const CurrencyContext = createContext(null);

export function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState("IDR");
  const [exchangeRate, setExchangeRate] = useState(16000);

  const formatMoney = useMemo(() => {
    return (value) => {
      const amount = currency === "IDR" ? (value || 0) * exchangeRate : (value || 0);
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
      }).format(amount);
    };
  }, [currency, exchangeRate]);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, exchangeRate, setExchangeRate, formatMoney }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
