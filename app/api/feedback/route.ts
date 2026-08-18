import { betaFeedback } from "@/db/schema";
import { getDb, initializeDatabase } from "@/db";

type FeedbackBody = {
  roleId: string;
  rating: number;
  helpful: string;
  confusing?: string;
  missing?: string;
};

function learnerKey(request: Request) {
  const authenticated = request.headers.get("oai-authenticated-user-id");
  if (authenticated) return `user:${authenticated}`;
  const device = request.headers.get("x-lucid-device-id") ?? "";
  return /^[a-zA-Z0-9-]{8,80}$/.test(device) ? `device:${device}` : null;
}

function cleanText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function parseFeedback(value: unknown): FeedbackBody | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const roleId = cleanText(body.roleId, 80);
  const helpful = cleanText(body.helpful, 1200);
  const rating = Number(body.rating);
  if (!roleId || !helpful || !Number.isInteger(rating) || rating < 1 || rating > 5) return null;
  return {
    roleId,
    helpful,
    rating,
    confusing: cleanText(body.confusing, 1200),
    missing: cleanText(body.missing, 1200),
  };
}

export async function POST(request: Request) {
  const userKey = learnerKey(request);
  if (!userKey) return Response.json({ error: "A learner identifier is required." }, { status: 401 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Feedback must be valid JSON." }, { status: 400 });
  }
  const feedback = parseFeedback(raw);
  if (!feedback) {
    return Response.json({ error: "Choose a rating and describe what helped." }, { status: 400 });
  }

  try {
    await initializeDatabase();
    await getDb().insert(betaFeedback).values({
      id: crypto.randomUUID(),
      userKey,
      roleId: feedback.roleId,
      rating: feedback.rating,
      helpful: feedback.helpful,
      confusing: feedback.confusing ?? "",
      missing: feedback.missing ?? "",
      createdAt: new Date(),
    });
    return Response.json({ saved: true }, { status: 201 });
  } catch (error) {
    console.error("Unable to save beta feedback", error);
    return Response.json({ error: "Unable to save feedback right now." }, { status: 500 });
  }
}
