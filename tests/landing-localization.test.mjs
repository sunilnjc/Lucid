import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = new URL("../", import.meta.url), directory = await mkdtemp(join(tmpdir(), "lucid-landing-tests-")), modules = new Map();
after(() => rm(directory, { recursive: true, force: true }));
async function moduleURL(relative) {
  if (!modules.has(relative)) modules.set(relative, (async () => {
    const sourceURL = new URL(relative, root);
    let { outputText } = ts.transpileModule(await readFile(sourceURL, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }, fileName: relative });
    const parsed = ts.createSourceFile(relative, outputText, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS), edits = [];
    for (const statement of parsed.statements) {
      if (!(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) || !statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const specifier = statement.moduleSpecifier, name = specifier.text;
      if (name.endsWith(".css")) { edits.push({ start: statement.getStart(parsed), end: statement.end, value: "" }); continue; }
      let url;
      if (name === "next/navigation") url = `data:text/javascript;base64,${Buffer.from('export function redirect(path) { const error = new Error("redirect"); error.destination = path; throw error; }').toString("base64")}`;
      else if (!name.startsWith(".")) url = import.meta.resolve(name);
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
    const file = join(directory, relative.replaceAll("/", "_") + ".mjs"); await writeFile(file, outputText); return pathToFileURL(file).href;
  })());
  return modules.get(relative);
}
const load = async (relative) => import(await moduleURL(relative));
const locales = await load("lib/landing-locales.ts"), { default: LandingPage } = await load("app/landing/LandingPage.tsx"), expressions = await load("lib/expression-content.ts");
const html = (locale) => renderToStaticMarkup(React.createElement(LandingPage, { locale }));
function shape(value) {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shape(item)]));
  assert.equal(typeof value, "string"); assert.ok(value.trim().length > 0); return "string";
}

test("Korean resources are complete and untranslated planned languages fall back to real English", () => {
  assert.deepEqual(shape(locales.landingCopies.ko), shape(locales.landingCopies.en));
  assert.deepEqual(locales.availableLandingLocales.map((entry) => entry.locale), ["en", "ko"]);
  for (const language of ["ja", "zh-CN", "zh-TW", "fr", undefined]) assert.equal(locales.getLandingCopy(language), locales.landingCopies.en);
  assert.equal(locales.getLandingCopy("KO"), locales.landingCopies.ko);
  assert.deepEqual(locales.landingLocaleRegistry.filter((entry) => entry.status === "planned").map((entry) => entry.locale), ["ja", "zh-CN", "zh-TW"]);
});

test("actual English and Korean pages offer only available language links and keep shared learning entry", () => {
  for (const locale of ["en", "ko"]) {
    const rendered = html(locale);
    assert.match(rendered, new RegExp(`class="lucid-landing" lang="${locale}"`));
    assert.match(rendered, /href="\/en" hrefLang="en" lang="en"/i);
    assert.match(rendered, /href="\/ko" hrefLang="ko" lang="ko"/i);
    assert.ok((rendered.match(new RegExp(`href="/start\\?lang=${locale}"`,"g")) ?? []).length >= 3);
    assert.doesNotMatch(rendered, /href="\/(?:ja|zh-CN|zh-TW)"/);
    assert.match(rendered, /href="#landing-content"/);
    assert.match(rendered, /aria-label="(?:Page language|페이지 언어)"/);
  }
});

test("landing demo uses the current authored English expression, has accessible tone controls and no private input", () => {
  const example = expressions.getPracticeExpression("explain-the-reason");
  for (const locale of ["en", "ko"]) {
    const rendered = html(locale);
    assert.ok(rendered.includes(`<blockquote lang="en">${example.plain}</blockquote>`));
    assert.equal((rendered.match(/aria-pressed=/g) ?? []).length, 3);
    assert.match(rendered, /aria-live="polite" aria-atomic="true"/);
    assert.doesNotMatch(rendered, /<input|<textarea|<form|<iframe|<video/);
    assert.doesNotMatch(rendered, /https:\/\/.*(?:analytics|youtube|vimeo)/);
  }
});

test("launch copy accurately limits Korean coverage and current guest/private-writing behavior", () => {
  const en = html("en"), ko = html("ko");
  assert.match(en, /Korean support covers navigation, setup, daily words, idioms and Review instructions/);
  assert.match(en, /Course narratives, Express scenarios, Library\/Progress details/);
  assert.match(ko, /오늘의 단어·관용 표현과 복습 안내에 한국어/);
  assert.match(ko, /영어 단어와 예문은 그대로 유지/);
  assert.match(en, /Shared-account sign-in is not enabled in this public release/);
  assert.match(ko, /계정 로그인이 활성화되어 있지/);
  assert.match(en, /backup can include private writing/); assert.match(ko, /백업에는 개인적인 글이 포함/);
  assert.match(en, /personal situation, original sentences and retries stay on your device/);
  assert.match(en, /not an AI assessment or a learning score/);
  assert.match(en, /wait for offline setup to finish/);
  assert.match(ko, /개인정보 처리방침 \(영어\)/);
  assert.doesNotMatch(en + ko, /guaranteed fluency|trusted by|one-click iPhone|installed successfully/);
});

test("locale metadata points canonicals and hreflang to the verified public origin, without planned translations", async () => {
  for (const locale of ["en", "ko"]) {
    const { metadata } = await load(`app/${locale}/page.tsx`);
    assert.equal(metadata.alternates.canonical, `${locales.PUBLIC_LUCID_ORIGIN}/${locale}`);
    assert.deepEqual(metadata.alternates.languages, { en: `${locales.PUBLIC_LUCID_ORIGIN}/en`, ko: `${locales.PUBLIC_LUCID_ORIGIN}/ko`, "x-default": `${locales.PUBLIC_LUCID_ORIGIN}/en` });
    assert.equal(metadata.openGraph.locale, locale === "ko" ? "ko_KR" : "en_US");
    assert.equal(metadata.description, locales.getLandingCopy(locale).description);
  }
});

test("start entry redirects to the original app without locale account keys or an unsupported pace override", async () => {
  const { default: StartPage } = await load("app/start/page.tsx");
  await assert.rejects(StartPage(), (error) => error.destination === "/?source=landing");
  for (const lang of ["ko","en"]) await assert.rejects(StartPage({searchParams:Promise.resolve({lang})}), error => error.destination === `/?source=landing&lang=${lang}`);
  await assert.rejects(StartPage({searchParams:Promise.resolve({lang:"ja"})}), error => error.destination === "/?source=landing");
  const existing = await readFile(new URL("app/page.tsx", root), "utf8"); assert.match(existing, /<VocabularyApp/);
});
