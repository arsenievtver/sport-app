import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initTheme, initViewportHeight } from "@sport-app/ui";
import App from "./App";
import "@sport-app/ui/styles.css";

initTheme();
initViewportHeight();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
