import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = new URL("../", import.meta.url), directory = await mkdtemp(join(tmpdir(), "lucid-korean-web-ui-"));
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
const locales = await load("lib/learning-locales.ts"), copy = await load("lib/learning-locale-copy.ts");
const { LearningLanguageProvider, LearningLanguageChoice, LearningCoverageNote, LEARNING_LANGUAGE_KEY, readLearningLanguage, saveLearningLanguage, requestedLearningLanguage, urlForLearningLanguage } = await load("app/LearningLanguage.tsx");
const { default: DailyVocabulary, DailyWordCard, DailyIdiomCard, IdiomCollection, IdiomGuidance, searchIdiomCatalog, DictionaryPagination } = await load("app/DailyVocabulary.tsx");
const { dailyIdioms } = await load("lib/daily-idioms.ts");
const { Onboarding, Review, Library } = await load("app/VocabularyApp.tsx");
const day = "2026-10-15", roleId = "finance-accounting";
const profile = { roleId, seniorityId: "experienced-contributor", situationIds: ["finance:month-end-close"], goalIds: ["clarify"] };
function fresh() { return web.prepareWebState({ version: 3, profile, settings: { timeZone: "Etc/UTC", dailyWordCount: 1 }, introducedWordIds: [], masteryByWordId: {}, dailySessions: [], favouriteIds: [], difficultIds: [], reviewedIds: [], completedDays: [], quizAttempts: [], usageAttempts: {} }); }
const render = (Component, props, locale = "ko") => renderToStaticMarkup(React.createElement(LearningLanguageProvider, { initialLocale: locale }, React.createElement(Component, props)));
const save = () => true;
const common = (state, date = day) => ({ state, day: date, profile, scopeKey: "device:synthetic-korean-ui", commit: save });
const ready = () => daily.ensureDailyVocabulary(fresh(), day, roleId);

test("language preference writes one device key and accepts only supported stored locales", () => {
  const records = new Map([["learner:synthetic-account", "unchanged private progress"]]); const operations = [];
  const storage = { getItem: key => records.get(key) ?? null, setItem: (key, value) => { operations.push([key, value]); records.set(key, value); } };
  assert.equal(LEARNING_LANGUAGE_KEY, "lucid.learning-language"); assert.equal(readLearningLanguage(storage), "en");
  saveLearningLanguage(storage, "ko"); assert.equal(readLearningLanguage(storage), "ko");
  saveLearningLanguage(storage, "en"); assert.equal(readLearningLanguage(storage), "en");
  records.set(LEARNING_LANGUAGE_KEY, "ja"); assert.equal(readLearningLanguage(storage), "en");
  assert.deepEqual(operations, [[LEARNING_LANGUAGE_KEY, "ko"], [LEARNING_LANGUAGE_KEY, "en"]]);
  assert.equal(records.get("learner:synthetic-account"), "unchanged private progress");
});

test("explicit learning-language URLs preserve navigation and ignore unsupported requested languages", () => {
  assert.equal(requestedLearningLanguage("http://localhost/?source=landing&lang=ko"), "ko");
  assert.equal(requestedLearningLanguage("http://localhost/?lang=en"), "en");
  assert.equal(requestedLearningLanguage("http://localhost/?lang=ja"), undefined);
  assert.equal(requestedLearningLanguage("http://localhost/?view=practice"), undefined);
  assert.equal(requestedLearningLanguage("invalid"), undefined);
  const target = urlForLearningLanguage("http://localhost/?source=landing&view=practice&lang=ko#saved", "en");
  const parsed = new URL(target, "http://localhost");
  assert.equal(parsed.pathname, "/"); assert.equal(parsed.searchParams.get("lang"), "en");
  assert.equal(parsed.searchParams.get("view"), "practice"); assert.equal(parsed.searchParams.get("source"), "landing"); assert.equal(parsed.hash, "#saved");
});

test("all declared web interface and onboarding keys have Korean copy; unknown keys visibly fall back", async () => {
  const keys = JSON.parse(await readFile(new URL("tests/fixtures/korean-web-required-keys.json", root), "utf8"));
  assert.ok(keys.length > 300);
  const missing = keys.filter(key => typeof copy.koreanLearningUI[key] !== "string" || !copy.koreanLearningUI[key].trim());
  assert.deepEqual(missing, []);
  assert.equal(locales.translateLearning("ko", "Untranslated source {count}", { count: 3 }), "Untranslated source 3");
  assert.equal(locales.translateLearning("en", "{count} of {total} explored", { count: 2, total: 5 }), "2 of 5 explored");
});

