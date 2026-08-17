import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export type AppStatePayload = Record<string, unknown>;

export const learnerState = sqliteTable(
  "learner_state",
  {
    userKey: text("user_key").primaryKey(),
    state: text("state", { mode: "json" })
      .$type<AppStatePayload>()
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
);
