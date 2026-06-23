import { createRoot } from "react-dom/client";
import "./styles.css";
import { PetWindow } from "./pet/PetWindow.tsx";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing root element.");
}

createRoot(root).render(<PetWindow />);
