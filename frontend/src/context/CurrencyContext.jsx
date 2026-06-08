import React, { createContext, useContext, useMemo, useState } from "react";

const CurrencyContext = createContext(null);

export function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState("IDR");

  const formatMoney = useMemo(() => {
    return (value) => {
      const formatter = new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
      });
      return formatter.format(value);
    };
  }, [currency]);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatMoney }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
