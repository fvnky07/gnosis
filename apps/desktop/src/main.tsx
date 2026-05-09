import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { attachConsole } from "./lib/log";
import "./styles.css";

attachConsole().catch(() => {
	// Ignore: in non-Tauri contexts (e.g. vite preview) the plugin is absent.
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
