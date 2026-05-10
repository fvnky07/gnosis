export const PACKAGE = "@gnosis/editor";

export { BlockSnippet } from "./block-snippet";
export { createEditor } from "./create-editor";
export { buildBaseExtensions, gnosisOrgExtras } from "./extensions";
export { findOrgTokens, ORG_TOKEN_CLASS } from "./highlight";
export type { VimMode } from "./mode-observer";
export { buildOrgMotions } from "./motions";
export type { BufferProps, OrgToken, OrgTokenKind } from "./types";
export type { VimHostBindings } from "./vim";
export { buildVimExtensions } from "./vim";
