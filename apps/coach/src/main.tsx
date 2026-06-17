import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initTheme, initViewport } from "@sport-app/ui";
import App from "./App";
import "@sport-app/ui/styles.css";

initTheme();
initViewport();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
