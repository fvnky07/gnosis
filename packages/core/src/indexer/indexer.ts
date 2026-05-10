import type { BlockStore, NewBlock } from "@gnosis/db";
import type { Block as ParsedBlock } from "../parser";
import { mintIds, parse } from "../parser";
import type { Vault } from "../vault";
import { type IndexerLogger, type IndexResult, SILENT_LOGGER } from "./types";

/**
 * The indexer wires the parser ({@link parse}, {@link mintIds}) to a
 * {@link BlockStore} via a {@link Vault} adapter. It supports three modes
 * per `planning/04-vault-and-indexer.md`:
 *
 * - `cold()` — walk the entire vault and index every `.org` file.
 * - `incremental(path)` — re-index a single file (the editor's debounced
 *   write trigger).
 * - `remove(path)` — drop a deleted file's blocks from the index.
 *
 * ID minting is a side effect: any heading without an `:ID:` property is
 * stamped via {@link mintIds} and the file is rewritten before parsing.
 * The first cold index of an existing vault rewrites many files; the
 * caller is expected to surface the count via the post-index toast (see
 * the planning doc for the first-run warning UX).
 */
export class Indexer {
	constructor(
		private readonly vault: Vault,
		private readonly store: BlockStore,
		private readonly logger: IndexerLogger = SILENT_LOGGER,
	) {}

	async cold(): Promise<IndexResult> {
		const files = await this.vault.list();
		this.logger.info(
			`indexer: cold index starting (${files.length} file${files.length === 1 ? "" : "s"})`,
		);
		const result = emptyResult();
		for (const file of files) {
			const partial = await this.indexFile(file.path);
			mergeInto(result, partial);
		}
		this.logger.info(
			`indexer: cold index done — files=${result.filesParsed} upserted=${result.blocksUpserted} deleted=${result.blocksDeleted} idsMinted=${result.idsMinted}`,
		);
		return result;
	}

	async incremental(path: string): Promise<IndexResult> {
		return this.indexFile(path);
	}

	async remove(path: string): Promise<void> {
		await this.store.deleteBlocksByFile(path);
		this.logger.info(`indexer: removed blocks for ${path}`);
	}

	private async indexFile(path: string): Promise<IndexResult> {
		const result = emptyResult();

		const original = await this.vault.read(path);
		const minted = mintIds(original);
		let textForParse = original;
		if (minted.mintedCount > 0) {
			await this.vault.write(path, minted.newText);
			textForParse = minted.newText;
			result.idsMinted = minted.mintedCount;
			this.logger.info(
				`indexer: minted ${minted.mintedCount} ID(s) in ${path}`,
			);
		}

		const parsed = parse(textForParse, path);
		result.filesParsed = 1;
		for (const w of parsed.warnings) result.warnings.push(w);

		const previousIds = await this.store.listBlockIdsByFile(path);
		const newIdSet = new Set<string>(parsed.document.blocks.map((b) => b.id));
		let deleted = 0;
		for (const id of previousIds) {
			if (!newIdSet.has(id)) deleted++;
		}

		const rows: NewBlock[] = parsed.document.blocks.map((block, idx) =>
			toDbRow(block, path, parsed.document.raw, parsed.document.blocks, idx),
		);
		await this.store.upsertFileBlocks(path, rows);

		result.blocksUpserted = rows.length;
		result.blocksDeleted = deleted;
		return result;
	}
}

function emptyResult(): IndexResult {
	return {
		filesParsed: 0,
		blocksUpserted: 0,
		blocksDeleted: 0,
		idsMinted: 0,
		warnings: [],
	};
}

function mergeInto(target: IndexResult, source: IndexResult): void {
	target.filesParsed += source.filesParsed;
	target.blocksUpserted += source.blocksUpserted;
	target.blocksDeleted += source.blocksDeleted;
	target.idsMinted += source.idsMinted;
	for (const w of source.warnings) target.warnings.push(w);
}

function toDbRow(
	block: ParsedBlock,
	filePath: string,
	rawDoc: string,
	allBlocks: ParsedBlock[],
	idx: number,
): NewBlock {
	return {
		id: block.id,
		filePath,
		parentId: findParentId(allBlocks, idx),
		level: block.level,
		headlineRaw: getHeadlineRaw(rawDoc, block),
		todoState: block.todo ?? null,
		priority: block.priority ?? null,
		scheduled: block.scheduled?.raw ?? null,
		deadline: block.deadline?.raw ?? null,
		closed: null,
		body: block.body,
		startByte: block.rangeInFile.start,
		endByte: block.rangeInFile.end,
	};
}

function findParentId(blocks: ParsedBlock[], idx: number): string | null {
	const me = blocks[idx];
	if (!me) return null;
	const myLevel = me.level;
	for (let i = idx - 1; i >= 0; i--) {
		const candidate = blocks[i];
		if (!candidate) continue;
		if (candidate.level < myLevel) return candidate.id;
	}
	return null;
}

function getHeadlineRaw(rawDoc: string, block: ParsedBlock): string {
	const newlineIdx = rawDoc.indexOf("\n", block.rangeInFile.start);
	const end = newlineIdx === -1 ? rawDoc.length : newlineIdx;
	return rawDoc.slice(block.rangeInFile.start, end);
}
