import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = new URL("../", import.meta.url), directory = await mkdtemp(join(tmpdir(), "lucid-daily-ui-"));
const modules = new Map();
after(() => rm(directory, { recursive: true, force: true }));
async function moduleURL(relative) {
  if (!modules.has(relative)) modules.set(relative, (async () => {
    const sourceURL = new URL(relative, root);
    let { outputText } = ts.transpileModule(await readFile(sourceURL, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }, fileName: relative });
    const parsed = ts.createSourceFile(relative, outputText, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS), edits = [];
    for (const statement of parsed.statements) {
      if (!(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) || !statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const specifier = statement.moduleSpecifier, name = specifier.text;
      let url;
      if (!name.startsWith(".")) url = import.meta.resolve(name);
      else {
        const dependency = new URL(name, sourceURL);
        if (!/\.[cm]?[jt]sx?$/.test(dependency.pathname)) {
          try { await readFile(new URL(dependency.href + ".ts"), "utf8"); dependency.pathname += ".ts"; }
          catch (error) { if (error.code !== "ENOENT") throw error; dependency.pathname += ".tsx"; }
        }
        url = await moduleURL(dependency.pathname.slice(root.pathname.length));
      }
      edits.push({ start: specifier.getStart(parsed), end: specifier.end, value: JSON.stringify(url) });
    }
    for (const edit of edits.sort((a, b) => b.start - a.start)) outputText = outputText.slice(0, edit.start) + edit.value + outputText.slice(edit.end);
    const path = join(directory, relative.replaceAll("/", "_") + ".mjs"); await writeFile(path, outputText); return pathToFileURL(path).href;
  })());
  return modules.get(relative);
}
const load = async (relative) => import(await moduleURL(relative));
const ui = await load("lib/web-learning-ui.ts"), web = await load("lib/web-learning-state.ts"), daily = await load("lib/daily-vocabulary.ts");
const { default: DailyVocabulary, DailyWordCard, DailyIdiomCard, DailyIdiomReviewSection, enterDailyDestination } = await load("app/DailyVocabulary.tsx");
const { Review } = await load("app/VocabularyApp.tsx");
const day = "2026-10-15", roleId = "finance-accounting";
const profile = { roleId, seniorityId: "experienced-contributor", situationIds: ["finance:month-end-close"], goalIds: ["clarify"] };
function fresh() { return web.prepareWebState({ version: 3, profile, settings: { timeZone: "Etc/UTC", dailyWordCount: 1 }, introducedWordIds: [], masteryByWordId: {}, dailySessions: [], favouriteIds: [], difficultIds: [], reviewedIds: [], completedDays: [], quizAttempts: [], usageAttempts: {} }); }
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
const save = () => true;
function ready() { return daily.ensureDailyVocabulary(fresh(), day, roleId); }
const common = (state, date = day) => ({ state, day: date, profile, scopeKey: "device:synthetic-daily-ui", commit: save });

test("actual daily overview separates Words, Idiom and Review while retaining Courses and the chosen course pace", () => {
  const state = fresh();
  const html = render(DailyVocabulary, { ...common(state), dateLabel: "Thursday, October 15", greeting: "Good morning.", dueCount: 0, navigate() {}, children: React.createElement("section", null, "Existing one-word course practice") });
  assert.match(html, /data-testid="daily-learning-overview"/);
  assert.equal((html.match(/class="daily-destination"/g) ?? []).length, 3);
  for (const label of ["Today’s Words", "Today’s Idiom", "Review", "Courses →", "5 WORDS + 3 OPTIONAL", "ONE EXPRESSION"]) assert.ok(html.includes(label), label);
  assert.match(html, /No reviews due today/); assert.match(html, /Existing one-word course practice/);
  assert.equal(state.settings.dailyWordCount, 1); assert.equal(state.learningV3.dailyVocabulary, undefined);
  assert.doesNotMatch(html, /CEFR|C1|Speak|Listen|speech/i);
});