test("actual language choice exposes both accessible language names and honest Korean coverage", () => {
  const html = render(LearningLanguageChoice, {});
  assert.match(html, /lang="en" aria-pressed="false"[^>]*>English/);
  assert.match(html, /lang="ko" aria-pressed="true"[^>]*>한국어/);
  assert.ok(html.includes(locales.translateLearning("ko", "Learning language")));
  const coverage = render(LearningCoverageNote, {});
  assert.match(coverage, /lang="ko"/); assert.ok(coverage.includes("Express") || coverage.includes("표현 연습"));
  assert.equal(render(LearningCoverageNote, {}, "en"), "");
});

test("actual Korean onboarding translates the role choices and preserves the chosen course pace", () => {
  const props = { initialProfile: null, dailyWordCount: 1, onSave() { throw new Error("Rendering must not save a profile"); }, async onRecover() { return false; }, error: null };
  const html = render(Onboarding, props);
  assert.ok(html.includes(locales.translateLearning("ko", "Where do you use English most?")));
  assert.ok(html.includes(locales.translateLearning("ko", "Finance & Accounting")));
  assert.ok(html.includes(locales.translateLearning("ko", "Continue")));
  assert.match(html, /한국어/); assert.ok(html.includes("English"));
  assert.ok(render(Onboarding, props, "en").includes("Where do you use English most?"));
  assert.equal(props.dailyWordCount, 1);
});

test("actual daily overview translates distinct destinations without touching learner data", () => {
  const state = fresh(), bytes = JSON.stringify(state);
  const props = { ...common(state), dateLabel: "2026년 10월 15일 목요일", greeting: "Good morning.", dueCount: 0, navigate() { throw new Error("Rendering must not navigate"); }, children: React.createElement("section", { lang: "en" }, "English course content") };
  const korean = render(DailyVocabulary, props), english = render(DailyVocabulary, props, "en");
  for (const key of ["Today’s Words", "Today’s Idiom", "Review", "5 WORDS + 3 OPTIONAL", "ONE EXPRESSION", "Good morning."]) assert.ok(korean.includes(locales.translateLearning("ko", key)), key);
  assert.ok(english.includes("Today’s Words")); assert.ok(english.includes("Today’s Idiom"));
  assert.equal((korean.match(/class="daily-destination"/g) ?? []).length, 3);
  assert.equal(JSON.stringify(state), bytes); assert.equal(state.settings.dailyWordCount, 1);
  assert.equal(state.learningV3.dailyVocabulary, undefined);
});

