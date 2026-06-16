import { createRoot } from "react-dom/client";
import App from "./app";
import "./main.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element #root was not found.");
}

createRoot(root).render(<App />);
