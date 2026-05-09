import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
	blocks,
	CURRENT_SCHEMA_VERSION,
	createInMemoryDb,
	schemaVersion,
} from "../src/index";

describe("packages/db schema", () => {
	it("applies schema_version row on init", () => {
		const db = createInMemoryDb();
		const rows = db.select().from(schemaVersion).all();
		expect(rows).toHaveLength(1);
		expect(rows[0]?.version).toBe(CURRENT_SCHEMA_VERSION);
	});

	it("inserts and reads a blocks row", () => {
		const db = createInMemoryDb();
		db.insert(blocks)
			.values({
				id: "01HXYZTESTULID0000000000",
				filePath: "daily/2025-01-01.org",
				parentId: null,
				level: 1,
				headlineRaw: "* TODO buy milk",
				todoState: "TODO",
				priority: null,
				scheduled: null,
				deadline: null,
				closed: null,
				body: "",
				startByte: 0,
				endByte: 16,
			})
			.run();

		const rows = db
			.select()
			.from(blocks)
			.where(eq(blocks.id, "01HXYZTESTULID0000000000"))
			.all();

		expect(rows).toHaveLength(1);
		expect(rows[0]?.todoState).toBe("TODO");
		expect(rows[0]?.headlineRaw).toBe("* TODO buy milk");
	});
});
