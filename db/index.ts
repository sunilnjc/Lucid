import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

const CREATE_LEARNER_STATE_TABLE = `
  CREATE TABLE IF NOT EXISTS learner_state (
    user_key TEXT PRIMARY KEY NOT NULL,
    state TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch() * 1000) NOT NULL,
    updated_at INTEGER DEFAULT (unixepoch() * 1000) NOT NULL
  )
`;

let initialization: Promise<void> | undefined;

function getD1Binding() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return env.DB;
}

export async function initializeDatabase() {
  const binding = getD1Binding();

  if (!initialization) {
    initialization = binding
      .prepare(CREATE_LEARNER_STATE_TABLE)
      .run()
      .then(() => undefined)
      .catch((error: unknown) => {
        initialization = undefined;
        throw error;
      });
  }

  await initialization;
}

export function getDb() {
  return drizzle(getD1Binding(), { schema });
}
