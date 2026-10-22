import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { spawnSync } from "node:child_process";
const root = new URL("../", import.meta.url), directory = await mkdtemp(join(tmpdir(), "lucid-daily-vocabulary-"));
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
const daily = await load("lib/daily-vocabulary.ts"), web = await load("lib/web-learning-state.ts"), ui = await load("lib/web-learning-ui.ts"), content = await load("lib/professional-content.ts"), shared = await load("lib/shared-learning-state.ts"), idioms = await load("lib/daily-idioms.ts");
const day = "2026-10-15", roleId = "finance-accounting";
const defaults = { version:3, profile:{roleId,seniorityId:"experienced-contributor",situationIds:["finance:variance-review"],goalIds:["clarify"]}, settings:{dailyWordCount:1,timeZone:"Etc/UTC",lessonTime:"09:00"},introducedWordIds:[],masteryByWordId:{},dailySessions:[],favouriteIds:[],difficultIds:[],reviewedIds:[],completedDays:[],quizAttempts:[],usageAttempts:{} };
const fresh = () => web.prepareWebState(defaults);
const prepare = () => daily.ensureDailyVocabulary(fresh(),day,roleId);
const reload = state => web.prepareWebState(JSON.parse(JSON.stringify(state)));

test("all eight roles select eight distinct active terms, preserve core words, and rotate deterministically", () => {
  for (const role of content.professionalRoles) {
    const state=fresh(); state.profile.roleId=role.id;
    const core=ui.makePlan(state,role.id,day);
    const ids=daily.selectDailyWordIds(day,role.id,core.wordIds);
    assert.equal(ids.length,8,role.id); assert.equal(new Set(ids).size,8);
    assert.ok(ids.every(id=>!core.wordIds.includes(id)));
    const words=ids.map(id=>ui.contextualWord(id,role.id));
    assert.equal(new Set(words.map(w=>w.term.trim().toLowerCase())).size,8);
    assert.ok(words.every(w=>w.learningMode === "active" && w.roles.includes(role.id)));
    assert.deepEqual(daily.selectDailyWordIds(day,role.id,core.wordIds),ids);
    assert.notDeepEqual(daily.selectDailyWordIds("2026-10-16",role.id,core.wordIds),ids);
  }
});
test("five words remain five across reload, optional three is explicit and idempotent, and daily course goal stays one",()=>{
  let state=prepare(); const pinned=daily.dailyCollection(state,day,roleId).wordIds;
  assert.equal(daily.dailyWords(state,day,roleId).length,5);
  state=reload(state); assert.equal(daily.dailyWords(state,day,roleId).length,5);
  state=daily.unlockDailyExtra(state,day,roleId);
  assert.equal(daily.dailyWords(state,day,roleId).length,8);
  assert.equal(daily.unlockDailyExtra(state,day,roleId),state);
  state=reload(state); assert.deepEqual(daily.dailyCollection(state,day,roleId).wordIds,pinned);
  assert.equal(state.settings.dailyWordCount,1);
  state.learningV3.rolePlans[`${day}:${roleId}`]={...ui.makePlan(state,roleId,day),wordIds:[pinned[0]]};
  assert.equal(daily.ensureDailyVocabulary(state,day,roleId),state,"same-day pin never reshuffles");
});
test("date boundaries use exact calendar days, leap days, negative ordinals and learner timezone",()=>{
  for(const date of ["2026-12-31","2027-01-01","2028-02-29","1969-12-31","0099-01-01"]) assert.equal(daily.selectDailyWordIds(date,roleId).length,8);
  for(const date of ["2026-02-29","2026-13-01","2026-10-15T00:00:00Z"]) assert.throws(()=>daily.selectDailyWordIds(date,roleId));
  assert.equal(ui.dayAt("Asia/Seoul",new Date("2026-10-15T23:30:00Z")),"2026-10-16");
  const next=daily.ensureDailyVocabulary(prepare(),"2026-10-16",roleId);
  assert.ok(daily.dailyCollection(next,day,roleId)); assert.ok(daily.dailyCollection(next,"2026-10-16",roleId));
});
test("reveal is exposure only; explicit review opt-in schedules tomorrow without recall, mastery, XP or course completion",()=>{
  let state=prepare(); const word=daily.dailyWords(state,day,roleId)[0]; const points=ui.effortPoints(state);
  assert.equal(daily.addDailyWordToReview(state,day,roleId,word.id),state,"cannot add unseen word through stale UI");
  state=daily.saveDailyWordDraft(state,day,roleId,word.id,"My private ungraded example.");
  state=daily.revealDailyWord(state,day,roleId,word.id);
  assert.equal(daily.saveDailyWordDraft(state,day,roleId,word.id,"Edited after guidance"),state);
  assert.equal(state.introducedWordIds.length,0); assert.equal(state.learningV3.reviewEvidence.length,0); assert.equal(ui.effortPoints(state),points);
  assert.equal(state.learningV3.exposedOn[`${word.id}::${roleId}`],day);
  state=reload(daily.addDailyWordToReview(state,day,roleId,word.id));
  const schedule=state.learningV3.contextMastery[`${word.id}::${roleId}`];
  assert.equal(schedule.nextReviewOn,"2026-10-16"); assert.equal(schedule.reviewCount,0); assert.equal(schedule.mastered,false);
  assert.equal(state.learningV3.reviewEvidence.length,0); assert.equal(ui.effortPoints(state),points); assert.equal(state.dailySessions.length,0);
  assert.equal(daily.addDailyWordToReview(state,day,roleId,word.id),state);
});
test("locked optional words, wrong roles, unprepared days and oversize drafts cannot mutate local learning",()=>{
  const state=prepare(), ids=daily.dailyCollection(state,day,roleId).wordIds;
  assert.equal(daily.revealDailyWord(state,day,roleId,ids[6]),state);
  assert.equal(daily.revealDailyWord(state,day,"technology-engineering",ids[0]),state);
  assert.equal(daily.revealDailyWord(state,"2026-10-16",roleId,ids[0]),state);
  assert.equal(daily.saveDailyWordDraft(state,day,roleId,ids[0],"x".repeat(2001)),state);
  assert.equal(daily.ensureDailyVocabulary(state,day,"technology-engineering"),state);
});
test("one global idiom survives role switching; reveal is separate from explicit spaced review opt-in",()=>{
  let state=prepare(); const idiom=daily.dailyIdiom(state,day);
  state=daily.revealDailyIdiom(state,day,roleId,idiom.id);
  assert.equal(daily.idiomPractice(state,day,idiom.id).originalResponse,"");
  assert.equal(daily.idiomReviewSchedule(state,idiom.id),undefined);
  state=reload(daily.addDailyIdiomToReview(state,day,roleId,idiom.id));
  assert.equal(daily.idiomReviewSchedule(state,idiom.id).nextReviewOn,"2026-10-16");
  state.profile.roleId="technology-engineering"; state=daily.ensureDailyVocabulary(state,day,"technology-engineering");
  assert.equal(daily.dailyIdiom(state,day).id,idiom.id);
  assert.equal(daily.reviewDailyIdiom(state,day,"technology-engineering",idiom.id,true),state,"introduction day never advances");
});
test("delayed idiom self-check freezes original, allows comparison, and advances only once without word credit",()=>{
  let state=prepare(); const idiom=daily.dailyIdiom(state,day);
  state=daily.addDailyIdiomToReview(daily.revealDailyIdiom(state,day,roleId,idiom.id),day,roleId,idiom.id);
  const next="2026-10-16";
  assert.ok(daily.dueIdiomReviews(state,next).some(i=>i.id===idiom.id));
  state=daily.saveDailyIdiomDraft(state,next,roleId,idiom.id,"My own recalled meaning before the explanation.");
  assert.equal(daily.reviewDailyIdiom(state,next,roleId,idiom.id,true),state,"must compare first");
  state=daily.revealDailyIdiom(state,next,roleId,idiom.id);
  assert.equal(daily.saveDailyIdiomDraft(state,next,roleId,idiom.id,"replacement"),state);
  state=reload(daily.reviewDailyIdiom(state,next,roleId,idiom.id,true));
  assert.equal(daily.idiomReviewSchedule(state,idiom.id).nextReviewOn,"2026-10-19");
  assert.equal(daily.idiomReviewSchedule(state,idiom.id).intervalIndex,1);
  assert.equal(daily.reviewDailyIdiom(state,next,roleId,idiom.id,true),state);
  assert.equal(state.learningV3.reviewEvidence.length,0); assert.deepEqual(state.masteryByWordId,{}); assert.equal(ui.effortPoints(state),0);
});
test("an empty original followed by guidance cannot become independent after retry and resets idiom interval",()=>{
  let state=prepare(); const idiom=daily.dailyIdiom(state,day);
  state=daily.addDailyIdiomToReview(daily.revealDailyIdiom(state,day,roleId,idiom.id),day,roleId,idiom.id);
  state.learningV3.dailyVocabulary.idiomReviews[idiom.id].intervalIndex=3;
  const next="2026-10-16"; state=daily.revealDailyIdiom(state,next,roleId,idiom.id);
  state=daily.saveDailyIdiomDraft(state,next,roleId,idiom.id,"Guided retry cannot rewrite empty original");
  state=daily.reviewDailyIdiom(state,next,roleId,idiom.id,true);
  assert.equal(daily.idiomReviewSchedule(state,idiom.id).intervalIndex,0);
  assert.equal(daily.idiomReviewSchedule(state,idiom.id).nextReviewOn,"2026-10-17");
});
test("daily sidecar is absent until used, strictly validated and fails safely for future/invalid records",()=>{
  assert.equal(fresh().learningV3.dailyVocabulary,undefined);
  const state=prepare(); assert.ok(web.validateWebState(state));
  for(const mutation of [s=>s.learningV3.dailyVocabulary.version=2,s=>s.learningV3.dailyVocabulary.collections[`${day}:${roleId}`].wordIds.push("duplicate"),s=>s.learningV3.dailyVocabulary.idiomsByDay["2026-02-30"]="same-page",s=>s.learningV3.dailyVocabulary.idiomPractice[`${day}:same-page`]={draft:"",revealed:true}]){
    const bad=structuredClone(state); mutation(bad); assert.equal(web.validateWebState(bad),false);
  }
});
test("ordinary cloud projections omit private daily work and pull preserves only current learner local work",()=>{
  let state=prepare(),word=daily.dailyWords(state,day,roleId)[0]; state=daily.saveDailyWordDraft(state,day,roleId,word.id,"PRIVATE DAILY PHRASE");
  assert.equal(web.toCloudWebState(state).learningV3.dailyVocabulary,undefined);
  assert.doesNotMatch(JSON.stringify(shared.webToSharedCloudState(state)),/PRIVATE DAILY PHRASE|dailyVocabulary/);
  const remote=daily.ensureDailyVocabulary(fresh(),"2026-10-17",roleId);
  assert.deepEqual(web.mergeWebStates(state,remote).learningV3.dailyVocabulary,state.learningV3.dailyVocabulary);
  assert.equal(web.mergeWebStates(fresh(),remote).learningV3.dailyVocabulary,undefined,"new guest/account cannot inherit remote private sidecar");
});
test("explicit portable backups retain daily pins, optional three, original attempts and safe schedules",()=>{
  let state=prepare(); state=daily.unlockDailyExtra(state,day,roleId);
  const word=daily.dailyWords(state,day,roleId)[6]; state=daily.saveDailyWordDraft(state,day,roleId,word.id,"Private manual backup example");
  const idiom=daily.dailyIdiom(state,day); state=daily.saveDailyIdiomDraft(state,day,roleId,idiom.id,"Original idiom meaning"); state=daily.revealDailyIdiom(state,day,roleId,idiom.id); state=daily.addDailyIdiomToReview(state,day,roleId,idiom.id);
  const backup=web.exportPortableBackup(state); assert.deepEqual(backup.learner.dailyVocabulary,state.learningV3.dailyVocabulary);
  const restored=web.importPortableBackup(backup,fresh(),defaults);
  assert.deepEqual(restored.learningV3.dailyVocabulary,state.learningV3.dailyVocabulary);
  const nativeOnly={version:2,learner:backup.learner};
  assert.deepEqual(web.importPortableBackup(nativeOnly,fresh(),defaults).learningV3.dailyVocabulary,state.learningV3.dailyVocabulary);
});

