/**
 * Thin wrapper around `tauri-plugin-log`.
 *
 * The Rust side initializes the plugin in `src-tauri/src/lib.rs`; calling any
 * of these helpers writes to `$APP_DATA/logs/gnosis.log`. The browser console
 * is hooked separately by `attachConsole`, called from `main.tsx` so we get
 * dev-tools visibility too.
 */

export {
	attachConsole,
	debug,
	error,
	info,
	trace,
	warn,
} from "@tauri-apps/plugin-log";