test("actual word card keeps meaning and example hidden until reveal and labels its private draft as ungraded", () => {
  const state = ready(), word = daily.dailyWords(state, day, roleId)[0];
  const html = render(DailyWordCard, { state, day, profile, word, index: 0, save });
  assert.ok(html.includes(word.term)); assert.equal(html.includes(word.meaning), false); assert.equal(html.includes(word.example), false);
  assert.match(html, /private recall or sentence/); assert.match(html, /optional, ungraded/);
  assert.match(html, /maxLength="2000"/); assert.match(html, /Reveal meaning &amp; example/);
  assert.doesNotMatch(html, /Add to spaced review|readOnly=""/);
});

test("revealed word card displays authored guidance and explicit tomorrow review opt-in without earned credit", () => {
  let state = ready(); const word = daily.dailyWords(state, day, roleId)[0];
  state = daily.saveDailyWordDraft(state, day, roleId, word.id, "I will use this in a fictional update.");
  state = daily.revealDailyWord(state, day, roleId, word.id);
  const html = render(DailyWordCard, { state, day, profile, word, index: 0, save });
  assert.ok(html.includes(word.meaning)); assert.ok(html.includes(word.example));
  assert.match(html, /readOnly=""/); assert.match(html, /I will use this in a fictional update/);
  assert.match(html, /Add to spaced review/); assert.match(html, /Starts tomorrow/);
  assert.equal(ui.effortPoints(state), 0); assert.equal(daily.dailyWordIsInReview(state, roleId, word.id), false);
  const scheduled = daily.addDailyWordToReview(state, day, roleId, word.id);
  assert.match(render(DailyWordCard, { state: scheduled, day, profile, word, index: 0, save }), /disabled="">In spaced review/);
});

test("actual idiom card withholds definitions and examples before an ungraded attempt", () => {
  const state = ready(), idiom = daily.dailyIdiom(state, day);
  const html = render(DailyIdiomCard, { state, day, profile, idiom, save });
  assert.ok(html.includes(idiom.phrase)); assert.equal(html.includes(idiom.meaning), false); assert.equal(html.includes(idiom.example), false);
  assert.match(html, /What do you think it means/); assert.match(html, /private, ungraded/); assert.match(html, /Reveal meaning &amp; usage/);
});

test("revealed idiom gives register, context and plain English with an explicit separate review opt-in", () => {
  let state = ready(); const idiom = daily.dailyIdiom(state, day);
  state = daily.revealDailyIdiom(state, day, roleId, idiom.id);
  const html = render(DailyIdiomCard, { state, day, profile, idiom, save });
  for (const text of [idiom.meaning, idiom.example, idiom.register, idiom.context, idiom.plainEnglish]) assert.ok(html.includes(text), text);
  assert.match(html, /Add idiom to spaced review/); assert.match(html, /separate from word mastery and points/);
  assert.doesNotMatch(html, /I remembered it/); assert.equal(daily.idiomReviewSchedule(state, idiom.id), undefined);
  assert.equal(ui.effortPoints(state), 0);
});

function idiomDue() {
  let state = ready(); const idiom = daily.dailyIdiom(state, day);
  state = daily.revealDailyIdiom(state, day, roleId, idiom.id);
  state = daily.addDailyIdiomToReview(state, day, roleId, idiom.id);
  return { state, idiom, tomorrow: "2026-10-16" };
}

test("same-day idiom exposure offers no recall success; later Review contains the due self-check with guidance hidden", () => {
  const { state, idiom, tomorrow } = idiomDue();
  assert.equal(render(DailyIdiomReviewSection, common(state)), "");
  const html = render(Review, common(state, tomorrow));
  assert.match(html, /aria-label="Idiom self-checks due"/); assert.match(html, /Revisit your expressions/);
  assert.ok(html.includes(idiom.phrase)); assert.equal(html.includes(idiom.example), false);
  assert.match(html, /Recall the meaning or write a fresh example/); assert.doesNotMatch(html, /I remembered it/);
});

