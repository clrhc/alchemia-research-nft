import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installBrowserCompatPolyfills } from "./engine/browserCompat";
import App from "./App";
import "./styles/global.css";

installBrowserCompatPolyfills();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
