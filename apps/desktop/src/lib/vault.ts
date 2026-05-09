/**
 * Vault folder bootstrap.
 *
 * On first launch the desktop has no vault path stored. `ensureVaultPath()`
 * reads `app_state.vault_path`; if absent, it opens the native folder picker
 * via `tauri-plugin-dialog` and persists the chosen path. The plumbing for
 * scoping the FS plugin to that path lives in Phase 2 (out of this slice).
 */

import { open } from "@tauri-apps/plugin-dialog";
import { openDb } from "./db";

const VAULT_KEY = "vault_path";

export async function getStoredVaultPath(): Promise<string | null> {
	const db = await openDb();
	const rows = await db.select<{ value: string }[]>(
		"SELECT value FROM app_state WHERE key = $1",
		[VAULT_KEY],
	);
	return rows[0]?.value ?? null;
}

export async function setVaultPath(path: string): Promise<void> {
	const db = await openDb();
	await db.execute(
		`INSERT INTO app_state (key, value, updated_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
		[VAULT_KEY, path],
	);
}

export async function pickVaultFolder(): Promise<string | null> {
	const result = await open({
		multiple: false,
		directory: true,
		title: "Pick a folder for your gnosis vault",
	});
	if (typeof result === "string") return result;
	return null;
}

/**
 * Ensure a vault path is configured. If one is already stored, return it.
 * Otherwise prompt the user, persist, and return the chosen path. Returns
 * `null` if the user dismissed the picker.
 */
export async function ensureVaultPath(): Promise<string | null> {
	const stored = await getStoredVaultPath();
	if (stored) return stored;
	const picked = await pickVaultFolder();
	if (picked) {
		await setVaultPath(picked);
		return picked;
	}
	return null;
}
