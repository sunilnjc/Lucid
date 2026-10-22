// This entry is a public client-only shell: no server-rendered account content or credentials.
import { createRoot } from "react-dom/client";
import VocabularyApp from "./VocabularyApp";
import "./globals.css";
import "./pwa.css";

const root = document.getElementById("lucid-offline-root");
if (!root) throw new Error("Lucid’s public app shell is missing.");
const initialDate = new Date().toISOString().slice(0, 10);
createRoot(root).render(<VocabularyApp initialDate={initialDate} initialGreeting="Welcome back." />);
