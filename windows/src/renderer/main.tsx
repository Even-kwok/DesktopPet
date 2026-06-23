import { createRoot } from "react-dom/client";
import "./styles.css";
import { StudioApp } from "./studio/StudioApp.tsx";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing root element.");
}

createRoot(root).render(<StudioApp />);
