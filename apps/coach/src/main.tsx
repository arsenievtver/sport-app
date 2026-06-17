import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initTheme, initViewport } from "@sport-app/ui";
import App from "./App";
import "@sport-app/ui/styles.css";

initTheme();

const root = createRoot(document.getElementById("root")!);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);

initViewport();