test("revealing an empty due idiom attempt disables remembered success and offers supported practice", () => {
  let { state, idiom, tomorrow } = idiomDue();
  state = daily.revealDailyIdiom(state, tomorrow, roleId, idiom.id);
  const html = render(DailyIdiomCard, { state, day: tomorrow, profile, idiom, save });
  assert.match(html, /disabled="">I remembered it/); assert.match(html, /No original answer was saved before reveal/); assert.match(html, /Practise again/);
});

test("daily destinations visibly disable advancement when a local save needs retry", () => {
  const html = render(DailyVocabulary, { ...common(fresh()), blocked: true, dateLabel: "Thursday", greeting: "Good morning.", dueCount: 0, navigate() {}, children: null });
  assert.equal((html.match(/class="daily-destination" disabled=""/g) ?? []).length, 3);
});


test("saved daily collection reopens repeatedly after Back or reload without attempting a no-op commit", () => {
  const state = ready(), props = common(state), expected = { day, roleId, scopeKey: props.scopeKey };
  assert.equal(daily.ensureDailyVocabulary(state, day, roleId), state, "fixture is already pinned");
  let writes = 0, entries = 0;
  const rejectsNoop = () => { writes++; return false; };
  for (let visit = 0; visit < 3; visit++) {
    assert.equal(enterDailyDestination(props, expected, day, rejectsNoop, () => entries++), true);
  }
  assert.equal(entries, 3); assert.equal(writes, 0);
});

test("first daily entry saves its pinned collection atomically and a rejected save cannot enter", () => {
  let state = fresh(), entries = 0, writes = 0;
  const props = common(state), expected = { day, roleId, scopeKey: props.scopeKey };
  const enter = () => entries++;
  assert.equal(enterDailyDestination(props, expected, day, () => { writes++; return false; }, enter), false);
  assert.equal(entries, 0); assert.equal(state.learningV3.dailyVocabulary, undefined);
  assert.equal(enterDailyDestination(props, expected, day, mutation => { writes++; state = mutation(state); return true; }, enter), true);
  assert.ok(daily.dailyCollection(state, day, roleId)); assert.equal(entries, 1); assert.equal(writes, 2);
  assert.equal(enterDailyDestination({ ...props, state }, expected, day, () => { throw new Error("must not commit saved work"); }, enter), true);
  assert.equal(entries, 2);
});

test("pinned daily entry still rejects stale account, role, day and failed-save transitions", () => {
  const state = ready(), props = common(state), expected = { day, roleId, scopeKey: props.scopeKey };
  let entries = 0, writes = 0;
  const enter = () => entries++, save = () => { writes++; return true; };
  for (const altered of [
    { ...props, blocked: true },
    { ...props, scopeKey: "device:another-learner" },
    { ...props, day: "2026-10-16" },
    { ...props, profile: { ...profile, roleId: "project-product" } },
    { ...props, state: { ...state, profile: null } },
  ]) assert.equal(enterDailyDestination(altered, expected, day, save, enter), false);
  assert.equal(enterDailyDestination(props, expected, "2026-10-16", save, enter), false);
  assert.equal(entries, 0); assert.equal(writes, 0);
});

test("a local save failure prevents further draft edits while retaining the visible private text", () => {
  let state = ready(); const word = daily.dailyWords(state, day, roleId)[0];
  state = daily.saveDailyWordDraft(state, day, roleId, word.id, "Keep this private response recoverable.");
  const html = render(DailyWordCard, { state, day, profile, word, index: 0, save, blocked: true });
  assert.match(html, /readOnly=""/); assert.match(html, /Keep this private response recoverable/);
  assert.match(html, /disabled="">Reveal meaning &amp; example/);
});
