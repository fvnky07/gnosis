import type { Extension } from "@codemirror/state";
import { vim } from "@replit/codemirror-vim";

/**
 * Vim mode is core to gnosis — on by default, statically imported. Disabling
 * it is supported via `vimEnabled: false` in {@link createEditor}, but the
 * product is designed around vim being on (see `planning/15-vim-mode.md`).
 *
 * The full ex-command bridge, org-aware text objects/motions, and the global
 * list-mode handler land in subsequent slices. This module currently exposes
 * just the base cm-vim integration.
 */
export function buildVimExtensions(): Extension[] {
	return [vim()];
}
