import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	base: "./",
	build: { outDir: "dist", emptyOutDir: true, target: "esnext" },
	server: {
		port: 5173,
		strictPort: true,
		host: "127.0.0.1",
		hmr: { protocol: "ws", host: "127.0.0.1", port: 5174 },
	},
	resolve: {
		alias: {
			"@gnosis/ui": path.resolve(__dirname, "../../packages/ui/src"),
			"@gnosis/core": path.resolve(__dirname, "../../packages/core/src"),
			"@gnosis/editor": path.resolve(__dirname, "../../packages/editor/src"),
			"@gnosis/palette": path.resolve(__dirname, "../../packages/palette/src"),
			"@gnosis/views": path.resolve(__dirname, "../../packages/views/src"),
			"@gnosis/vim-runtime": path.resolve(
				__dirname,
				"../../packages/vim-runtime/src",
			),
			"@gnosis/db/migrations": path.resolve(
				__dirname,
				"../../packages/db/src/migrations.ts",
			),
			"@gnosis/db": path.resolve(__dirname, "../../packages/db/src"),
		},
	},
	clearScreen: false,
	envPrefix: ["VITE_", "TAURI_"],
});
