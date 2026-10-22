import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Load the real TSX modules and their shared React contexts. These are rendered
// component checks; browser effects and real keyboard/mobile journeys are not
// established by server rendering.
const root = new URL("../", import.meta.url);
const directory = await mkdtemp(join(tmpdir(), "lucid-guest-ui-"));
const modules = new Map();
after(() => rm(directory, { recursive: true, force: true }));
async function moduleURL(relative) {
  if (!modules.has(relative)) modules.set(relative, (async () => {
    const sourceURL = new URL(relative, root);
    let { outputText } = ts.transpileModule(await readFile(sourceURL, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }, fileName: relative,
    });
    const parsed = ts.createSourceFile(relative, outputText, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
    const edits = [];
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
    const path = join(directory, relative.replaceAll("/", "_") + ".mjs");
    await writeFile(path, outputText);
    return pathToFileURL(path).href;
  })());
  return modules.get(relative);
}
const load = async (relative) => import(await moduleURL(relative));
const guestUI = await load("app/GuestLearning.tsx");
const { GuestExploreStart, GuestSessionNotice, GuestAccountPrompt } = guestUI;
const { professionalRoles, professionalWords } = await load("lib/professional-content.ts");
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
const idle = () => {};
const escapedText = (value) => renderToStaticMarkup(React.createElement(React.Fragment, null, value));
const session = (changes = {}) => ({ active: true, cap: 5, used: 0, prompt: null, legacyAvailable: false, sessionImportAvailable: false, requestAccount: () => false, getGuestPrompt: () => null, canExploreItem: () => true, ...changes });

