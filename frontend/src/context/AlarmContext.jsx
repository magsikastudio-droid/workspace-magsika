import React, { createContext, useContext, useState } from "react";

const AlarmContext = createContext(null);

export function AlarmProvider({ children }) {
  const [alarm, setAlarm] = useState(null); // { taskTitle, assignee }

  const triggerAlarm = (taskTitle, assignee) => setAlarm({ taskTitle, assignee });
  const dismissAlarm = () => setAlarm(null);

  return (
    <AlarmContext.Provider value={{ alarm, triggerAlarm, dismissAlarm }}>
      {children}
    </AlarmContext.Provider>
  );
}

export function useAlarm() {
  return useContext(AlarmContext);
}
