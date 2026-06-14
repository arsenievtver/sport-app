import { useState } from "react";

import { AthletesTab } from "./AthletesTab";
import { CoachesTab } from "./CoachesTab";

type UsersTab = "coaches" | "athletes";

export function UsersPage() {
  const [tab, setTab] = useState<UsersTab>("coaches");

  return (
    <>
      <div className="admin-tabs">
        <button
          type="button"
          className={`admin-tab${tab === "coaches" ? " admin-tab--active" : ""}`}
          onClick={() => setTab("coaches")}
        >
          Тренеры
        </button>
        <button
          type="button"
          className={`admin-tab${tab === "athletes" ? " admin-tab--active" : ""}`}
          onClick={() => setTab("athletes")}
        >
          Атлеты
        </button>
      </div>
      {tab === "coaches" ? <CoachesTab /> : <AthletesTab />}
    </>
  );
}
