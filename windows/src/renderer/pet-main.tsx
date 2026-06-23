import { createRoot } from "react-dom/client";
import "./styles.css";

function BootstrapPet() {
  return <div className="pet-bootstrap" aria-label="CatDesktopPet pet window" />;
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing root element.");
}

createRoot(root).render(<BootstrapPet />);
