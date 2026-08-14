import React, { createContext, useContext, useState } from "react";

const AlarmContext = createContext(null);

export function AlarmProvider({ children }) {
  const [alarm, setAlarm] = useState(null); // { taskTitle, assignee, kind }

  // kind: "review" (default, task_alert) | "not_started" | "not_streaming"
  const triggerAlarm = (taskTitle, assignee, kind = "review") => setAlarm({ taskTitle, assignee, kind });
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