test("Korean word support is hidden before reveal, then displayed alongside original English guidance", () => {
  let state = ready(); const word = daily.dailyWords(state, day, roleId)[0], support = locales.koreanWordSupport(word.id, roleId);
  assert.ok(support?.meaning); const props = { state, day, profile, word, index: 0, save };
  const hidden = render(DailyWordCard, props);
  assert.ok(hidden.includes(word.term)); assert.equal(hidden.includes(support.meaning), false); assert.equal(hidden.includes(word.example), false);
  state = daily.saveDailyWordDraft(state, day, roleId, word.id, "A synthetic private sentence before any guidance.");
  state = daily.revealDailyWord(state, day, roleId, word.id); const bytes = JSON.stringify(state);
  const revealed = render(DailyWordCard, { ...props, state });
  assert.ok(revealed.includes(support.meaning)); assert.ok(revealed.includes(support.usage)); assert.ok(revealed.includes(word.meaning)); assert.ok(revealed.includes(word.example));
  assert.match(revealed, /korean-learning-support" lang="ko"/); assert.match(revealed, /blockquote lang="en"/); assert.match(revealed, /readOnly=""/);
  assert.equal(JSON.stringify(state), bytes); assert.equal(ui.effortPoints(state), 0); assert.equal(daily.dailyWordIsInReview(state, roleId, word.id), false);
  assert.equal(render(DailyWordCard, { ...props, state }, "en").includes(support.meaning), false);
});

test("Korean idiom support appears after reveal with English idiom and example retained", () => {
  let state = ready(); const idiom = daily.dailyIdiom(state, day), support = locales.koreanIdiomSupport(idiom.id);
  assert.ok(support?.meaning); const props = { state, day, profile, idiom, save };
  const hidden = render(DailyIdiomCard, props); assert.ok(hidden.includes(idiom.phrase)); assert.equal(hidden.includes(support.meaning), false);
  state = daily.revealDailyIdiom(state, day, roleId, idiom.id); const bytes = JSON.stringify(state);
  const revealed = render(DailyIdiomCard, { ...props, state });
  for (const text of [support.meaning, support.register, support.context, support.plainEnglish, idiom.meaning, idiom.example]) assert.ok(revealed.includes(text), text);
  assert.match(revealed, /lang="en"/); assert.match(revealed, /lang="ko"/);
  assert.equal(JSON.stringify(state), bytes); assert.equal(ui.effortPoints(state), 0);
});

test("Korean Review instructions preserve the original-before-reveal guard and untouched evidence", () => {
  let state = ready(); const word = daily.dailyWords(state, day, roleId)[0], support = locales.koreanWordSupport(word.id, roleId);
  state = daily.revealDailyWord(state, day, roleId, word.id);
  state = daily.addDailyWordToReview(state, day, roleId, word.id);
  const tomorrow = "2026-10-16", before = JSON.stringify(state);
  const hidden = render(Review, common(state, tomorrow));
  assert.ok(hidden.includes(locales.translateLearning("ko", "Commit response and reveal guidance"))); assert.equal(hidden.includes(support.meaning), false);
  assert.equal(JSON.stringify(state), before);
  state = ui.captureReviewResponse(state, { roleId, contextRole: roleId, date: tomorrow, currentDay: tomorrow, wordId: word.id, response: `We can ${word.term} this fictional proposal before the next review.` });
  const bytes = JSON.stringify(state), revealed = render(Review, common(state, tomorrow));
  assert.ok(revealed.includes(support.meaning)); assert.match(revealed, /readOnly=""/);
  assert.equal(JSON.stringify(state), bytes); assert.equal(state.learningV3.reviewEvidence.length, 0); assert.equal(ui.effortPoints(state), 0);
});


test("all fourteen authored idioms are discoverable before onboarding without writing learner data", () => {
  const state = fresh(); state.profile = null; const before = JSON.stringify(state);
  const html = render(IdiomCollection, { ...common(state), profile: null, onBack() {}, onSetup() {}, commit() { throw new Error("Reference rendering must never write"); } });
  assert.match(html, /data-testid="idiom-collection"/);
  assert.equal((html.match(/class="idiom-catalog-entry"/g) ?? []).length, 14);
  for (const idiom of dailyIdioms) assert.ok(html.includes(idiom.phrase), idiom.id);
  assert.ok(html.includes(locales.translateLearning("ko", "Idiom collection")));
  assert.ok(html.includes(locales.translateLearning("ko", "Search idioms")));
  assert.ok(html.includes(locales.translateLearning("ko", "Set up my course")));
  assert.equal(JSON.stringify(state), before); assert.equal(state.learningV3.dailyVocabulary, undefined);
});

test("the onboarding preview and Today shortcut point learners to all idioms in Korean", () => {
  const props = { initialProfile: null, dailyWordCount: 1, onSave() {}, async onRecover() { return false; }, onExploreIdioms() {}, error: null };
  const onboarding = render(Onboarding, props);
  assert.ok(onboarding.includes(locales.translateLearning("ko", "Explore all {count} idioms", { count: 14 })));
  assert.ok(onboarding.includes(locales.translateLearning("ko", "Explore idioms before setting up your course.")));
  const state = ready(), before = JSON.stringify(state);
  const today = render(DailyVocabulary, { ...common(state), dateLabel: "2026년 10월 22일", greeting: "Good morning.", dueCount: 0, navigate() {}, children: React.createElement("section", null, "Existing course practice") });
  assert.ok(today.includes(locales.translateLearning("ko", "Explore all {count} idioms", { count: 14 })));
  assert.ok(today.includes("Existing course practice")); assert.equal(JSON.stringify(state), before);
});

test("English and Korean searches find canonical expressions without touching practice state", () => {
  assert.equal(searchIdiomCatalog("   ").length, 14);
  for (const idiom of dailyIdioms) {
    assert.ok(searchIdiomCatalog(idiom.phrase.toUpperCase()).some(entry => entry.id === idiom.id));
    const support = locales.koreanIdiomSupport(idiom.id);
    assert.ok(searchIdiomCatalog(support.meaning).some(entry => entry.id === idiom.id), idiom.id);
    assert.ok(searchIdiomCatalog(support.context).some(entry => entry.id === idiom.id), idiom.id);
  }
  assert.equal(searchIdiomCatalog("no-such-expression-9472").length, 0);
});

test("every idiom reference renders full Korean meaning and usage alongside original English examples", () => {
  for (const idiom of dailyIdioms) {
    const support = locales.koreanIdiomSupport(idiom.id), html = render(IdiomGuidance, { idiom });
    for (const text of [idiom.meaning, idiom.example, support.meaning, support.register, support.context, support.plainEnglish]) assert.ok(html.includes(renderToStaticMarkup(React.createElement("span", null, text)).slice(6, -7)), `${idiom.id}: ${text}`);
    assert.match(html, /blockquote lang="en"/); assert.match(html, /lang="ko"/);
  }
});

test("idiom navigation deep links retain Korean selection, origin context and existing route aliases", () => {
  const url = ui.urlForView("https://learnwithlucid.com/?lang=ko&source=landing#saved", "idioms");
  assert.equal(ui.viewFromURL(url), "idioms");
  const parsed = new URL(url, "https://learnwithlucid.com");
  assert.equal(parsed.searchParams.get("lang"), "ko"); assert.equal(parsed.searchParams.get("source"), "landing"); assert.equal(parsed.hash, "#saved");
  assert.equal(ui.viewFromURL("https://learnwithlucid.com/?view=review&lang=ko"), "practice");
  assert.equal(ui.viewFromURL("https://learnwithlucid.com/?view=unknown&lang=ko"), "today");
});


test("Library renders only twenty A–Z role entries and exposes accessible page totals", () => {
  const state=fresh(), before=JSON.stringify(state);
  const html=render(Library,{ profile,state,day,bookmark(){throw new Error("Rendering cannot bookmark");},expose(){throw new Error("Rendering cannot expose");} });
  assert.equal((html.match(/class="word-state"/g) ?? []).length,20);
  const headwords=[...html.matchAll(/<h2 lang="en">([^<]+)<\/h2>/g)].map(match=>match[1]);
  assert.equal(headwords.length,20);
  const collator=new Intl.Collator("en",{sensitivity:"base",ignorePunctuation:true});
  for(let index=1;index<headwords.length;index++) assert.ok(collator.compare(headwords[index-1],headwords[index])<=0,headwords.join(", "));
  assert.ok(html.includes(locales.translateLearning("ko","Vocabulary pages")));
  assert.ok(html.includes(locales.translateLearning("ko","A–Z · 20 per page")));
  assert.equal(JSON.stringify(state),before);
});

test("pagination controls announce page and total count with correct first/last/empty boundaries", () => {
  const renderPage=(page,totalPages,totalCount)=>render(DictionaryPagination,{page,totalPages,totalCount,label:"Vocabulary pages",onPageChange(){}});
  const first=renderPage(1,5,93), last=renderPage(5,5,93), empty=renderPage(1,1,0);
  assert.ok(first.includes(locales.translateLearning("ko","Page {page} of {pages} · {count} entries",{page:1,pages:5,count:93})));
  assert.match(first, /disabled="">이전<\/button>/); assert.doesNotMatch(first,/disabled="">다음<\/button>/);
  assert.match(last,/disabled="">다음<\/button>/);
  assert.equal((empty.match(/disabled=""/g)??[]).length,2);
});

test("the idiom catalog uses dictionary order and shares the 20-entry page contract", () => {
  const state=fresh();state.profile=null;
  const html=render(IdiomCollection,{...common(state),profile:null,onBack(){},onSetup(){}});
  const phrases=[...html.matchAll(/<strong lang="en">([^<]+)<\/strong>/g)].map(match=>match[1]);
  assert.equal(phrases.length,14);
  const collator=new Intl.Collator("en",{sensitivity:"base",ignorePunctuation:true});
  for(let index=1;index<phrases.length;index++) assert.ok(collator.compare(phrases[index-1],phrases[index])<=0,phrases.join(", "));
  assert.ok(html.includes(locales.translateLearning("ko","Page {page} of {pages} · {count} entries",{page:1,pages:1,count:14})));
});