const { GuestAccessProvider } = guestUI;
const { LearningLanguageProvider } = await load("app/LearningLanguage.tsx");
const web = await load("lib/web-learning-state.ts");
const daily = await load("lib/daily-vocabulary.ts");
const { DailyWordCard, DailyIdiomCard } = await load("app/DailyVocabulary.tsx");
const { default: VocabularyApp } = await load("app/VocabularyApp.tsx");
// Controlled hooks supply identity/storage snapshots and a selected public view;
// all rendered app, dictionary and Daily component code remains the real TSX.
// The Daily handler capture invokes the actual button callback without a browser.
async function controlledModule(relative, replacements, filename) {
  const sourceURL = new URL(relative, root);
  let { outputText } = ts.transpileModule(await readFile(sourceURL, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }, fileName: relative });
  const parsed = ts.createSourceFile(relative, outputText, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS), edits = [];
  for (const statement of parsed.statements) {
    if (!(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) || !statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier, name = specifier.text;
    let url = replacements[name];
    if (!url && !name.startsWith(".")) url = import.meta.resolve(name);
    if (!url) {
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
  const path = join(directory, filename); await writeFile(path, outputText); return import(pathToFileURL(path).href);
}
const reactURL = import.meta.resolve("react");
const controlledAppReact = join(directory, "controlled-app-react.mjs");
await writeFile(controlledAppReact, `import * as React from ${JSON.stringify(reactURL)};
  export * from ${JSON.stringify(reactURL)};
  export function useState(initial) {
    const fixture=globalThis.__lucidGuestAppUI;
    const value=initial==='today' ? fixture.view : initial===false && ++fixture.falseStates===1 ? true : initial;
    return React.useState(value);
  }`);
const controlledSync = join(directory, "controlled-sync.mjs");
await writeFile(controlledSync, "export function useWebLearningState(){return globalThis.__lucidGuestAppUI.snapshot;}");
const { default: ControlledVocabularyApp } = await controlledModule("app/VocabularyApp.tsx", { react: pathToFileURL(controlledAppReact).href, "../lib/web-learning-sync": pathToFileURL(controlledSync).href }, "controlled-vocabulary-app.mjs");
const controlledDailyReact = join(directory, "controlled-daily-react.mjs");
await writeFile(controlledDailyReact, `import * as React from ${JSON.stringify(reactURL)};
  export * from ${JSON.stringify(reactURL)};
  export function useState(initial) {return initial==='overview' ? ['words',()=>{}] : initial==='' ? ['',()=>{}] : React.useState(initial);}`);
const controlledDailyJSX = join(directory, "controlled-daily-jsx.mjs");
const jsxURL = import.meta.resolve("react/jsx-runtime");
await writeFile(controlledDailyJSX, `import * as actual from ${JSON.stringify(jsxURL)};
  export const Fragment=actual.Fragment;
  function capture(type,props){if(type==='button'&&props.children==='Add 3 more words')globalThis.__lucidGuestDailyExtraClick=props.onClick;}
  export function jsx(type,props,...rest){capture(type,props);return actual.jsx(type,props,...rest);}
  export function jsxs(type,props,...rest){capture(type,props);return actual.jsxs(type,props,...rest);}`);
const { default: ControlledDailyVocabulary } = await controlledModule("app/DailyVocabulary.tsx", { react: pathToFileURL(controlledDailyReact).href, "react/jsx-runtime": pathToFileURL(controlledDailyJSX).href }, "controlled-daily-vocabulary.mjs");

// Only hooks/scheduling/DOM are controlled here. The prompt body, effects and
// actual JSX callbacks come from GuestLearning; this is not browser acceptance.
const controlledPromptReact = join(directory, "controlled-prompt-react.mjs");
await writeFile(controlledPromptReact, `export * from ${JSON.stringify(reactURL)};
  export function useRef(initial){const fixture=globalThis.__lucidGuestPromptUI;const index=fixture.refIndex++;return fixture.refs[index]??={current:initial};}
  export function useEffect(effect,deps){const fixture=globalThis.__lucidGuestPromptUI;fixture.effects.push({effect,deps,index:fixture.effectIndex++});}
  function memo(factory,deps){const fixture=globalThis.__lucidGuestPromptUI,index=fixture.memoIndex++,prior=fixture.memos[index];if(!prior||!deps||deps.some((value,i)=>!Object.is(value,prior.deps[i])))fixture.memos[index]={value:factory(),deps};return fixture.memos[index].value;}
  export function useCallback(callback,deps){return memo(()=>callback,deps);}
  export function useMemo(factory,deps){return memo(factory,deps);}`);
const { GuestAccountPrompt: ControlledGuestAccountPrompt } = await controlledModule("app/GuestLearning.tsx", { react: pathToFileURL(controlledPromptReact).href }, "controlled-guest-prompt.mjs");

const day = "2026-10-22", roleId = "finance-accounting";
const profile = { roleId, seniorityId: "experienced-contributor", situationIds: ["finance:month-end-close"], goalIds: ["clarify"] };

function checkPublicEntry(language) {
  let browses = 0, starts = 0, personalizations = 0;
  const html = render(GuestExploreStart, { language, onBrowse() { browses++; }, onStart() { starts++; }, onPersonalize() { personalizations++; } });
  assert.equal(browses + starts + personalizations, 0, "entry rendering never starts learning, account access or personalization implicitly");
  assert.match(html, /aria-labelledby="guest-explore-title"/);
  assert.match(html, /<label for="guest-role">/);
  assert.match(html, /<select id="guest-role">/);
  assert.equal((html.match(/<option /g) ?? []).length, professionalRoles.length);
  for (const role of professionalRoles) assert.ok(html.includes(`value="${role.id}"`), role.id);
  assert.doesNotMatch(html, /type="(?:email|password)"|required=""|aria-modal="true"|YOUR LEARNING PATH/);
  assert.doesNotMatch(html, /\$5|subscription|checkout|payment/i);
  return html;
}

test("public exploration presents word and idiom browsing plus one-step guest practice without an account form", () => {
  const html = checkPublicEntry("en");
  for (const label of ["Browse all words", "Explore idioms", "Try guest practice", "Personalize my course"]) assert.ok(html.includes(`>${label}</button>`), label);
  assert.match(html, /no sign-in needed/);
  assert.match(html, /Try up to 5 words or expressions in this tab’s temporary session/);
  assert.match(html, /Personalization is optional/);
});

test("Korean public exploration communicates that sign-in and personalization are optional", () => {
  const html = checkPublicEntry("ko");
  assert.match(html, /lang="ko"/);
  for (const label of ["모든 단어 둘러보기", "관용어 둘러보기", "게스트로 학습해 보기", "내 코스 맞춤 설정"]) assert.ok(html.includes(`>${label}</button>`), label);
  assert.match(html, /로그인은 필요하지 않아요/);
  assert.match(html, /단어나 표현을 최대 5개 체험/);
  assert.match(html, /맞춤 설정은 선택 사항/);
});

test("guest session notice uses the configured allowance and distinguishes temporary practice from account saving", () => {
  const html = render(GuestSessionNotice, { guest: session({ cap: 3, used: 2 }), onAccount: idle });
  assert.match(html, /aria-label="Temporary guest session"/);
  assert.match(html, /role="status">2 of 3 learning items tried/);
  assert.match(html, /this tab’s session/);
  assert.match(html, /Sign in to save words and progress to your account/);
  assert.match(html, /guest work is not transferred automatically/);
  assert.doesNotMatch(html, /Saved locally|Saved to your account|Download earlier local backup/);
  const initial = render(GuestSessionNotice, { guest: session(), onAccount: idle });
  assert.match(initial, /0 of 5 learning items tried/);
  const korean = render(GuestSessionNotice, { language: "ko", guest: session({ cap: 3, used: 2 }), onAccount: idle });
  assert.match(korean, /학습 항목 3개 중 2개 체험/);
  assert.match(korean, /현재 탭의 세션에만 임시로 보관/);
  assert.match(korean, /자동으로 옮겨지지 않습니다/);
});

test("legacy local backup remains an explicit separate action without claiming new guest data is durable", () => {
  let downloads = 0;
  const html = render(GuestSessionNotice, { guest: session({ legacyAvailable: true }), onAccount: idle, onLegacyBackup() { downloads++; } });
  assert.match(html, /Earlier learning is still on this device/);
  assert.match(html, /before choosing whether to import it into an account/);
  assert.match(html, />Download earlier local backup<\/button>/);
  assert.equal(downloads, 0, "rendering cannot export or import retained local records");
  assert.equal(render(GuestSessionNotice, { guest: session({ active: false }), onAccount: idle }), "");
  const retainedOnly = render(GuestSessionNotice, { guest: session({ active: false, legacyAvailable: true }), onAccount: idle, onLegacyBackup: idle });
  assert.match(retainedOnly, /Download earlier local backup/);
  assert.doesNotMatch(retainedOnly, /learning items tried|Practice stays in this tab/);
});

function checkPrompt(language, reason, cap) {
  let requests = 0, dismissals = 0;
  const html = render(GuestAccountPrompt, { language, reason, cap, onAccount() { requests++; }, onDismiss() { dismissals++; } });
  assert.equal(requests + dismissals, 0, "the prompt never initiates account access automatically");
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-labelledby="guest-account-prompt-title"/);
  assert.match(html, /aria-describedby="guest-account-prompt-description"/);
  assert.match(html, /tabindex="-1"/);
  assert.match(html, /id="guest-account-prompt-title"/);
  assert.match(html, /id="guest-account-prompt-description"/);
  assert.doesNotMatch(html, /aria-modal="true"|type="(?:email|password)"|disabled=""|\$5|checkout|subscription/i);
  return html;
}

test("save and practice-limit prompts explain different boundaries and keep browsing available", () => {
  const save = checkPrompt("en", "save", 5);
  assert.match(save, /Save it to your own account/);
  assert.match(save, /keep exploring without signing in/);
  assert.match(save, /review schedule or learning progress beyond this guest session/);
  const limit = checkPrompt("en", "limit", 3);
  assert.match(limit, /reached this session’s practice limit/);
  assert.match(limit, /includes 3 different learning items/);
  assert.match(limit, /Revisit those items or keep browsing the dictionaries/);
  for (const html of [save, limit]) {
    assert.match(html, />Keep browsing<\/button>/);
    assert.match(html, />Sign in or create an account<\/button>/);
    assert.match(html, /Existing local records stay separate/);
  }
  assert.equal(render(GuestAccountPrompt, { reason: null, cap: 5, onAccount: idle, onDismiss: idle }), "");
});

test("Korean saving and limit prompts preserve the same optional-account and retained-record distinction", () => {
  const save = checkPrompt("ko", "save", 5);
  assert.match(save, /내 계정에 저장하기/);
  assert.match(save, /로그인하지 않아도 계속 둘러볼 수/);
  const limit = checkPrompt("ko", "limit", 3);
  assert.match(limit, /이번 세션의 학습 체험 한도/);
  assert.match(limit, /학습 항목 3개를 체험/);
  assert.match(limit, /사전을 계속 둘러볼 수/);
  for (const html of [save, limit]) {
    assert.match(html, />계속 둘러보기<\/button>/);
    assert.match(html, />로그인 또는 계정 만들기<\/button>/);
    assert.match(html, /기존 기기 기록은 따로 보관/);
  }
});

function dailyState() {
  return daily.ensureDailyVocabulary(web.prepareWebState({ version: 3, profile, settings: { timeZone: "Etc/UTC", dailyWordCount: 1 }, introducedWordIds: [], masteryByWordId: {}, dailySessions: [], favouriteIds: [], difficultIds: [], reviewedIds: [], completedDays: [], quizAttempts: [], usageAttempts: {} }), day, roleId);
}
function guestCard(Component, props, language, accessChanges = {}) {
  let requests = 0, writes = 0;
  const access = session({ used: 1, requestAccount() { requests++; return false; }, ...accessChanges });
  const html = renderToStaticMarkup(React.createElement(LearningLanguageProvider, { initialLocale: language },
    React.createElement(GuestAccessProvider, { value: access }, React.createElement(Component, { ...props, save() { writes++; return true; } }))));
  assert.equal(requests + writes, 0, "rendering reference guidance neither saves progress nor starts sign-in");
  return html;
}

test("revealed guest word guidance remains available while durable review saving explicitly requires sign-in", () => {
  let state = dailyState(); const word = daily.dailyWords(state, day, roleId)[0];
  state = daily.saveDailyWordDraft(state, day, roleId, word.id, "A fictional guest response stays in this session.");
  state = daily.revealDailyWord(state, day, roleId, word.id);
  const props = { state, day, profile, word, index: 0 };
  const english = guestCard(DailyWordCard, props, "en");
  assert.ok(english.includes(escapedText(word.meaning))); assert.ok(english.includes(escapedText(word.example)));
  assert.match(english, /A fictional guest response stays in this session/);
  assert.match(english, /optional, session-only/);
  assert.match(english, />Sign in to save to review<\/button>/);
  assert.doesNotMatch(english, />In spaced review<\/button>|>Add to spaced review<\/button>|could not be saved|Retry this change/);
  const korean = guestCard(DailyWordCard, props, "ko");
  assert.match(korean, /세션에만 임시 보관/);
  assert.match(korean, />복습에 저장하려면 로그인<\/button>/);
  const account = render(DailyWordCard, { ...props, save: () => true });
  assert.match(account, />Add to spaced review<\/button>/);
  assert.doesNotMatch(account, /Sign in to save to review|session-only/);
});

test("guest idiom guidance and private session response remain visible without claiming the idiom was saved", () => {
  let state = dailyState(); const idiom = daily.dailyIdiom(state, day);
  state = daily.saveDailyIdiomDraft(state, day, roleId, idiom.id, "A fictional idiom response for temporary practice.");
  state = daily.revealDailyIdiom(state, day, roleId, idiom.id);
  const props = { state, day, profile, idiom };
  const english = guestCard(DailyIdiomCard, props, "en");
  for (const value of [idiom.meaning, idiom.example, idiom.register, idiom.context, idiom.plainEnglish]) assert.ok(english.includes(escapedText(value)), value);
  assert.match(english, /private, session-only/);
  assert.match(english, />Sign in to save this idiom<\/button>/);
  assert.doesNotMatch(english, />Add idiom to spaced review<\/button>|>Self-check saved<\/p>|could not be saved|Retry this change/);
  const korean = guestCard(DailyIdiomCard, props, "ko");
  assert.match(korean, /현재 세션에만 임시 보관/);
  assert.match(korean, />관용어를 저장하려면 로그인<\/button>/);
  const account = render(DailyIdiomCard, { ...props, save: () => true });
  assert.match(account, />Add idiom to spaced review<\/button>/);
  assert.doesNotMatch(account, /Sign in to save this idiom|session-only/);
});

function buttonFor(html, label) {
  const serialized = escapedText(label);
  const button = [...html.matchAll(/<button\b[^>]*>[^<]*<\/button>/g)].find(match => match[0].endsWith(`>${serialized}</button>`))?.[0];
  assert.ok(button, `Missing action: ${label}`);
  return button;
}

test("pending guest initialization disables practice changes while public dictionary browsing stays available", () => {
  const html = render(GuestExploreStart, { practiceReady: false, cap: 3, onBrowse: idle, onStart: idle, onPersonalize: idle });
  assert.match(html, /Try up to 3 words or expressions/);
  for (const label of ["Browse all words", "Explore idioms"]) assert.doesNotMatch(buttonFor(html, label), /\bdisabled(?:=|\s|>)/);
  for (const label of ["Preparing practice session…", "Personalize my course"]) assert.match(buttonFor(html, label), /\bdisabled=""/);
});

test("actual app renders public exploration before identity and profile preparation with account access collapsed", () => {
  const html = render(VocabularyApp, { initialDate: day, initialGreeting: "Good morning." });
  assert.match(html, /class="guest-explore-start"/);
  assert.match(html, /aria-label="Explore without an account"/);
  for (const label of ["Browse all words", "Explore idioms"]) assert.doesNotMatch(buttonFor(html, label), /\bdisabled(?:=|\s|>)/);
  const details = html.match(/<details\b[^>]*class="[^"]*account-access[^"]*"[^>]*>/)?.[0];
  assert.ok(details, "The optional account controls remain available in a details element");
  assert.doesNotMatch(details, /\bopen(?:=|\s|>)/);
  assert.match(html, /<summary>Account · sign-in and saving options<\/summary>/);
  const installDetails = html.match(/<details\b[^>]*class="pwa-install-optional"[^>]*>/)?.[0];
  assert.ok(installDetails, "App installation remains optional and collapsed during public exploration");
  assert.doesNotMatch(installDetails, /\bopen(?:=|\s|>)/);
  assert.match(html, /<summary>App installation · optional<\/summary>/);
  assert.equal((html.match(/>Install app<\/button>/g) ?? []).length, 1, "the existing PWA component and install action remain in the rendered app");
  assert.equal((html.match(/aria-label="Lucid app installation"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /class="loading-screen"|YOUR LEARNING PATH ·|Where do you use English most\?/);
});

function textareaFor(html, id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const textarea = html.match(new RegExp(`<textarea\\b[^>]*id="${escaped}"[^>]*>`))?.[0];
  assert.ok(textarea, `Missing practice draft: ${id}`);
  return textarea;
}

test("a full guest allowance makes an unadmitted word draft read-only while an admitted word stays editable", () => {
  const state = dailyState(), word = daily.dailyWords(state, day, roleId)[0];
  const props = { state, day, profile, word, index: 0 };
  const deniedKeys = [];
  const denied = guestCard(DailyWordCard, props, "en", { used: 5, canExploreItem(key) { deniedKeys.push(key); return false; } });
  assert.match(textareaFor(denied, `daily-word-draft-${word.id}`), /\breadOnly=""/i);
  assert.deepEqual([...new Set(deniedKeys)], [`word:${word.id}`]);
  assert.ok(!denied.includes(escapedText(word.meaning)), "a blocked new practice card does not reveal its answer by rendering");
  assert.doesNotMatch(denied, /could not be saved|Retry this change/);
  const retained = daily.saveDailyWordDraft(state, day, roleId, word.id, "An already admitted fictional word draft.");
  const allowed = guestCard(DailyWordCard, { ...props, state: retained }, "en", { used: 5, canExploreItem: key => key === `word:${word.id}` });
  assert.doesNotMatch(textareaFor(allowed, `daily-word-draft-${word.id}`), /\breadOnly(?:=|\s|>)/i);
  assert.match(allowed, /An already admitted fictional word draft/);
});

test("a full guest allowance makes an unadmitted idiom draft read-only while an admitted idiom stays editable", () => {
  const state = dailyState(), idiom = daily.dailyIdiom(state, day);
  const props = { state, day, profile, idiom };
  const deniedKeys = [];
  const denied = guestCard(DailyIdiomCard, props, "ko", { used: 5, canExploreItem(key) { deniedKeys.push(key); return false; } });
  assert.match(textareaFor(denied, `daily-idiom-draft-${idiom.id}`), /\breadOnly=""/i);
  assert.deepEqual([...new Set(deniedKeys)], [`idiom:${idiom.id}`]);
  assert.ok(!denied.includes(escapedText(idiom.meaning)), "a blocked new idiom does not reveal its answer by rendering");
  assert.doesNotMatch(denied, /could not be saved|Retry this change/);
  const retained = daily.saveDailyIdiomDraft(state, day, roleId, idiom.id, "An already admitted fictional idiom draft.");
  const allowed = guestCard(DailyIdiomCard, { ...props, state: retained }, "ko", { used: 5, canExploreItem: key => key === `idiom:${idiom.id}` });
  assert.doesNotMatch(textareaFor(allowed, `daily-idiom-draft-${idiom.id}`), /\breadOnly(?:=|\s|>)/i);
  assert.match(allowed, /An already admitted fictional idiom draft/);
});

function referenceFixture(view, { ready = true, status = "error", scopeKey = "supabase:11111111-1111-4111-8111-111111111111" } = {}) {
  const state = dailyState();
  state.favouriteIds = professionalWords.map(word => word.id);
  state.learningV3.practiceDrafts = { [professionalWords[0].id]: "PRIVATE_SYNTHETIC_CACHED_RESPONSE" };
  const original = JSON.stringify(state);
  let retries = 0, commits = 0, accountRequests = 0;
  const snapshot = {
    state, ready, status, error: status === "error" ? "Synthetic storage failure; original records remain untouched." : null,
    scopeKey,
    commit() { commits++; return false; }, retrySync() { retries++; return Promise.resolve(); },
    recoverFromBackup: async () => false, suspendForAccountChange: async () => {}, refreshIdentity: async () => {}, importLegacyProgress: async () => false,
    guest: { active: scopeKey.startsWith("device:"), cap: 5, used: 0, prompt: null, legacyAvailable: false, sessionImportAvailable: false },
    requestAccount() { accountRequests++; return false; }, dismissGuestPrompt: idle, getGuestPrompt: () => null, canExploreItem: () => false,
    importGuestSession: async () => false, legacyGuestBackup: () => null,
  };
  globalThis.__lucidGuestAppUI = { view, falseStates: 0, snapshot };
  try {
    const html = render(ControlledVocabularyApp, { initialDate: day, initialGreeting: "Good morning." });
    assert.equal(JSON.stringify(state), original, "rendering the reference-only fallback never changes the retained cache");
    assert.equal(retries + commits + accountRequests, 0, "reference rendering initiates no account changes, retry or save");
    return html;
  } finally { delete globalThis.__lucidGuestAppUI; }
}
function inputFor(html, id) {
  const input = [...html.matchAll(/<input\b[^>]*>/g)].find(match => match[0].includes(`id="${id}"`))?.[0];
  assert.ok(input, `Missing search control: ${id}`); return input;
}
function assertReferenceBrowsing(html, view) {
  assert.match(html, /guest-public-shell/);
  assert.match(html, /aria-label="Explore without an account"/);
  for (const label of ["Explore", "Word dictionary", "Idioms"]) assert.doesNotMatch(buttonFor(html, label), /\bdisabled(?:=|\s|>)/);
  assert.doesNotMatch(html, /PRIVATE_SYNTHETIC_CACHED_RESPONSE|YOUR LEARNING PATH ·|class="loading-screen"/);
  if (view === "library") {
    assert.doesNotMatch(inputFor(html, "library-search"), /\bdisabled(?:=|\s|>)/);
    assert.equal((html.match(/<h2 lang="en">/g) ?? []).length, 20);
    assert.doesNotMatch(html, /<button\b[^>]*class="bookmark-button"[^>]*aria-pressed="true"/);
    assert.doesNotMatch(buttonFor(html, "Next"), /\bdisabled(?:=|\s|>)/);
    assert.match(html, /A–Z · 20 per page/);
  } else if (view === "idioms") {
    assert.doesNotMatch(inputFor(html, "idiom-search"), /\bdisabled(?:=|\s|>)/);
    const entries = [...html.matchAll(/<button\b[^>]*class="idiom-catalog-entry"[^>]*>/g)].map(match => match[0]);
    assert.equal(entries.length, 14);
    for (const entry of entries) assert.doesNotMatch(entry, /\bdisabled(?:=|\s|>)/);
    assert.match(html, /Page 1 of 1 · 14 entries/);
  }
}

test("a hydrated storage error with an earlier profile keeps dictionaries public and blank while exposing a repair action", () => {
  for (const view of ["today", "library", "idioms"]) {
    const html = referenceFixture(view);
    assertReferenceBrowsing(html, view);
    assert.match(html, /role="alert"/);
    assert.match(html, /Learning storage needs attention/);
    assert.match(html, /Practice and saving are paused; existing records are kept/);
    assert.doesNotMatch(buttonFor(html, "Retry learning storage"), /\bdisabled(?:=|\s|>)/);
    assert.match(inputFor(html, "recovery-file"), /type="file"/);
    const recovery = html.match(/<details\b[^>]*class="onboarding-backup"[^>]*>/)?.[0];
    assert.ok(recovery, "verified-account recovery remains an explicit collapsed action");
    assert.doesNotMatch(recovery, /\bopen(?:=|\s|>)/);
    assert.match(html, /damaged local record is archived before replacement/);
    const install = html.match(/<details\b[^>]*class="pwa-install-optional"[^>]*>/)?.[0];
    assert.ok(install, "reference browsing keeps installation collapsed even when the retained cache has a profile");
    assert.doesNotMatch(install, /\bopen(?:=|\s|>)/);
    if (view === "today") {
      assert.match(buttonFor(html, "Preparing practice session…"), /\bdisabled=""/);
      assert.match(buttonFor(html, "Personalize my course"), /\bdisabled=""/);
    }
  }
});

test("pending identity with an earlier cached profile still renders blank public word and idiom browsing", () => {
  for (const view of ["today", "library", "idioms"]) {
    const html = referenceFixture(view, { ready: false, status: "loading" });
    assertReferenceBrowsing(html, view);
    assert.doesNotMatch(html, /Learning storage needs attention/);
    if (view === "today") assert.match(buttonFor(html, "Preparing practice session…"), /\bdisabled=""/);
  }
});

test("the actual guest Add 3 more words callback allocates choices without requiring account access or spending the practice allowance", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse(`${day}T12:00:00.000Z`) });
  let state = dailyState(), commits = 0, accountRequests = 0;
  const access = session({ used: 0, requestAccount() { accountRequests++; return false; } });
  globalThis.__lucidGuestDailyExtraClick = null;
  try {
    const html = renderToStaticMarkup(React.createElement(GuestAccessProvider, { value: access }, React.createElement(ControlledDailyVocabulary, {
      state, day, profile, scopeKey: "device:guest-allocation-fixture", dateLabel: "Thursday", greeting: "Good morning.", dueCount: 0, navigate: idle,
      commit(mutate) { commits++; state = typeof mutate === "function" ? mutate(state) : mutate; return true; },
    })));
    assert.doesNotMatch(buttonFor(html, "Add 3 more words"), /\bdisabled(?:=|\s|>)/);
    assert.equal(accountRequests + commits, 0, "opening the allocation screen does not save or request an account");
    const onClick = globalThis.__lucidGuestDailyExtraClick;
    assert.equal(typeof onClick, "function", "the handler comes from the actual rendered Daily component");
    onClick();
    assert.equal(commits, 1); assert.equal(accountRequests, 0);
    assert.equal(daily.dailyCollection(state, day, roleId).extraUnlocked, true);
    assert.equal(daily.dailyWords(state, day, roleId).length, 8);
    assert.equal(access.used, 0);
    assert.deepEqual(daily.dailyCollection(state, day, roleId).revealedWordIds, []);
    assert.equal(Boolean(daily.idiomPractice(state, day, daily.dailyIdiom(state, day).id)?.revealed), false);
  } finally { delete globalThis.__lucidGuestDailyExtraClick; }
});

