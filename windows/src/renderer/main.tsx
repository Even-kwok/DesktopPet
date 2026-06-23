import { createRoot } from "react-dom/client";
import "./styles.css";

function BootstrapStudio() {
  return (
    <main className="studio-shell">
      <h1>CatDesktopPet Windows</h1>
      <p>Windows desktop client is starting.</p>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing root element.");
}

createRoot(root).render(<BootstrapStudio />);