test("actual compiled native selection and idiom rotation match web across role, exclusion and calendar cases", {timeout:180000}, async()=>{
 const names=["Models","LearningPersistence","LearningStore","AccountService","LocalBackup","PracticeChallenges","ExpressionStudio","DailyVocabulary"];
 const paths=[];
 for(const name of names){const path=join(directory,name+".swift");await writeFile(path,await readFile(new URL(`ios/Lucid/Lucid/${name}.swift`,root)));paths.push(path);}
 const driver=join(directory,"NativeDaily.swift");await writeFile(driver,await readFile(new URL("tests/native-daily-vocabulary-tests.swift",root)));paths.push(driver);
 const binary=join(directory,"native-daily");
 const compile=spawnSync("xcrun",["swiftc","-parse-as-library","-module-cache-path",join(directory,"swift-cache"),...paths,"-o",binary],{encoding:"utf8",timeout:150000});
 assert.equal(compile.status,0,compile.stderr||compile.error?.message);
 const cases=content.professionalRoles.flatMap(role=>["2026-10-15","2026-12-31","2028-02-29","1969-12-31","0099-01-01"].flatMap(date=>[{day:date,roleId:role.id,excluded:[]},{day:date,roleId:role.id,excluded:daily.selectDailyWordIds(date,role.id).slice(0,3)}]));
 const run=spawnSync(binary,[new URL("ios/Lucid/Lucid/Resources/professional-content.json",root).pathname,"--parity"],{input:JSON.stringify(cases),encoding:"utf8",timeout:15000});
 assert.equal(run.status,0,run.stderr||run.error?.message);
 const actual=JSON.parse(run.stdout);assert.equal(actual.length,cases.length);
 for(const [i,input] of cases.entries()){
  assert.deepEqual(actual[i].wordIds,daily.selectDailyWordIds(input.day,input.roleId,input.excluded),JSON.stringify(input));
  assert.equal(actual[i].idiomId,daily.dailyIdiom(fresh(),input.day).id,JSON.stringify(input));
 }
});

