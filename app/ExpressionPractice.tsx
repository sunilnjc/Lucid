"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SharedRehearsal, SharedChallenge } from "../lib/shared-learning-state";
import { professionalWords, type RoleId } from "../lib/professional-content";
import {
  expressionContent, getExpressionPracticeContent, findExpressionMatches, getExpressionsForRole, getScenariosForRole,
  getLearnedExpressionScenarios, getPracticeExpression, checkExpressionResponse, buildExpressionEvidence,
  getFifthDayChallenge, buildComebackPlan, getTenWordDiscovery, expressionNextDay,
  expressionEvidenceSenseId, expressionIndependentAllowed, createExpressionCommitGate, commitExpressionTransaction, buildNuanceChoice, expressionNuanceKey,
  type ExpressionEvidence, type ExpressionGoal, type ExpressionScenario, type ExpressionTheme, type NuanceAnswer, type NuanceChoice,
} from "../lib/expression-content";

export type ExpressionPracticeProps = {
  roleId: RoleId; learnedWordIds: readonly string[]; lastActiveDate?: string;
  activeDates?: readonly string[]; today?: string; savedDraft: string;
  exposedOn?: Readonly<Record<string, string>>;
  onCommit: (draft: string, evidence?: ExpressionEvidence, exposedContextIds?: readonly string[], exposedAtISO?: string) => boolean;
};
type NotebookEntry = { id: string; expressionId: string; variant: "plain" | "precise" | "diplomatic"; phrase: string; intent: string; createdOn: string; createdAt?: string; nextReviewOn?: string; lastPractisedAt?: string };
export type ExpressionWorkspaceState = {
  version: 1; roleId: RoleId; intent: string; goalId: ExpressionGoal;
  screen: "find" | "practice" | "discover"; matchesVisible: boolean;
  scenarioId: string; response: string; submittedResponse: string;
  responses: Record<string, string>; phase: "draft" | "comparison" | "saved";
  hintExposed: boolean; attemptIndependent: boolean; hintedOn: Record<string, string>;
  attemptId: string; attemptDate: string; notebook: NotebookEntry[]; practiceDates: string[]; practiceWordIds: string[]; nuanceAnswers: Record<string, NuanceAnswer>;
  fresh: boolean; pendingCheckpoints: Array<{ scenarioId: string; dueOn: string; completedOn?: string; gapId?: string }>;
  rehearsalHistory: SharedRehearsal[]; challengeHistory: SharedChallenge[];
  activeRehearsalId?: string; activeChallengeId?: string; originalCapturedAtISO?: string;
  completedChallengeCounts: number[]; challengeCount?: number; challengeScenarioIds: string[];
  challengeCompletedIds: string[]; completedComebackOn?: string; comebackAttempt?: boolean;
};
type Workspace = ExpressionWorkspaceState;
function workspaceDrafts(savedDraft: string): Record<string, unknown> {
  try {
    const saved = JSON.parse(savedDraft) as { version?: number; roleId?: string; workspaces?: unknown };
    if (saved.version === 2 && saved.workspaces && typeof saved.workspaces === "object" && !Array.isArray(saved.workspaces)) return saved.workspaces as Record<string, unknown>;
    return saved.version === 1 && typeof saved.roleId === "string" ? { [saved.roleId]: saved } : {};
  } catch { return {}; }
}
const studioContent = getExpressionPracticeContent(professionalWords);
const studioScenarios = new Map(studioContent.scenarios.map((scenario) => [scenario.id, scenario]));
const studioUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const studioInstant = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value.slice(0, 10) && Date.parse(value) >= 0 && Date.parse(value) <= Date.now() + 300_000;
const studioRow = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
function knownStudioScenario(id: unknown, roleId: RoleId): ExpressionScenario | undefined { return typeof id === "string" && studioScenarios.get(id)?.roleIds.includes(roleId) ? studioScenarios.get(id) : undefined; }
function safeRehearsals(value: unknown, roleId: RoleId): SharedRehearsal[] {
  const history = new Map<string, SharedRehearsal>();
  for (const item of Array.isArray(value) ? value : []) {
    if (!studioRow(item) || !studioUuid(item.id) || item.roleId !== roleId || !["initial", "delayed"].includes(String(item.mode)) || typeof item.modelSeen !== "boolean" || !studioInstant(item.startedAt)) continue;
    const scenario = knownStudioScenario(item.scenarioId, roleId);
    if (!scenario || scenario.expressionId !== item.expressionId || item.gapId !== undefined && !studioUuid(item.gapId) || item.completedAt !== undefined && (!studioInstant(item.completedAt) || Date.parse(item.completedAt) < Date.parse(item.startedAt))) continue;
    const record: SharedRehearsal = { id: item.id.toLowerCase(), roleId, scenarioId: scenario.id, expressionId: scenario.expressionId, mode: item.mode as SharedRehearsal["mode"], startedAt: item.startedAt, modelSeen: item.modelSeen, ...(studioUuid(item.gapId) ? { gapId: item.gapId.toLowerCase() } : {}), ...(studioInstant(item.completedAt) ? { completedAt: item.completedAt } : {}) };
    const existing = history.get(record.id);
    if (!existing) history.set(record.id, record);
    else if (existing.scenarioId === record.scenarioId && existing.expressionId === record.expressionId && existing.mode === record.mode && (!existing.gapId || !record.gapId || existing.gapId === record.gapId)) history.set(record.id, { ...existing, gapId: existing.gapId ?? record.gapId, modelSeen: existing.modelSeen || record.modelSeen, startedAt: [existing.startedAt, record.startedAt].sort()[0], completedAt: [existing.completedAt, record.completedAt].filter((date): date is string => Boolean(date)).sort()[0] });
  }
  return [...history.values()].slice(-2000);
}
function safeChallenges(value: unknown, roleId: RoleId): SharedChallenge[] {
  const history = new Map<string, SharedChallenge>();
  for (const item of Array.isArray(value) ? value : []) {
    if (!studioRow(item) || typeof item.id !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,199}$/.test(item.id) || item.roleId !== roleId || !["transfer", "comeback"].includes(String(item.mode)) || !Number.isInteger(item.milestone) || Number(item.milestone) < 0 || !studioInstant(item.startedAt)) continue;
    if (!Array.isArray(item.scenarioIds) || item.scenarioIds.length === 0 || item.scenarioIds.length > 3 || !item.scenarioIds.every((id) => Boolean(knownStudioScenario(id, roleId))) || new Set(item.scenarioIds).size !== item.scenarioIds.length || !Array.isArray(item.completedScenarioIds) || !item.completedScenarioIds.every((id) => item.scenarioIds instanceof Array && item.scenarioIds.includes(id)) || new Set(item.completedScenarioIds).size !== item.completedScenarioIds.length) continue;
    if (item.completedAt !== undefined && (!studioInstant(item.completedAt) || Date.parse(item.completedAt) < Date.parse(item.startedAt) || item.completedScenarioIds.length !== item.scenarioIds.length)) continue;
    const record: SharedChallenge = { id: item.id, roleId, mode: item.mode as SharedChallenge["mode"], milestone: Number(item.milestone), startedAt: item.startedAt, scenarioIds: item.scenarioIds as string[], completedScenarioIds: item.completedScenarioIds as string[], ...(studioInstant(item.completedAt) ? { completedAt: item.completedAt } : {}) };
    const existing = history.get(record.id);
    if (!existing) history.set(record.id, record);
    else if (existing.mode === record.mode && existing.milestone === record.milestone && JSON.stringify(existing.scenarioIds) === JSON.stringify(record.scenarioIds)) {
      const completedScenarioIds = [...new Set([...existing.completedScenarioIds, ...record.completedScenarioIds])];
      const completedAt = [existing.completedAt, record.completedAt].filter((date): date is string => Boolean(date)).sort()[0];
      history.set(record.id, { ...existing, startedAt: [existing.startedAt, record.startedAt].sort()[0], completedScenarioIds, ...(completedAt && completedScenarioIds.length === record.scenarioIds.length ? { completedAt } : {}) });
    }
  }
  return [...history.values()].slice(-2000);
}
function safeNotebook(value: unknown, roleId: RoleId): NotebookEntry[] {
  return (Array.isArray(value) ? value : []).flatMap((item) => {
    if (!studioRow(item) || typeof item.id !== "string" || typeof item.expressionId !== "string" || !["plain", "precise", "diplomatic"].includes(String(item.variant)) || typeof item.phrase !== "string" || typeof item.createdOn !== "string") return [];
    const expression = getPracticeExpression(item.expressionId, professionalWords), variant = item.variant as NotebookEntry["variant"];
    if (!expression?.roleIds.includes(roleId) || item.phrase !== expression[variant]) return [];
    try { expressionNextDay(item.createdOn); } catch { return []; }
    let nextReviewOn: string | undefined;
    try { if (typeof item.nextReviewOn === "string") { expressionNextDay(item.nextReviewOn); nextReviewOn = item.nextReviewOn; } } catch { /* Older drafts can omit their planned date. */ }
    return [{ id: item.id, expressionId: item.expressionId, variant, phrase: item.phrase, intent: typeof item.intent === "string" ? item.intent : "", createdOn: item.createdOn, ...(studioInstant(item.createdAt) ? { createdAt: item.createdAt } : {}), ...(nextReviewOn ? { nextReviewOn } : {}), ...(studioInstant(item.lastPractisedAt) ? { lastPractisedAt: item.lastPractisedAt } : {}) }];
  }).slice(-500);
}
export function parseExpressionWorkspace(roleId: RoleId, savedDraft: string): Workspace {
  const empty: Workspace = { version: 1, roleId, intent: "", goalId: "clarify", screen: "find", matchesVisible: false, scenarioId: "", response: "", submittedResponse: "", responses: {}, phase: "draft", hintExposed: false, attemptIndependent: false, hintedOn: {}, attemptId: "", attemptDate: "", notebook: [], practiceDates: [], practiceWordIds: [], nuanceAnswers: {}, fresh: false, rehearsalHistory: [], challengeHistory: [], pendingCheckpoints: [], completedChallengeCounts: [], challengeScenarioIds: [], challengeCompletedIds: [] };
  if (!savedDraft) return empty;
  try {
    const decoded = JSON.parse(savedDraft) as { version?: number };
    const saved = (decoded.version === 2 ? workspaceDrafts(savedDraft)[roleId] ?? {} : decoded) as Partial<Workspace>;
    if (saved.version !== 1 || saved.roleId !== roleId) return empty;
    const record = (value: unknown): Record<string, string> => value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item === "string")) : {};
    const ids = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    const nuanceAnswers: Record<string, NuanceAnswer> = {};
    if (saved.nuanceAnswers && typeof saved.nuanceAnswers === "object" && !Array.isArray(saved.nuanceAnswers)) {
      for (const [key, answer] of Object.entries(saved.nuanceAnswers)) {
        if (!answer || !["fitting", "awkward"].includes(answer.choice)) continue;
        const recognizedOn = typeof answer.recognizedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(answer.recognizedOn) ? answer.recognizedOn : undefined;
        nuanceAnswers[key] = { choice: answer.choice, recognizedOn, attemptId: typeof answer.attemptId === "string" ? answer.attemptId : undefined };
      }
    }
    const workspace: Workspace = {
      ...empty, nuanceAnswers, intent: typeof saved.intent === "string" ? saved.intent : "",
      goalId: expressionContent.goals.some((goal) => goal.id === saved.goalId) ? saved.goalId! : empty.goalId,
      screen: ["find", "practice", "discover"].includes(saved.screen ?? "") ? saved.screen! : "find",
      matchesVisible: saved.matchesVisible === true, scenarioId: typeof saved.scenarioId === "string" ? saved.scenarioId : "",
      response: typeof saved.response === "string" ? saved.response : "", submittedResponse: typeof saved.submittedResponse === "string" ? saved.submittedResponse : "",
      responses: record(saved.responses), phase: ["draft", "comparison", "saved"].includes(saved.phase ?? "") ? saved.phase! : "draft",
      hintExposed: saved.hintExposed === true, attemptIndependent: saved.attemptIndependent === true && saved.hintExposed !== true,
      hintedOn: record(saved.hintedOn), attemptId: typeof saved.attemptId === "string" ? saved.attemptId : "",
      attemptDate: typeof saved.attemptDate === "string" ? saved.attemptDate : "", practiceDates: ids(saved.practiceDates).filter((date) => { try { expressionNextDay(date); return true; } catch { return false; } }), practiceWordIds: ids(saved.practiceWordIds), fresh: saved.fresh === true,
      notebook: safeNotebook(saved.notebook, roleId), rehearsalHistory: safeRehearsals(saved.rehearsalHistory, roleId), challengeHistory: safeChallenges(saved.challengeHistory, roleId), activeRehearsalId: studioUuid(saved.activeRehearsalId) ? saved.activeRehearsalId.toLowerCase() : undefined, activeChallengeId: typeof saved.activeChallengeId === "string" ? saved.activeChallengeId : undefined, originalCapturedAtISO: studioInstant(saved.originalCapturedAtISO) ? saved.originalCapturedAtISO : undefined,
      pendingCheckpoints: Array.isArray(saved.pendingCheckpoints) ? saved.pendingCheckpoints.filter((item) => item && typeof item.scenarioId === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.dueOn) && (item.completedOn === undefined || typeof item.completedOn === "string")) : [],
      completedChallengeCounts: Array.isArray(saved.completedChallengeCounts) ? saved.completedChallengeCounts.filter((count) => Number.isInteger(count) && count >= 5 && count % 5 === 0) : [],
      challengeCount: Number.isInteger(saved.challengeCount) ? saved.challengeCount : undefined, challengeScenarioIds: ids(saved.challengeScenarioIds), challengeCompletedIds: ids(saved.challengeCompletedIds),
      completedComebackOn: typeof saved.completedComebackOn === "string" ? saved.completedComebackOn : undefined, comebackAttempt: saved.comebackAttempt === true,
    };
    workspace.completedChallengeCounts = [...new Set([...workspace.completedChallengeCounts, ...workspace.challengeHistory.filter((item) => item.mode === "transfer" && item.completedAt).map((item) => item.milestone)])];
    const pending = workspace.challengeHistory.filter((item) => item.mode === "transfer" && !item.completedAt).sort((a, b) => a.milestone - b.milestone)[0];
    if (pending) { workspace.challengeCount = pending.milestone; workspace.challengeScenarioIds = pending.scenarioIds; workspace.challengeCompletedIds = pending.completedScenarioIds; }
    const activeRehearsal = workspace.rehearsalHistory.find((item) => item.id === workspace.activeRehearsalId && item.scenarioId === workspace.scenarioId);
    if (workspace.activeRehearsalId && !activeRehearsal) workspace.activeRehearsalId = undefined;
    if (workspace.rehearsalHistory.some((item) => item.id === workspace.attemptId && item.scenarioId !== workspace.scenarioId)) { workspace.attemptId = ""; workspace.originalCapturedAtISO = undefined; }
    workspace.attemptIndependent = workspace.attemptIndependent && Boolean(workspace.originalCapturedAtISO) && Boolean(activeRehearsal) && Date.parse(workspace.originalCapturedAtISO ?? "") >= Date.parse(activeRehearsal?.startedAt ?? "");
    // Remote history has no private response. It is displayed as history, never an empty comparison or an independent attempt.
    if (workspace.phase !== "draft" && !workspace.submittedResponse && !workspace.activeRehearsalId) { workspace.phase = "draft"; workspace.scenarioId = ""; workspace.attemptIndependent = false; }
    return workspace;
  } catch { return { ...empty, intent: savedDraft }; }
}
function newAttemptId(): string { return globalThis.crypto?.randomUUID?.() ?? "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (letter) => { const random = Math.floor(Math.random() * 16); return (letter === "x" ? random : random & 3 | 8).toString(16); }); }

export function beginExpressionRehearsal(state: Workspace, input: { scenarioId: string; today: string; atISO: string; id: string; fresh?: boolean; hinted?: boolean; gapId?: string; challenge?: { mode: "transfer" | "comeback"; milestone: number; scenarioIds: string[] } }): Workspace {
  const requested = knownStudioScenario(input.scenarioId, state.roleId);
  if (!requested || !studioUuid(input.id) || !studioInstant(input.atISO) || state.rehearsalHistory.some((item) => item.id === input.id.toLowerCase())) return state;
  let challengeHistory = state.challengeHistory, activeChallengeId: string | undefined;
  let scenario = requested, completed: string[] = [];
  if (input.challenge) {
    const spec = input.challenge, existing = challengeHistory.find((item) => item.mode === spec.mode && (spec.mode === "transfer" ? item.milestone === spec.milestone : item.id === `${state.roleId}:comeback:${input.today}`));
    const id = existing?.id ?? (spec.mode === "transfer" ? `${state.roleId}:transfer:${spec.milestone}` : `${state.roleId}:comeback:${input.today}`);
    const record = existing ?? { id, roleId: state.roleId, mode: spec.mode, milestone: spec.milestone, startedAt: input.atISO, scenarioIds: [...spec.scenarioIds], completedScenarioIds: [] };
    if (!safeChallenges([record], state.roleId).length || record.completedAt) return state;
    const chosen = record.scenarioIds.find((id) => !record.completedScenarioIds.includes(id));
    if (!chosen) return state;
    scenario = knownStudioScenario(chosen, state.roleId)!;
    completed = record.completedScenarioIds; activeChallengeId = id;
    challengeHistory = existing ? challengeHistory : [...challengeHistory, record];
  }
  const note = state.notebook.find((item) => item.id === input.gapId && item.expressionId === scenario.expressionId) ?? [...state.notebook].reverse().find((item) => item.expressionId === scenario.expressionId && studioUuid(item.id));
  const history: SharedRehearsal = { id: input.id.toLowerCase(), roleId: state.roleId, scenarioId: scenario.id, expressionId: scenario.expressionId, mode: input.fresh ? "delayed" : "initial", startedAt: input.atISO, modelSeen: input.hinted === true, ...(note && studioUuid(note.id) ? { gapId: note.id.toLowerCase() } : {}) };
  const active = challengeHistory.find((item) => item.id === activeChallengeId);
  return { ...state, screen: "practice", scenarioId: scenario.id, fresh: input.fresh === true, response: "", submittedResponse: "", phase: "draft", hintExposed: input.hinted === true, attemptIndependent: false, attemptId: history.id, activeRehearsalId: history.id, originalCapturedAtISO: undefined, attemptDate: input.today, rehearsalHistory: [...state.rehearsalHistory, history], challengeHistory, activeChallengeId, challengeCount: active?.mode === "transfer" ? active.milestone : undefined, challengeScenarioIds: active?.scenarioIds ?? [], challengeCompletedIds: completed, comebackAttempt: active?.mode === "comeback" };
}
export function captureExpressionRehearsal(state: Workspace, input: { today: string; capturedAtISO: string; help: boolean; independent: boolean; id: string }): Workspace {
  const scenario = knownStudioScenario(state.scenarioId, state.roleId);
  if (!scenario || state.phase !== "draft" || !studioInstant(input.capturedAtISO) || !input.help && !state.response.trim()) return state;
  const existing = state.rehearsalHistory.find((item) => item.id === state.activeRehearsalId);
  const id = existing?.id ?? (studioUuid(state.attemptId) ? state.attemptId.toLowerCase() : input.id);
  if (!studioUuid(id)) return state;
  const record: SharedRehearsal = existing ?? { id, roleId: state.roleId, scenarioId: scenario.id, expressionId: scenario.expressionId, mode: state.fresh ? "delayed" : "initial", startedAt: input.capturedAtISO, modelSeen: state.hintExposed };
  const independent = !input.help && input.independent && !record.modelSeen && !state.hintExposed && state.attemptDate === input.today;
  const rehearsalHistory = [...state.rehearsalHistory.filter((item) => item.id !== id), { ...record, modelSeen: true }];
  return { ...state, submittedResponse: state.response, phase: "comparison", attemptId: id, activeRehearsalId: id, attemptIndependent: independent, hintExposed: !independent, originalCapturedAtISO: input.help ? undefined : input.capturedAtISO, rehearsalHistory };
}
export function finishExpressionRehearsal(state: Workspace, input: { today: string; atISO: string; id: string }): Workspace {
  const scenario = knownStudioScenario(state.scenarioId, state.roleId);
  if (!scenario || state.phase !== "comparison" || !state.submittedResponse.trim() || !studioInstant(input.atISO)) return state;
  const existing = state.rehearsalHistory.find((item) => item.id === state.activeRehearsalId);
  const id = existing?.id ?? (studioUuid(state.attemptId) ? state.attemptId.toLowerCase() : input.id);
  if (!studioUuid(id) || existing?.completedAt) return state;
  const record: SharedRehearsal = existing ?? { id, roleId: state.roleId, scenarioId: scenario.id, expressionId: scenario.expressionId, mode: state.fresh ? "delayed" : "initial", startedAt: input.atISO, modelSeen: true };
  if (Date.parse(input.atISO) < Date.parse(record.startedAt)) return state;
  const rehearsalHistory = [...state.rehearsalHistory.filter((item) => item.id !== id), { ...record, completedAt: input.atISO, modelSeen: true }];
  let challengeHistory = state.challengeHistory;
  const active = challengeHistory.find((item) => item.id === state.activeChallengeId);
  let completed = state.challengeCompletedIds;
  if (active && active.scenarioIds.includes(scenario.id)) {
    completed = [...new Set([...active.completedScenarioIds, scenario.id])];
    challengeHistory = challengeHistory.map((item) => item.id === active.id ? { ...item, completedScenarioIds: completed, ...(item.scenarioIds.every((scenarioId) => completed.includes(scenarioId)) ? { completedAt: input.atISO } : {}) } : item);
  }
  const notebook = state.notebook.map((note) => note.id.toLowerCase() === record.gapId ? { ...note, lastPractisedAt: input.atISO, nextReviewOn: expressionNextDay(input.today) } : note);
  let pendingCheckpoints = state.pendingCheckpoints;
  if (state.fresh) pendingCheckpoints = pendingCheckpoints.map((checkpoint) => checkpoint.scenarioId === scenario.id && (!record.gapId || !checkpoint.gapId || checkpoint.gapId === record.gapId) ? { ...checkpoint, completedOn: input.today } : checkpoint);
  if ((!state.fresh || record.gapId) && !pendingCheckpoints.some((checkpoint) => checkpoint.scenarioId === scenario.id && checkpoint.dueOn === expressionNextDay(input.today) && checkpoint.gapId === record.gapId)) pendingCheckpoints = [...pendingCheckpoints, { scenarioId: scenario.id, dueOn: expressionNextDay(input.today), ...(record.gapId ? { gapId: record.gapId } : {}) }];
  const finished = challengeHistory.find((item) => item.id === active?.id);
  const expression = getPracticeExpression(scenario.expressionId, professionalWords)!;
  return { ...state, phase: "saved", rehearsalHistory, challengeHistory, notebook, pendingCheckpoints, attemptId: id, activeRehearsalId: id, practiceDates: [...new Set([...state.practiceDates, input.today])], practiceWordIds: [...new Set([...state.practiceWordIds, expression.wordId])], challengeCompletedIds: completed, completedComebackOn: finished?.mode === "comeback" && finished.completedAt ? input.today : state.completedComebackOn, completedChallengeCounts: finished?.mode === "transfer" && finished.completedAt ? [...new Set([...state.completedChallengeCounts, finished.milestone])] : state.completedChallengeCounts };
}
export function productionEvidenceForRehearsal(state: Workspace, input: { today: string; quality: 0 | 1 | 2 | 3; meaningConfirmed: boolean; naturalnessConfirmed: boolean; attemptId: string }): ExpressionEvidence | null {
  const scenario = knownStudioScenario(state.scenarioId, state.roleId);
  if (!scenario || state.phase !== "comparison") return null;
  const active = state.rehearsalHistory.find((item) => item.id === state.activeRehearsalId && item.scenarioId === scenario.id);
  const currentOriginal = state.attemptDate === input.today && studioInstant(state.originalCapturedAtISO) && Boolean(active) && Date.parse(state.originalCapturedAtISO ?? "") >= Date.parse(active?.startedAt ?? "");
  if (!currentOriginal && input.quality > 1) return null;
  return buildExpressionEvidence({ expressionId: scenario.expressionId, roleId: state.roleId, response: state.submittedResponse, modelSeen: !state.attemptIndependent || !currentOriginal, meaningConfirmed: input.meaningConfirmed, naturalnessConfirmed: input.naturalnessConfirmed, quality: input.quality, independent: state.attemptIndependent && currentOriginal, catalogueWords: professionalWords, date: input.today, attemptId: input.attemptId, ...(currentOriginal ? { capturedAtISO: state.originalCapturedAtISO } : {}) });
}
export function mergeExpressionWorkspaceHistory(local: Workspace, incoming: Workspace): Workspace {
  if (local.roleId !== incoming.roleId) return local;
  const rehearsalHistory = safeRehearsals([...local.rehearsalHistory, ...incoming.rehearsalHistory], local.roleId);
  const challengeHistory = safeChallenges([...local.challengeHistory, ...incoming.challengeHistory], local.roleId);
  const notes = new Map(local.notebook.map((note) => [note.id.toLowerCase(), note]));
  for (const note of incoming.notebook) {
    const prior = notes.get(note.id.toLowerCase());
    if (!prior) notes.set(note.id.toLowerCase(), note);
    else if (prior.expressionId === note.expressionId && prior.variant === note.variant && prior.phrase === note.phrase) {
      const latest = Date.parse(note.lastPractisedAt ?? "") > Date.parse(prior.lastPractisedAt ?? "") || !prior.lastPractisedAt && note.lastPractisedAt ? note : prior;
      const tied = note.lastPractisedAt === prior.lastPractisedAt;
      const nextReviewOn = tied ? [note.nextReviewOn, prior.nextReviewOn].filter((date): date is string => Boolean(date)).sort()[0] : latest.nextReviewOn;
      notes.set(note.id.toLowerCase(), { ...latest, nextReviewOn, intent: prior.intent, createdAt: [prior.createdAt, note.createdAt].filter((date): date is string => Boolean(date)).sort()[0] });
    }
  }
  const checkpoints = new Map(local.pendingCheckpoints.map((item) => [`${item.scenarioId}:${item.dueOn}`, item]));
  for (const item of incoming.pendingCheckpoints) { const key = `${item.scenarioId}:${item.dueOn}`, own = checkpoints.get(key); checkpoints.set(key, { ...own, ...item, gapId: own?.gapId ?? item.gapId, completedOn: own?.completedOn ?? item.completedOn }); }
  const completedChallengeCounts = [...new Set([...local.completedChallengeCounts, ...incoming.completedChallengeCounts, ...challengeHistory.filter((item) => item.mode === "transfer" && item.completedAt).map((item) => item.milestone)])];
  const pending = challengeHistory.filter((item) => item.mode === "transfer" && !item.completedAt).sort((a, b) => a.milestone - b.milestone)[0];
  return { ...local, rehearsalHistory, challengeHistory, notebook: [...notes.values()], pendingCheckpoints: [...checkpoints.values()], practiceDates: [...new Set([...local.practiceDates, ...incoming.practiceDates])], practiceWordIds: [...new Set([...local.practiceWordIds, ...incoming.practiceWordIds])], completedChallengeCounts, ...(pending ? { challengeCount: pending.milestone, challengeScenarioIds: pending.scenarioIds, challengeCompletedIds: pending.completedScenarioIds } : {}) };
}

/** Role/day keys prevent a stale or differently scoped draft earning current credit. */
export default function ExpressionPractice(props: ExpressionPracticeProps) {
  return <ExpressionWorkspace key={`${props.roleId}:${props.today ?? new Date().toISOString().slice(0, 10)}`} {...props} />;
}
function ExpressionWorkspace(props: ExpressionPracticeProps) {
  const today = props.today ?? new Date().toISOString().slice(0, 10);
  const [workspace, setWorkspace] = useState(() => parseExpressionWorkspace(props.roleId, props.savedDraft));
  const current = useRef(workspace);
  const allDrafts = useRef(workspaceDrafts(props.savedDraft));
  const gate = useRef(createExpressionCommitGate());
  const pending = useRef<{ next: Workspace; evidence?: ExpressionEvidence; exposed?: readonly string[]; transactionId?: string; exposedAtISO?: string } | null>(null);
  const [intentInput, setIntentInput] = useState(workspace.intent);
  const [responseInput, setResponseInput] = useState(workspace.response);
  const [saveError, setSaveError] = useState("");
  const [hasPendingSave, setHasPendingSave] = useState(false);
  const [meaningConfirmed, setMeaningConfirmed] = useState(false);
  const [naturalnessConfirmed, setNaturalnessConfirmed] = useState(false);
  const [quality, setQuality] = useState<1 | 2 | 3>(2);
  const [theme, setTheme] = useState<ExpressionTheme | "all">("all");
  const [discoveryQuery, setDiscoveryQuery] = useState("");
  const matches = useMemo(() => findExpressionMatches({ text: workspace.intent, goalId: workspace.goalId, roleId: props.roleId }).slice(0, 3), [workspace.intent, workspace.goalId, props.roleId]);
  const curatedScenarios = getScenariosForRole(props.roleId);
  const practicedWordIds = [...new Set([...props.learnedWordIds, ...workspace.practiceWordIds])];
  const learnedScenarios = getLearnedExpressionScenarios(props.roleId, practicedWordIds, professionalWords);
  const availableScenarios = [...new Map([...curatedScenarios, ...learnedScenarios, ...workspace.rehearsalHistory.flatMap((item) => studioScenarios.get(item.scenarioId) ? [studioScenarios.get(item.scenarioId)!] : []), ...workspace.challengeHistory.flatMap((item) => item.scenarioIds.flatMap((id) => studioScenarios.get(id) ? [studioScenarios.get(id)!] : []))].map((scenario) => [scenario.id, scenario])).values()];
  const computedFifthDay = getFifthDayChallenge({ date: today, activeDates: [...(props.activeDates ?? []), ...workspace.practiceDates], roleId: props.roleId, learnedWordIds: practicedWordIds, catalogueWords: professionalWords, completedChallengeCounts: workspace.completedChallengeCounts });
  const pendingTransfer = workspace.challengeHistory.filter((item) => item.mode === "transfer" && !item.completedAt).sort((a, b) => a.milestone - b.milestone)[0];
  const fifthDay = pendingTransfer ? { ...computedFifthDay, due: true, challengeCount: pendingTransfer.milestone, scenarios: pendingTransfer.scenarioIds.flatMap((id) => studioScenarios.get(id) ? [studioScenarios.get(id)!] : []) } : computedFifthDay;
  const lastActiveDate = [props.lastActiveDate, ...workspace.practiceDates].filter((date): date is string => typeof date === "string" && date <= today).sort().at(-1);
  const comeback = buildComebackPlan({ date: today, lastActiveDate, roleId: props.roleId, learnedWordIds: practicedWordIds, catalogueWords: professionalWords });
  const selectedScenario = availableScenarios.find((scenario) => scenario.id === workspace.scenarioId);
  const expression = selectedScenario ? getPracticeExpression(selectedScenario.expressionId, professionalWords) : undefined;
  const checkpoint = workspace.pendingCheckpoints.find((item) => !item.completedOn && item.dueOn <= today && availableScenarios.some((scenario) => scenario.id === item.scenarioId));
  const discovery = getTenWordDiscovery({ roleId: props.roleId, query: discoveryQuery, catalogueWords: professionalWords });
  const focused = workspace.submittedResponse && expression ? checkExpressionResponse(expression.id, workspace.submittedResponse, professionalWords) : undefined;
  const staleOriginal = workspace.phase === "comparison" && (workspace.attemptDate !== today || !studioInstant(workspace.originalCapturedAtISO));
  const visibleExpressions = getExpressionsForRole(props.roleId).filter((entry) => theme === "all" || entry.theme === theme);

  function persist(next: Workspace, evidence?: ExpressionEvidence, exposed: readonly string[] = [], transactionId?: string, exposedAtISO?: string): boolean {
    const candidate = { next, evidence, exposed, transactionId, exposedAtISO: exposed.length ? exposedAtISO ?? new Date().toISOString() : undefined };
    try {
      const saved = commitExpressionTransaction({ ...candidate, exposedContextIds: exposed, gate: gate.current, onCommit: (draft, result, exposures) => {
        const workspaces = { ...allDrafts.current, [props.roleId]: JSON.parse(draft) as Workspace };
        const accepted = props.onCommit(JSON.stringify({ version: 2, workspaces }), result, exposures, candidate.exposedAtISO);
        if (accepted) allDrafts.current = workspaces;
        return accepted;
      }, onApply: (accepted) => {
        current.current = accepted; setWorkspace(accepted); setIntentInput(accepted.intent); setResponseInput(accepted.response);
      } });
      if (!saved) { pending.current = candidate; setHasPendingSave(true); setSaveError("Saving failed. Your text is retained here; retry saving before continuing."); return false; }
      pending.current = null; setHasPendingSave(false); setSaveError(""); return true;
    } catch { pending.current = candidate; setHasPendingSave(true); setSaveError("Saving failed. Your text is retained here; retry saving before continuing."); return false; }
  }
  function retrySave() { const candidate = pending.current; if (candidate) persist(mergeExpressionWorkspaceHistory(candidate.next, current.current), candidate.evidence, candidate.exposed, candidate.transactionId, candidate.exposedAtISO); }
  function clearConfirmation() { setMeaningConfirmed(false); setNaturalnessConfirmed(false); setQuality(2); }
  function contextIdsForExpressions(ids: readonly string[]): string[] {
    return ids.flatMap((id) => { const entry = getPracticeExpression(id, professionalWords); return entry && entry.roleIds.includes(props.roleId) ? [expressionEvidenceSenseId(entry.wordId, props.roleId)] : []; });
  }
  function withExposure(next: Workspace, ids: readonly string[]): Workspace { return { ...next, hintedOn: { ...next.hintedOn, ...Object.fromEntries(ids.map((id) => [id, today])) } }; }
  function exposedBeforeAttempt(scenario: ExpressionScenario, state: Workspace): boolean {
    const entry = getPracticeExpression(scenario.expressionId, professionalWords);
    return !entry || state.hintedOn[scenario.expressionId] === today || !expressionIndependentAllowed(entry.wordId, props.roleId, today, props.exposedOn ?? {}) || !expressionIndependentAllowed(entry.wordId, props.roleId, today, state.hintedOn);
  }
  function startScenario(scenario: ExpressionScenario, fresh = false, challengeCount?: number, challengeScenarioIds: string[] = [], comebackAttempt = false, gapId?: string) {
    if (saveError) return;
    const state = current.current;
    const priorChallenge = challengeCount ? state.challengeHistory.find((item) => item.mode === "transfer" && item.milestone === challengeCount) : undefined;
    const chosenScenario = priorChallenge ? studioScenarios.get(priorChallenge.scenarioIds.find((id) => !priorChallenge.completedScenarioIds.includes(id)) ?? scenario.id) ?? scenario : scenario;
    const next = beginExpressionRehearsal(state, { scenarioId: scenario.id, today, atISO: new Date().toISOString(), id: newAttemptId(), fresh, hinted: exposedBeforeAttempt(chosenScenario, state), gapId, ...(challengeCount ? { challenge: { mode: "transfer" as const, milestone: challengeCount, scenarioIds: challengeScenarioIds } } : comebackAttempt ? { challenge: { mode: "comeback" as const, milestone: 0, scenarioIds: [scenario.id] } } : {}) });
    if (next !== state && persist(next)) clearConfirmation();
  }
  function showMatches() {
    const ids = contextIdsForExpressions(matches.map((match) => match.expression.id));
    persist(withExposure({ ...current.current, matchesVisible: true }, ids), undefined, ids);
  }
  function selectPhrase(expressionId: string, variant: NotebookEntry["variant"]) {
    const entry = getPracticeExpression(expressionId, professionalWords);
    const scenario = availableScenarios.find((item) => item.expressionId === expressionId);
    if (!entry || !scenario) return;
    const ids = contextIdsForExpressions([expressionId]);
    const atISO = new Date().toISOString();
    const note = { id: newAttemptId(), expressionId, variant, phrase: entry[variant], intent: current.current.intent, createdOn: today, createdAt: atISO, nextReviewOn: expressionNextDay(today) };
    const next = withExposure(beginExpressionRehearsal({ ...current.current, notebook: [...current.current.notebook, note].slice(-500) }, { scenarioId: scenario.id, today, atISO, id: newAttemptId(), hinted: true, gapId: note.id }), ids);
    if (persist(next, undefined, ids)) clearConfirmation();
  }
  function compare(help = false) {
    const state = current.current;
    if (!selectedScenario || state.phase !== "draft" || (!help && !state.response.trim()) || saveError) return;
    const ids = contextIdsForExpressions([selectedScenario.expressionId]);
    const independent = !help && !state.hintExposed && !exposedBeforeAttempt(selectedScenario, state) && state.attemptDate === today;
    const capturedAtISO = new Date().toISOString();
    const exposedAtISO = new Date(Math.max(Date.parse(new Date().toISOString()), Date.parse(capturedAtISO) + 1)).toISOString();
    const next = captureExpressionRehearsal(state, { today, capturedAtISO, help, independent, id: newAttemptId() });
    if (next !== state && persist(withExposure(next, ids), undefined, ids, undefined, exposedAtISO)) clearConfirmation();
  }
  function finish(recordEvidence: boolean) {
    const state = current.current;
    if (!selectedScenario || !expression || state.phase !== "comparison" || saveError) return;
    let evidence: ExpressionEvidence | undefined;
    const attemptId = studioUuid(state.attemptId) ? state.attemptId.toLowerCase() : newAttemptId();
    if (recordEvidence) {
      evidence = productionEvidenceForRehearsal(state, { today, quality, meaningConfirmed, naturalnessConfirmed, attemptId }) ?? undefined;
      if (!evidence) { setSaveError("Check the meaning and wording, or save this rehearsal without a word score."); return; }
    }
    const next = finishExpressionRehearsal(state, { today, atISO: new Date().toISOString(), id: attemptId });
    if (next === state) { setSaveError("Start a fresh response before saving this rehearsal."); return; }
    persist(next, evidence, [], `finish:${next.attemptId}`);
  }
  function retry() {
    if (!selectedScenario) return;
    const state = current.current, ids = contextIdsForExpressions([selectedScenario.expressionId]);
    const active = state.challengeHistory.find((item) => item.id === state.activeChallengeId);
    const next = beginExpressionRehearsal(state, { scenarioId: selectedScenario.id, today, atISO: new Date().toISOString(), id: newAttemptId(), fresh: state.fresh, hinted: true, gapId: state.rehearsalHistory.find((item) => item.id === state.activeRehearsalId)?.gapId, ...(active ? { challenge: { mode: active.mode, milestone: active.milestone, scenarioIds: active.scenarioIds } } : {}) });
    if (next !== state && persist(withExposure(next, ids), undefined, ids)) clearConfirmation();
  }

  function chooseNuance(expressionId: string, contrastIndex: number, choice: NuanceChoice) {
    if (saveError) return;
    const state = current.current;
    const key = expressionNuanceKey(expressionId, contrastIndex);
    if (state.nuanceAnswers[key]?.choice === choice) return;
    const result = buildNuanceChoice({ expressionId, roleId: props.roleId, contrastIndex, choice, date: today, attemptId: newAttemptId(), previous: state.nuanceAnswers[key], catalogueWords: professionalWords });
    if (!result) return;
    const ids = contextIdsForExpressions([expressionId]);
    persist(withExposure({ ...state, nuanceAnswers: { ...state.nuanceAnswers, [result.key]: result.answer } }, ids), result.evidence, ids, result.evidence ? `nuance:${result.evidence.attemptId}` : undefined);
  }
  function changeScreen(screen: Workspace["screen"]) {
    const ids = screen === "discover" ? discovery.map((word) => expressionEvidenceSenseId(word.wordId, props.roleId)) : [];
    persist(withExposure({ ...current.current, screen }, ids), undefined, ids);
  }
  useEffect(() => {
    const incoming = parseExpressionWorkspace(props.roleId, props.savedDraft);
    allDrafts.current = workspaceDrafts(props.savedDraft);
    const next = mergeExpressionWorkspaceHistory(current.current, incoming);
    if (JSON.stringify(next) !== JSON.stringify(current.current)) {
      current.current = next;
      queueMicrotask(() => { if (current.current === next) setWorkspace(next); });
    }
  }, [props.roleId, props.savedDraft]);
  // A restored discovery/results screen is also exposure, even on a different day.
  useEffect(() => {
    const state = current.current;
    const visible = state.screen === "discover" ? discovery.map((word) => expressionEvidenceSenseId(word.wordId, props.roleId)) : state.screen === "find" && state.matchesVisible ? contextIdsForExpressions(matches.map((match) => match.expression.id)) : [];
    const missing = visible.filter((id) => state.hintedOn[id] !== today);
    if (missing.length) persist(withExposure(state, missing), undefined, missing);
    // Contents are recorded on screen entry and searches; this handles a restored screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  return <section className="expression-studio" aria-labelledby="expression-title">
    <style>{styles}</style>
    <header className="expression-heading"><small>FROM KNOWING TO SAYING</small><h1 id="expression-title">Find the words for your idea.</h1><p>Choose language that fits your meaning, rehearse a real situation, then return for a different prompt. Clear wording matters more than a bigger word.</p></header>
    {saveError && <div className="expression-notice" role="alert"><p>{saveError}</p>{hasPendingSave ? <button type="button" onClick={retrySave}>Retry saving</button> : <button type="button" onClick={() => setSaveError("")}>Return to comparison</button>}</div>}
    <div className="expression-modes" role="group" aria-label="Expression activities">{([["find", "What I wanted to say"], ["practice", "Rehearse tomorrow"], ["discover", "Discover and reread"]] as const).map(([screen, label]) => <button type="button" disabled={Boolean(saveError)} key={screen} aria-pressed={workspace.screen === screen} onClick={() => changeScreen(screen)}>{label}</button>)}</div>
    <div className="expression-reminders">
      {checkpoint && <article><strong>A different situation is ready</strong><p>Respond before seeing the focus word. Compare your meaning yourself after committing.</p><button type="button" disabled={Boolean(saveError)} onClick={() => startScenario(availableScenarios.find((item) => item.id === checkpoint.scenarioId)!, true, undefined, [], false, checkpoint.gapId)}>Try the delayed checkpoint</button></article>}
      {fifthDay.due && <article><strong>Your fifth-day transfer challenge</strong><p>Up to three unfamiliar situations using words already in your practice. It stays available until you finish; completion is separate from word mastery.</p><button type="button" disabled={Boolean(saveError)} onClick={() => startScenario(fifthDay.scenarios[0], true, fifthDay.challengeCount, fifthDay.scenarios.map((item) => item.id))}>Start the challenge</button></article>}
      {comeback.suggested && workspace.completedComebackOn !== today && <article><strong>A small restart</strong><p>You have been away for {comeback.awayDays} days. Try one familiar situation, then choose whether to continue.</p><button type="button" disabled={Boolean(saveError)} onClick={() => startScenario(comeback.scenarios[0], false, undefined, [], true)}>Try one familiar situation</button></article>}
    </div>
    {workspace.screen === "find" && <div className="expression-panel">
      <label htmlFor="expression-intent">What did you want to express?</label><textarea id="expression-intent" rows={3} value={intentInput} placeholder="I wanted to question an estimate without sounding dismissive…" onChange={(event) => { setIntentInput(event.target.value); persist({ ...current.current, intent: event.target.value, matchesVisible: false }); }} />
      <div className="expression-controls"><label htmlFor="expression-goal">Your goal<select id="expression-goal" disabled={Boolean(saveError)} value={workspace.goalId} onChange={(event) => persist({ ...current.current, goalId: event.target.value as ExpressionGoal, matchesVisible: false })}>{expressionContent.goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.label}</option>)}</select></label><button type="button" disabled={Boolean(saveError)} className="primary-button" onClick={showMatches}>Find curated phrasing</button></div>
      <p className="expression-caption">Suggestions use authored keywords and your goal. Your text stays in your private practice draft and is never sent to an AI provider.</p>
      {workspace.matchesVisible && <div className="expression-cards">{matches.length ? matches.map(({ expression: entry, matchedKeywords, reason }) => <article key={entry.id}><small>{reason === "keywords" ? `Related to: ${matchedKeywords.join(", ")}` : "An option for your goal"}</small><h2>{entry.title}</h2><dl><dt>Plain and direct</dt><dd>{entry.plain}</dd><dt>More precise when it fits</dt><dd>{entry.precise}</dd><dt>Room for dialogue</dt><dd>{entry.diplomatic}</dd></dl><p>{entry.register}</p><p><strong>Watch for:</strong> {entry.misuse}</p><div className="expression-controls">{([["plain", "Practise the plain option"], ["precise", "Practise the precise option"], ["diplomatic", "Practise the dialogue option"]] as const).map(([variant, label]) => <button disabled={Boolean(saveError)} key={variant} type="button" onClick={() => selectPhrase(entry.id, variant)}>{label}</button>)}</div></article>) : <p>No authored match is available for this role. Try a different goal or choose a practice situation.</p>}</div>}
      {workspace.notebook.length > 0 && <><h2>Your useful phrasing</h2><p>Saved choices stay connected to your practice and delayed checkpoints.</p><div className="expression-cards">{workspace.notebook.slice(-6).reverse().map((note) => <details key={note.id} onToggle={(event) => { if (event.currentTarget.open) { const ids = contextIdsForExpressions([note.expressionId]); if (ids.some((id) => current.current.hintedOn[id] !== today)) persist(withExposure(current.current, ids), undefined, ids); } }}><summary>{note.intent || "A phrasing choice"}</summary><p>{note.phrase}</p><p className="expression-caption">Saved {note.createdOn} · {note.variant}{note.lastPractisedAt ? ` · Practised ${note.lastPractisedAt.slice(0, 10)}` : " · Not yet practised"}{note.nextReviewOn ? ` · Planned revisit ${note.nextReviewOn}` : ""}</p><button type="button" disabled={Boolean(saveError)} onClick={() => { const scenario = availableScenarios.find((item) => item.expressionId === note.expressionId); if (scenario) startScenario(scenario, Boolean(note.lastPractisedAt), undefined, [], false, note.id); }}>Rehearse this idea</button></details>)}</div></>}
      <div className="expression-controls"><h2>Close meanings, different effects</h2><label htmlFor="expression-theme">Theme<select id="expression-theme" value={theme} onChange={(event) => setTheme(event.target.value as ExpressionTheme | "all")}><option value="all">All themes for this role</option><option value="emotions">Emotions</option><option value="intellectual">Intellectual</option><option value="leadership">Leadership</option></select></label></div>
      <div className="expression-cards">{visibleExpressions.map((entry) => <details key={entry.id} onToggle={(event) => { const ids = contextIdsForExpressions([entry.id]); if (event.currentTarget.open && ids.some((id) => current.current.hintedOn[id] !== today)) persist(withExposure(current.current, ids), undefined, ids); }}><summary>{entry.title}</summary><h3>{entry.term}</h3><p><strong>Plain and direct:</strong> {entry.plain}</p><p><strong>More precise when it fits:</strong> {entry.precise}</p><p><strong>Register:</strong> {entry.register}</p><p><strong>Useful patterns:</strong> {entry.collocations.join(" · ")}</p><p><strong>Sense and misuse:</strong> {entry.misuse}</p>{entry.contrasts.map((contrast, index) => {
        const answer = workspace.nuanceAnswers[expressionNuanceKey(entry.id, index)];
        const options = (entry.id.length + index) % 2 === 0 ? ["fitting", "awkward"] as const : ["awkward", "fitting"] as const;
        return <fieldset className="expression-nuance" key={contrast.nearby}><legend>{entry.term} / {contrast.nearby}</legend><p>{contrast.distinction}</p><h4>Which example fits this meaning?</h4><div className="expression-nuance-options">{options.map((choice) => <button type="button" key={choice} disabled={Boolean(saveError)} aria-pressed={answer?.choice === choice} onClick={() => chooseNuance(entry.id, index, choice)}>{choice === "fitting" ? contrast.fitting : contrast.awkward}</button>)}</div>{answer && <div className="expression-nuance-feedback" role="status"><strong>{answer.choice === "fitting" ? "This fits the authored distinction." : "Compare the distinction again."}</strong><p>{contrast.explanation}</p><p className="expression-caption">{answer.choice === "fitting" ? "Recognition saved once for this comparison. Repeating it adds no new credit." : "Try the other option after comparing the intended meaning."}</p></div>}</fieldset>;
      })}<p className="expression-caption">Choose plain English when it is clearer or warmer. These comparisons record recognition only, with no unaided recall, production, mastery or XP credit.</p></details>)}</div>
    </div>}
    {workspace.screen === "practice" && <div className="expression-panel">
      {!selectedScenario || !expression ? <><h2>What would you say?</h2><p>Choose a meeting, interview or disagreement. The focus word and example stay hidden until you commit your first response.</p><div className="expression-cards">{curatedScenarios.map((scenario, index) => <article key={scenario.id}><small>{scenario.kind}</small><h3>Situation {index + 1}</h3><p>{scenario.prompt}</p><button type="button" disabled={Boolean(saveError)} onClick={() => startScenario(scenario)}>Try this situation</button></article>)}</div></> : <>
        <small>{workspace.fresh ? "Different situation" : selectedScenario.id.startsWith("catalogue-") ? "Familiar catalogue situation" : selectedScenario.kind}</small><h2>{workspace.fresh ? "Recall it in a different situation" : "What would you say?"}</h2><p>{workspace.fresh ? selectedScenario.freshPrompt : selectedScenario.prompt}</p>
        {workspace.phase === "draft" ? <><p className="expression-caption">{workspace.hintExposed || exposedBeforeAttempt(selectedScenario, workspace) ? "You have seen support for this phrase today. This attempt will be saved as supported practice." : "Respond without revealing a word or example. A plain alternative is welcome."}</p><label htmlFor="expression-response">Your response</label><textarea id="expression-response" rows={4} value={responseInput} onChange={(event) => { setResponseInput(event.target.value); persist({ ...current.current, response: event.target.value, responses: { ...current.current.responses, [`${selectedScenario.id}:${workspace.fresh ? "fresh" : "initial"}`]: event.target.value } }); }} /><div className="expression-controls"><button type="button" className="primary-button" disabled={!workspace.response.trim() || Boolean(saveError)} onClick={() => compare()}>Commit response and compare</button><button type="button" disabled={Boolean(saveError)} onClick={() => compare(true)}>Show help</button></div></> : <>
          <div className="expression-comparison"><article><small>Your committed response</small><p>{workspace.submittedResponse || "You chose to see help first."}</p></article><article><small>Reference example · {expression.term}</small><p>{workspace.fresh ? selectedScenario.freshExampleResponse : selectedScenario.exampleResponse}</p></article></div>
          <p role="status">{focused?.message ?? "Read the reference, then try your own response."}</p>{staleOriginal && <p className="expression-notice">This response comes from an earlier session or has no original capture time. Choose Difficult to save supported participation, or start a fresh response for a new independent attempt.</p>}<p className="expression-caption">This local check detects a term and familiar patterns. You assess meaning and audience fit yourself; Lucid does not give a semantic, factual or fluency grade.</p>
          <p><strong>Useful patterns:</strong> {expression.collocations.join(" · ")}</p><p>{expression.register}</p><p><strong>Avoid:</strong> {expression.misuse}</p>
          {workspace.phase !== "saved" ? <><fieldset className="expression-attest"><legend>Compare your meaning and wording</legend><label><input type="checkbox" checked={meaningConfirmed} onChange={(event) => setMeaningConfirmed(event.target.checked)} /> My response carries the intended meaning.</label><label><input type="checkbox" checked={naturalnessConfirmed} onChange={(event) => setNaturalnessConfirmed(event.target.checked)} /> My wording fits this audience.</label><label htmlFor="expression-confidence">How did it feel?<select id="expression-confidence" value={quality} onChange={(event) => setQuality(Number(event.target.value) as 1 | 2 | 3)}><option value={1}>Difficult — revisit soon</option><option value={2} disabled={staleOriginal}>Manageable — keep practising</option><option value={3} disabled={staleOriginal}>Easy — felt fluent</option></select></label></fieldset><div className="expression-controls"><button type="button" className="primary-button" disabled={!meaningConfirmed || !naturalnessConfirmed || !focused?.termFound || !focused.enoughContext || Boolean(saveError) || staleOriginal && quality > 1} onClick={() => finish(true)}>Save self-assessed word practice</button><button type="button" disabled={Boolean(saveError)} onClick={retry}>Retry with support</button><button type="button" disabled={Boolean(saveError) || !workspace.submittedResponse.trim()} onClick={() => finish(false)}>Save rehearsal without a word score</button></div>{!focused?.termFound && <p>A clear paraphrase can work well. Save your rehearsal without a target-word score, or try the term with support.</p>}</> : <div className="expression-notice" role="status"><strong>Practice saved</strong><p>{workspace.originalCapturedAtISO ? "Your private response was kept before opening this comparison." : "This was supported practice."} Completion records participation; appropriate use is self-assessed. {workspace.fresh ? "This checkpoint is complete." : "A different situation will be available tomorrow."}</p>{workspace.challengeScenarioIds.some((id) => !workspace.challengeCompletedIds.includes(id)) ? <button type="button" disabled={Boolean(saveError)} onClick={() => { const state = current.current; const next = availableScenarios.find((item) => state.challengeScenarioIds.includes(item.id) && !state.challengeCompletedIds.includes(item.id)); if (next) { const active = state.challengeHistory.find((item) => item.id === state.activeChallengeId); const candidate = beginExpressionRehearsal(state, { scenarioId: next.id, today, atISO: new Date().toISOString(), id: newAttemptId(), fresh: state.fresh, hinted: exposedBeforeAttempt(next, state), ...(active ? { challenge: { mode: active.mode, milestone: active.milestone, scenarioIds: active.scenarioIds } } : {}) }); if (candidate !== state && persist(candidate)) clearConfirmation(); } }}>Next situation</button> : <button type="button" disabled={Boolean(saveError)} onClick={() => persist({ ...current.current, scenarioId: "", phase: "draft" })}>Choose another situation</button>}</div>}
        </>}
      </>}
    </div>}
    {(workspace.rehearsalHistory.length > 0 || workspace.challengeHistory.length > 0) && <section className="expression-panel expression-history" aria-label="Your rehearsal history"><h2>Your rehearsal history</h2><p className="expression-caption">History records situations and participation. Private wording stays on its original device; completion does not claim independent recall or appropriate production.</p><div className="expression-cards">{[...workspace.rehearsalHistory].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 8).map((record) => {
      const scenario = studioScenarios.get(record.scenarioId)!;
      const title = getPracticeExpression(record.expressionId, professionalWords)?.title ?? "A role situation";
      return <article key={record.id}><small>{scenario.kind} · {record.mode === "delayed" ? "Delayed situation" : "Initial rehearsal"}</small><h3>{title}</h3><time dateTime={record.completedAt ?? record.startedAt}>{(record.completedAt ?? record.startedAt).slice(0, 10)} UTC</time><p><strong>{record.completedAt ? "Rehearsal completed" : "Unfinished rehearsal"}</strong></p><p>{record.modelSeen ? "Reference exposure is recorded for this rehearsal." : "No reference exposure is recorded."}</p>{!record.completedAt && <button type="button" disabled={Boolean(saveError)} onClick={() => startScenario(scenario, record.mode === "delayed", undefined, [], false, record.gapId)}>Start a fresh response</button>}</article>;
    })}</div>{workspace.challengeHistory.length > 0 && <div className="expression-cards">{[...workspace.challengeHistory].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 6).map((record) => <article key={record.id}><h3>{record.mode === "transfer" ? `Fifth-day challenge · ${record.milestone} active days` : "Comeback session"}</h3><p>{record.completedScenarioIds.length} of {record.scenarioIds.length} assigned situations completed.</p><p><strong>{record.completedAt ? "Challenge completed" : "Challenge in progress"}</strong></p><time dateTime={record.completedAt ?? record.startedAt}>{(record.completedAt ?? record.startedAt).slice(0, 10)} UTC</time></article>)}</div>}</section>}
    {workspace.screen === "discover" && <div className="expression-panel"><h2>A small collection to reread</h2><p>Explore up to ten words from your role. Browsing awards no learning or mastery credit. Seeing a word makes later same-day practice supported.</p><label htmlFor="expression-discovery">Find a word or meaning<input id="expression-discovery" type="search" value={discoveryQuery} disabled={Boolean(saveError)} onChange={(event) => { const query = event.target.value; const ids = getTenWordDiscovery({ roleId: props.roleId, query, catalogueWords: professionalWords }).map((word) => expressionEvidenceSenseId(word.wordId, props.roleId)); if (persist(withExposure(current.current, ids), undefined, ids)) setDiscoveryQuery(query); }} /></label><div className="expression-cards">{discovery.map((word) => <article key={word.wordId}><h3>{word.term}</h3><p>{word.meaning}</p><blockquote>{word.example}</blockquote><p>{word.whenToUse}</p><p><strong>Patterns:</strong> {word.collocations.join(" · ")}</p></article>)}</div>{discovery.length === 0 && <p>No words match this search in your role.</p>}</div>}
  </section>;
}
const styles = `
.expression-studio{max-width:1180px;margin:0 auto;padding:24px 0 80px;color:var(--ink);font-size:15px;line-height:1.6}.expression-heading{max-width:760px;margin-bottom:28px}.expression-heading small,.expression-panel>small,.expression-cards small{color:var(--teal);font-weight:700;letter-spacing:.08em;font-size:12px}.expression-heading h1{font-family:Georgia,serif;font-weight:400;font-size:clamp(32px,5vw,52px);line-height:1.15;margin:12px 0}.expression-heading p,.expression-caption{color:var(--muted)}.expression-modes,.expression-controls{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:20px 0}.expression-studio button{min-height:44px;border:1px solid var(--line);border-radius:8px;padding:10px 16px;cursor:pointer;background:var(--white);color:var(--ink);font-size:14px}.expression-studio button[aria-pressed=true],.expression-studio .primary-button{background:var(--teal);color:white}.expression-studio button:disabled{opacity:.5;cursor:default}.expression-panel{padding:clamp(18px,4vw,32px);background:var(--white);border:1px solid var(--line);border-radius:12px}.expression-panel h2{font-family:Georgia,serif;font-size:27px;font-weight:400;line-height:1.25}.expression-panel label{display:grid;gap:8px;font-size:14px}.expression-panel textarea,.expression-panel input[type=search],.expression-panel select{width:100%;border:1px solid var(--line);border-radius:6px;padding:12px;background:var(--paper);color:var(--ink);font:inherit}.expression-panel textarea{resize:vertical;min-height:100px}.expression-cards,.expression-comparison,.expression-reminders{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:18px;margin:20px 0}.expression-cards article,.expression-cards details,.expression-reminders article,.expression-comparison article{min-width:0;padding:20px;border:1px solid var(--line);border-radius:9px;background:var(--paper);overflow-wrap:anywhere}.expression-cards h2,.expression-cards h3{margin:10px 0;font-size:23px}.expression-cards dl{margin:18px 0}.expression-cards dt{font-size:12px;color:var(--teal);font-weight:700;margin-top:16px}.expression-cards dd{margin:4px 0}.expression-cards blockquote{margin:12px 0;border-left:2px solid var(--coral);padding-left:12px}.expression-cards summary{min-height:44px;cursor:pointer;font-weight:600}.expression-caption{font-size:13px}.expression-attest{margin:20px 0;border:1px solid var(--line);border-radius:8px;padding:16px}.expression-attest label{display:flex;align-items:flex-start;gap:10px;margin:12px 0}.expression-attest input{width:20px;height:20px;flex:0 0 20px;margin-top:3px}.expression-attest select{max-width:310px}.expression-notice{padding:16px;border:1px solid var(--teal);background:var(--paper);border-radius:8px;margin:16px 0}.expression-notice p{margin:5px 0 12px}.expression-history{margin-top:24px}.expression-nuance{margin:20px 0;padding:16px;border:1px solid var(--line);border-radius:8px;min-width:0}.expression-nuance legend{font-weight:600;padding:0 6px}.expression-nuance h4{font-size:15px;margin:16px 0 10px}.expression-nuance-options{display:grid;gap:10px}.expression-nuance-options button{text-align:left;white-space:normal;line-height:1.5}.expression-nuance-feedback{margin-top:16px;padding:12px;border-left:3px solid var(--teal);background:var(--white)}.expression-nuance-feedback p{margin:6px 0}.expression-reminders:empty{display:none}@media(max-width:600px){.expression-studio{font-size:15px}.expression-controls{align-items:stretch;flex-direction:column}.expression-controls>button{width:100%}.expression-modes button{flex:1 1 140px}.expression-attest label{flex-wrap:wrap}.expression-attest select{max-width:none}.expression-cards,.expression-comparison{grid-template-columns:1fr}}
`;
