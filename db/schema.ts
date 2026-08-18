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

export const betaFeedback = sqliteTable("beta_feedback", {
  id: text("id").primaryKey(),
  userKey: text("user_key").notNull(),
  roleId: text("role_id").notNull(),
  rating: integer("rating").notNull(),
  helpful: text("helpful").notNull(),
  confusing: text("confusing").notNull().default(""),
  missing: text("missing").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});
