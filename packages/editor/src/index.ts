export const PACKAGE = "@gnosis/editor";

export { BlockSnippet } from "./block-snippet";
export { createEditor } from "./create-editor";
export { buildBaseExtensions, gnosisOrgExtras } from "./extensions";
export {
	findOrgProseTokens,
	findOrgTokens,
	ORG_PROSE_BODY_CLASS,
	ORG_TOKEN_CLASS,
} from "./highlight";
export {
	livePreviewExtension,
	livePreviewPlugin,
	orgLivePreviewPlugin,
} from "./live-preview";
export type { VimMode } from "./mode-observer";
export { buildOrgMotions } from "./motions";
export type { SelectionInfo } from "./selection-observer";
export { selectionWatcher } from "./selection-observer";
export type {
	BufferProps,
	CursorStyleOption,
	EditorOptions,
	LineNumbersMode,
	OrgProseToken,
	OrgProseTokenKind,
	OrgToken,
	OrgTokenKind,
	WhitespaceRenderMode,
} from "./types";
export { DEFAULT_EDITOR_OPTIONS } from "./types";
export type { VimHostBindings, VimOptions } from "./vim";
export { buildVimExtensions, DEFAULT_VIM_OPTIONS } from "./vim";
