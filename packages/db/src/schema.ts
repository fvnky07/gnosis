import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const schemaVersion = sqliteTable("schema_version", {
	id: integer("id").primaryKey(),
	version: integer("version").notNull(),
	appliedAt: text("applied_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const appState = sqliteTable("app_state", {
	key: text("key").primaryKey(),
	value: text("value").notNull(),
	updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const blocks = sqliteTable("blocks", {
	id: text("id").primaryKey(), // ULID
	filePath: text("file_path").notNull(),
	parentId: text("parent_id"),
	level: integer("level").notNull(),
	headlineRaw: text("headline_raw").notNull(),
	todoState: text("todo_state"),
	priority: text("priority"),
	scheduled: text("scheduled"),
	deadline: text("deadline"),
	closed: text("closed"),
	body: text("body").notNull().default(""),
	startByte: integer("start_byte").notNull(),
	endByte: integer("end_byte").notNull(),
	updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type SchemaVersion = typeof schemaVersion.$inferSelect;
export type AppState = typeof appState.$inferSelect;
export type Block = typeof blocks.$inferSelect;
export type NewBlock = typeof blocks.$inferInsert;