test("guest and unidentified storage errors expose public browsing without an account recovery upload", () => {
  for (const scopeKey of ["pending", "device:synthetic-guest-ui"]) {
    const html = referenceFixture("library", { scopeKey });
    assertReferenceBrowsing(html, "library");
    assert.match(html, /Learning storage needs attention/);
    assert.doesNotMatch(html, /id="recovery-file"|Check and restore backup/);
  }
});

// A minimal DOM/scheduler models only the selectors and focus calls used by the
// real prompt. It cannot establish browser event ordering or screen-reader UX;
// the release's real Chrome check is the separate acceptance verification.
function promptFocusFixture({ originTag = "textarea", readonly = true, adjacent = "button" } = {}) {
  const names = ["document", "window", "HTMLElement", "requestAnimationFrame", "cancelAnimationFrame", "__lucidGuestPromptUI"];
  const originals = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const frames = new Map(), cancelled = [], listeners = new Set(), focused = [];
  let nextFrame = 0, dismissals = 0, reopenings = 0;
  const document = {
    activeElement: null,
    addEventListener(type, callback) { assert.equal(type, "keydown"); listeners.add(callback); },
    removeEventListener(type, callback) { assert.equal(type, "keydown"); listeners.delete(callback); },
  };
  class Element {
    constructor(tag, { disabled = false, readOnly = false } = {}) { this.tagName = tag.toUpperCase(); this.disabled = disabled; this.readOnly = readOnly; this.isConnected = true; this.children = []; this.parentElement = null; this.focusCount = 0; }
    append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } return this; }
    get nextElementSibling() { return this.parentElement?.children[this.parentElement.children.indexOf(this) + 1] ?? null; }
    matches(selector) {
      return selector.split(",").some(part => {
        const query = part.trim(), tag = query.match(/^[a-z]+/i)?.[0];
        if (tag && this.tagName !== tag.toUpperCase()) return false;
        if (query.includes("[readonly]") && !this.readOnly) return false;
        if ((query.includes(":not(:disabled)") || query.includes(":not([disabled])")) && this.disabled) return false;
        if (query.includes("[href]") && !this.href) return false;
        return true;
      });
    }
    closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) ?? null; }
    querySelector(selector) { for (const child of this.children) { if (child.matches(selector)) return child; const nested = child.querySelector(selector); if (nested) return nested; } return null; }
    contains(element) { return this === element || this.children.some(child => child.contains(element)); }
    focus() { if (this.disabled || !this.isConnected) return; this.focusCount++; focused.push(this); document.activeElement = this; this.onFocus?.(); }
  }
  const panel = new Element("section"), origin = new Element(originTag, { readOnly: readonly });
  origin.onFocus = () => { if (readonly) reopenings++; };
  const safe = new Element("button"), disabled = new Element("button", { disabled: true });
  const outside = new Element("button"), main = new Element("main"), article = new Element("article");
  if (adjacent === "button") article.append(disabled, origin, safe);
  else if (adjacent === "controls") article.append(origin, new Element("div").append(disabled, safe));
  else article.append(disabled, safe, origin, new Element("div"));
  main.append(outside, article);
  document.activeElement = origin;
  const window = {
    requestAnimationFrame(callback) { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { cancelled.push(id); frames.delete(id); },
  };
  const hooks = { refs: [], effects: [], records: [], memos: [], refIndex: 0, effectIndex: 0, memoIndex: 0 };
  Object.assign(globalThis, { document, window, HTMLElement: Element, requestAnimationFrame: window.requestAnimationFrame, cancelAnimationFrame: window.cancelAnimationFrame, __lucidGuestPromptUI: hooks });
  const props = { language: "en", reason: "limit", cap: 5, onAccount: idle, onDismiss() { dismissals++; } };
  let tree, unmounted = false;
  function mount(changes = {}) {
    Object.assign(props, changes); hooks.refIndex = 0; hooks.effectIndex = 0; hooks.memoIndex = 0; hooks.effects = [];
    tree = ControlledGuestAccountPrompt(props);
    if (tree) tree.props.ref.current = panel;
    for (const { effect, deps, index } of hooks.effects) {
      const prior = hooks.records[index];
      if (prior && deps && deps.length === prior.deps?.length && deps.every((value, i) => Object.is(value, prior.deps[i]))) continue;
      prior?.cleanup?.(); hooks.records[index] = { deps, cleanup: effect() };
    }
    return tree;
  }
  function findButton(node, label) {
    if (!node || typeof node !== "object") return null;
    if (node.type === "button" && node.props.children === label) return node;
    for (const child of React.Children.toArray(node.props?.children)) { const found = findButton(child, label); if (found) return found; }
    return null;
  }
  function unmount() { if (unmounted) return; unmounted = true; for (const record of hooks.records) record?.cleanup?.(); }
  return {
    origin, safe, disabled, outside, panel, document, frames, cancelled, listeners, focused,
    get dismissals() { return dismissals; }, get reopenings() { return reopenings; },
    mount,
    flushFrame() { const pending = [...frames]; frames.clear(); for (const [, callback] of pending) callback(1); },
    escape(key = "Escape") { for (const listener of [...listeners]) listener({ key }); },
    keepBrowsing() { const button = findButton(tree, "Keep browsing"); assert.equal(typeof button?.props.onClick, "function", "invoke the actual prompt JSX callback"); button.props.onClick(); },
    unmount,
    close() { unmount(); for (const [name, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; } },
  };
}

test("the actual guest prompt defers focus until after the triggering field's default focus", () => {
  const fixture = promptFocusFixture();
  try {
    fixture.mount();
    assert.equal(fixture.frames.size, 1);
    assert.equal(fixture.panel.focusCount, 0, "the effect cannot immediately race the browser's remaining focus action");
    fixture.origin.focus(); // Model the browser completing the original click.
    assert.equal(fixture.document.activeElement, fixture.origin);
    fixture.flushFrame();
    assert.equal(fixture.document.activeElement, fixture.panel);
    assert.equal(fixture.panel.focusCount, 1);
    assert.equal(fixture.dismissals, 0);
  } finally { fixture.close(); }
});

test("the actual guest prompt cancels pending focus on unmount and when its reason changes", () => {
  const unmounted = promptFocusFixture();
  try {
    unmounted.mount(); const frame = [...unmounted.frames.keys()][0];
    unmounted.unmount();
    assert.ok(unmounted.cancelled.includes(frame));
    assert.equal(unmounted.frames.size, 0); assert.equal(unmounted.listeners.size, 0);
    unmounted.flushFrame(); assert.equal(unmounted.panel.focusCount, 0);
  } finally { unmounted.close(); }
  const changed = promptFocusFixture();
  try {
    changed.mount(); const first = [...changed.frames.keys()][0];
    changed.mount({ reason: "save" });
    assert.ok(changed.cancelled.includes(first)); assert.equal(changed.frames.size, 1);
    changed.flushFrame(); assert.equal(changed.panel.focusCount, 1);
    changed.mount({ reason: "limit" }); // Active panel must not replace the original return target.
    changed.flushFrame(); assert.equal(changed.panel.focusCount, 2);
    assert.equal(changed.listeners.size, 1);
    changed.keepBrowsing();
    assert.equal(changed.dismissals, 1); assert.equal(changed.document.activeElement, changed.safe);
    assert.equal(changed.origin.focusCount, 0); assert.equal(changed.reopenings, 0);
  } finally { changed.close(); }
});

test("Escape and the actual Keep browsing action dismiss once and avoid refocusing readonly guest-limit origins", () => {
  for (const originTag of ["textarea", "input"]) for (const action of ["escape", "keepBrowsing"]) for (const adjacent of ["button", "controls", "none"]) {
    const fixture = promptFocusFixture({ originTag, adjacent });
    try {
      fixture.mount(); fixture.flushFrame();
      fixture.escape("Enter"); assert.equal(fixture.dismissals, 0, "unrelated keyboard input does not close the prompt");
      fixture[action]();
      assert.equal(fixture.dismissals, 1, `${originTag}/${action}/${adjacent}`);
      assert.equal(fixture.document.activeElement, fixture.safe);
      assert.equal(fixture.safe.focusCount, 1); assert.equal(fixture.disabled.focusCount, 0); assert.equal(fixture.outside.focusCount, 0);
      assert.equal(fixture.origin.focusCount, 0); assert.equal(fixture.reopenings, 0, "the readonly onFocus boundary is never retriggered by dismissal");
      assert.equal(fixture.frames.size, 0);
    } finally { fixture.close(); }
  }
});

test("ordinary button origins restore normally and dismissing before the frame cannot steal focus back", () => {
  for (const action of ["escape", "keepBrowsing"]) {
    const fixture = promptFocusFixture({ originTag: "button", readonly: false });
    try {
      fixture.mount(); const pending = [...fixture.frames.keys()][0];
      fixture[action]();
      assert.equal(fixture.dismissals, 1); assert.ok(fixture.cancelled.includes(pending));
      assert.equal(fixture.document.activeElement, fixture.origin); assert.equal(fixture.origin.focusCount, 1);
      fixture.flushFrame();
      assert.equal(fixture.panel.focusCount, 0); assert.equal(fixture.document.activeElement, fixture.origin);
      assert.equal(fixture.safe.focusCount, 0);
    } finally { fixture.close(); }
  }
});