test("existing sense evidence without an explicit introduction anchor keeps its earlier review history",()=>{
 let state=prepare(); const word=daily.dailyWords(state,day,roleId)[0];
 const evidence=web.makeReviewEvidence({wordId:word.id,roleId,date:"2026-09-01",kind:"unaided-recall",quality:2,independent:true,response:"This original example preserves existing valid recall history."});
 assert.ok(evidence);state.learningV3.reviewEvidence=[evidence];state=reload(state);
 const before=structuredClone(state.learningV3.contextMastery[`${word.id}::${roleId}`]);
 assert.equal(daily.dailyWordIsInReview(state,roleId,word.id),true);
 state=daily.revealDailyWord(state,day,roleId,word.id);
 assert.equal(daily.addDailyWordToReview(state,day,roleId,word.id),state);
 assert.deepEqual(reload(state).learningV3.contextMastery[`${word.id}::${roleId}`],before);
 assert.equal(state.learningV3.contextIntroducedOn[`${word.id}::${roleId}`],undefined);
});


test("catalog reference exposes only canonical idioms and leaves daily pinning, course history and points unchanged", () => {
  let state = prepare(); const initial = structuredClone(state), today = daily.dailyIdiom(state, day).id;
  const other = idioms.dailyIdioms.find(idiom => idiom.id !== today);
  assert.equal(daily.revealDailyIdiom(state, day, roleId, other.id), state, "daily eligibility stays narrow");
  assert.equal(daily.addCatalogIdiomToReview(state, day, roleId, other.id), state, "unseen reference cannot schedule review");
  state = daily.revealCatalogIdiom(state, day, roleId, other.id);
  assert.equal(daily.idiomPractice(state, day, other.id).originalResponse, "");
  assert.equal(daily.idiomPractice(state, day, other.id).revealed, true);
  assert.deepEqual(state.learningV3.dailyVocabulary.collections, initial.learningV3.dailyVocabulary.collections);
  assert.deepEqual(state.learningV3.dailyVocabulary.idiomsByDay, initial.learningV3.dailyVocabulary.idiomsByDay);
  assert.deepEqual(state.dailySessions, initial.dailySessions); assert.deepEqual(state.learningV3.reviewEvidence, []);
  assert.deepEqual(state.masteryByWordId, {}); assert.equal(ui.effortPoints(state), 0);
  assert.equal(daily.idiomReviewSchedule(state, other.id), undefined, "reading is not automatic opt-in");
  state = reload(daily.addCatalogIdiomToReview(state, day, roleId, other.id));
  assert.equal(daily.idiomReviewSchedule(state, other.id).nextReviewOn, "2026-10-16");
  assert.equal(daily.addCatalogIdiomToReview(state, day, roleId, other.id), state);
  assert.equal(daily.dailyIdiom(state, day).id, today);
  for (const id of ["unknown", "__proto__", "constructor"]) {
    assert.equal(daily.revealCatalogIdiom(state, day, roleId, id), state);
    assert.equal(daily.addCatalogIdiomToReview(state, day, roleId, id), state);
  }
  for (const date of ["2026-02-29", "not-a-day"]) assert.equal(daily.revealCatalogIdiom(state, date, roleId, other.id), state);
  assert.equal(daily.revealCatalogIdiom(state, day, "technology-engineering", other.id), state);
  const guest = { ...state, profile: null };
  assert.equal(daily.revealCatalogIdiom(guest, day, roleId, other.id), guest);
});

