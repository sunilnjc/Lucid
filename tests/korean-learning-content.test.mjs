import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = new URL("../", import.meta.url), directory = await mkdtemp(join(tmpdir(), "lucid-korean-content-"));
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
const locale=await load("lib/learning-locales.ts"), copy=await load("lib/learning-locale-copy.ts"), canonical=await load("lib/professional-content.ts"), idioms=await load("lib/daily-idioms.ts");
const placeholders = s => [...new Set(s.match(/\{[a-zA-Z0-9_]+\}/g)??[])].sort();

test("learning locale registry offers only English and Korean with safe default and unknown fallback",()=>{
 assert.deepEqual(locale.learningLocaleRegistry.map(x=>x.locale),["en","ko"]);
 for(const value of [undefined,null,"en","ja","zh-CN","ko-KR","__proto__"])assert.equal(locale.resolveLearningLocale(value),"en");
 assert.equal(locale.resolveLearningLocale("ko"),"ko");
 assert.equal(locale.LEARNING_LANGUAGE_STORAGE_KEY,"lucid.learning-language");
});
test("all731role senses across472canonical entries have original Korean meaning and usage, no missing or extra IDs",()=>{
 let count=0;const seen=new Set();
 assert.deepEqual(Object.keys(locale.koreanWords).sort(),canonical.professionalRoles.map(r=>r.id).sort());
 for(const role of canonical.professionalRoles){
  const words=canonical.professionalWords.filter(w=>w.roles.includes(role.id));
  assert.deepEqual(Object.keys(locale.koreanWords[role.id]).sort(),words.map(w=>w.id).sort());
  for(const word of words){const support=locale.koreanWordSupport(word.id,role.id);assert.ok(support);for(const key of ["meaning","usage"]){assert.match(support[key],/[가-힣]/,`${role.id}/${word.id}/${key}`);assert.doesNotMatch(support[key],/TODO|TBD|not translated|번역 예정/);assert.ok(support[key].trim().length>4);}count++;seen.add(word.id);}
 }
 assert.equal(count,731);assert.equal(seen.size,472);
 assert.equal(locale.koreanWordSupport("__proto__","__proto__"),undefined);
 assert.equal(locale.koreanWordSupport("missing","finance-accounting"),undefined);
});
test("all14idioms have Korean meaning register context alternative and matching cautions while English stays canonical",()=>{
 assert.deepEqual(Object.keys(locale.learningLocalizationPayload.koreanIdioms).sort(),idioms.dailyIdioms.map(i=>i.id).sort());
 for(const idiom of idioms.dailyIdioms){const support=locale.koreanIdiomSupport(idiom.id);for(const key of ["meaning","register","context","plainEnglish"])assert.match(support[key],/[가-힣]/);assert.equal(!!support.avoid,!!idiom.avoid);assert.match(idiom.example,/[a-zA-Z]/);assert.match(idiom.phrase,/[a-zA-Z]/);}
 assert.equal(locale.koreanIdiomSupport("__proto__"),undefined);
});
test("every Korean UI entry preserves its source template parameters and has nonempty copy",()=>{
 for(const [key,value]of Object.entries(copy.koreanLearningUI)){assert.ok(value.trim(),key);assert.deepEqual(placeholders(value),placeholders(key),key);}
 assert.ok(Object.keys(copy.koreanLearningUI).length>=590);
 assert.equal(locale.translateLearning("en","Today’s Words"),"Today’s Words");
 assert.notEqual(locale.translateLearning("ko","Today’s Words"),"Today’s Words");
 assert.equal(locale.translateLearning("ko","Missing untranslated English key"),"Missing untranslated English key");
 assert.equal(locale.translateLearning("ko","__proto__"),"__proto__");
 const dynamic=locale.translateLearning("ko","{count}/{total} explored",{count:3,total:8});assert.ok(dynamic.includes("3")&&dynamic.includes("8"));assert.doesNotMatch(dynamic,/\{count\}/);
});
test("malformed or empty Korean templates fall back to source English without unresolved substitution",()=>{
 const key="Synthetic fixture {count}";
 try{copy.koreanLearningUI[key]="잘못된 템플릿";assert.equal(locale.translateLearning("ko",key,{count:4}),"Synthetic fixture 4");copy.koreanLearningUI[key]="";assert.equal(locale.translateLearning("ko",key,{count:5}),"Synthetic fixture 5");}finally{delete copy.koreanLearningUI[key];}
});
test("all native literal localization keys and all declared web keys are covered",async()=>{
 const swiftFiles=["RootView","DailyVocabularyViews","SecondaryViews","LucidApp","ExperienceViews","SettingsView"];
 for(const file of swiftFiles){const source=await readFile(new URL(`ios/Lucid/Lucid/${file}.swift`,root),"utf8");for(const match of source.matchAll(/learning(?:Text|Format)\(\s*("(?:[^"\\]|\\.)*")/g)){const key=JSON.parse(match[1]);assert.ok(Object.hasOwn(copy.koreanLearningUI,key),`${file}: ${key}`);}}
 const webKeys=JSON.parse(await readFile(new URL("tests/fixtures/korean-web-required-keys.json",root),"utf8"));
 for(const key of webKeys)assert.ok(Object.hasOwn(copy.koreanLearningUI,key),`Web: ${key}`);
});
test("native JSON is byte-for-content parity with canonical shared Korean support",async()=>{
 const resource=JSON.parse(await readFile(new URL("ios/Lucid/Lucid/Resources/learning-locales.json",root),"utf8"));assert.deepEqual(resource,locale.learningLocalizationPayload);
});
