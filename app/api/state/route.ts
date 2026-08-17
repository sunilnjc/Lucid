import { eq } from "drizzle-orm";
import { getDb, initializeDatabase } from "@/db";
import { learnerState, type AppStatePayload } from "@/db/schema";

function isAppStatePayload(value: unknown): value is AppStatePayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  const stringArrays = ["completedDays", "difficultIds", "favouriteIds", "reviewedIds"]
    .filter((key) => key !== "completedDays")
    .every((key) => Array.isArray(state[key]) && (state[key] as unknown[]).every((item) => typeof item === "string"));
  const settings = state.settings;
  return (
    typeof state.version === "number" &&
    ["not_started", "in_progress", "completed"].includes(String(state.lessonStatus)) &&
    typeof state.lessonWordProgress === "number" &&
    Array.isArray(state.completedDays) &&
    (state.completedDays as unknown[]).every((item) => typeof item === "number") &&
    stringArrays &&
    typeof state.masteryScores === "object" && state.masteryScores !== null &&
    Array.isArray(state.quizAttempts) &&
    typeof settings === "object" && settings !== null &&
    typeof (settings as Record<string, unknown>).lessonTime === "string" &&
    typeof (settings as Record<string, unknown>).timeZone === "string"
  );
}

function learnerKey(request: Request) {
  const authenticated = request.headers.get("oai-authenticated-user-id");
  if (authenticated) return `user:${authenticated}`;
  const device = request.headers.get("x-lucid-device-id") ?? "";
  return /^[a-zA-Z0-9-]{8,80}$/.test(device) ? `device:${device}` : null;
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export async function GET(request: Request) {
  const userKey = learnerKey(request);
  if (!userKey) return json({ error: "A signed-in user or device identifier is required." }, 401);
  try {
    await initializeDatabase();
    const db = getDb();
    const row = await db.query.learnerState.findFirst({
      columns: { state: true },
      where: eq(learnerState.userKey, userKey),
    });

    return json({ state: row?.state ?? null });
  } catch (error) {
    console.error("Unable to load app state", error);
    return json({ error: "Unable to load app state." }, 500);
  }
}

export async function PUT(request: Request) {
  const userKey = learnerKey(request);
  if (!userKey) return json({ error: "A signed-in user or device identifier is required." }, 401);
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !Object.prototype.hasOwnProperty.call(body, "state") ||
    !isAppStatePayload((body as { state?: unknown }).state)
  ) {
    return json({ error: "Request body must include a state object." }, 400);
  }

  const state = (body as { state: AppStatePayload }).state;

  try {
    await initializeDatabase();
    const db = getDb();
    const now = new Date();

    await db
      .insert(learnerState)
      .values({ userKey, state, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: learnerState.userKey,
        set: { state, updatedAt: now },
      });

    return json({ state });
  } catch (error) {
    console.error("Unable to save app state", error);
    return json({ error: "Unable to save app state." }, 500);
  }
}