test("reference guidance freezes existing private originals and cannot turn an assisted due idiom into fresh recall", () => {
  let state = prepare(); const idiom = daily.dailyIdiom(state, day), next = "2026-10-16";
  state = daily.addCatalogIdiomToReview(daily.revealCatalogIdiom(state, day, roleId, idiom.id), day, roleId, idiom.id);
  const beforeSchedule = structuredClone(daily.idiomReviewSchedule(state, idiom.id));
  state = daily.revealCatalogIdiom(state, next, roleId, idiom.id);
  assert.equal(daily.idiomPractice(state, next, idiom.id).originalResponse, "");
  assert.equal(daily.saveDailyIdiomDraft(state, next, roleId, idiom.id, "Edited after reading the reference"), state);
  assert.deepEqual(daily.idiomReviewSchedule(state, idiom.id), beforeSchedule);
  state = daily.reviewDailyIdiom(state, next, roleId, idiom.id, true);
  assert.equal(daily.idiomReviewSchedule(state, idiom.id).intervalIndex, 0);
  assert.equal(daily.idiomReviewSchedule(state, idiom.id).nextReviewOn, "2026-10-17");
  assert.equal(ui.effortPoints(state), 0); assert.deepEqual(state.learningV3.reviewEvidence, []);

  let original = prepare();
  original = daily.saveDailyIdiomDraft(original, day, roleId, idiom.id, "My private original before any explanation.");
  original = daily.revealCatalogIdiom(original, day, roleId, idiom.id);
  assert.equal(daily.idiomPractice(original, day, idiom.id).originalResponse, "My private original before any explanation.");
  const frozen = structuredClone(daily.idiomPractice(original, day, idiom.id));
  assert.equal(daily.revealCatalogIdiom(original, day, roleId, idiom.id), original);
  assert.deepEqual(reload(original).learningV3.dailyVocabulary.idiomPractice[`${day}:${idiom.id}`], frozen);
});
