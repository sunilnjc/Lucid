import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function text(path) {
  return readFile(new URL(path, root), "utf8");
}

test("iOS catalogue stays aligned with the canonical professional content", async () => {
  const raw = await text("ios/Lucid/Lucid/Resources/professional-content.json");
  const catalogue = JSON.parse(raw);
  const compiled = stripTypeScriptTypes(await text("lib/professional-content.ts"));
  const canonical = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
  assert.deepEqual(catalogue.words, canonical.professionalWords);
  assert.deepEqual(catalogue.learningPaths, canonical.professionalLearningPaths);

  assert.equal(catalogue.schemaVersion, 1);
  assert.equal(catalogue.roles.length, 8);
  assert.equal(catalogue.seniorityLevels.length, 5);
  assert.equal(catalogue.goals.length, 8);
  assert.ok(catalogue.words.length > 143, "Expanded courses must add substantial vocabulary");
  assert.equal(new Set(catalogue.words.map(({ id }) => id)).size, catalogue.words.length);
  assert.equal(catalogue.learningPaths.length, 8);
  assert.equal(new Set(catalogue.learningPaths.map(path => path.roleId)).size, 8);
  for (const path of catalogue.learningPaths) {
  assert.equal(path.modules.length, 6);
  assert.ok(path.modules.every(({ lessons }) => lessons.length === 5));
  const lessons = path.modules.flatMap(({ lessons }) => lessons);
  const ids = lessons.flatMap(({ wordIds }) => wordIds);
  assert.equal(ids.length, 90);
  assert.equal(new Set(ids).size, 90);
  assert.ok(lessons.every(lesson => lesson.wordIds.length === 3 && lesson.objective && lesson.challenge && lesson.exampleResponse));
  assert.ok(lessons.every(lesson => lesson.wordIds.every(id => catalogue.words.some(word => word.id === id && word.learningMode === "active" && word.roles.includes(path.roleId) && word.situations.includes(lesson.situationId)))));
  assert.equal(path.startingCheck.length, 6);
  assert.equal(new Set(path.startingCheck.map(item => item.id)).size, 6);
  for (const item of path.startingCheck) {
    assert.ok(item.prompt && item.explanation);
    assert.equal(new Set(item.options).size, 3);
    assert.ok(Number.isInteger(item.correctIndex) && item.correctIndex >= 0 && item.correctIndex < 3);
  }
  }
  assert.ok(catalogue.roles.every(({ situations }) => situations.length === 4));
  assert.ok(catalogue.words.every(({ collocations }) => collocations.length >= 2));
  let contexts = 0;
  for (const word of catalogue.words) {
    if (word.learningMode === "active") {
      for (const roleId of word.roles.slice(1)) {
        assert.ok(word.roleContexts?.[roleId], `${word.id}: missing secondary role context for ${roleId}`);
      }
      for (const roleId of word.roles) {
        const roleSituations = new Set(catalogue.roles.find(role => role.id === roleId).situations.map(item => item.id));
        assert.ok(word.situations.some(id => roleSituations.has(id)), `${word.id}: missing situation for ${roleId}`);
      }
    }
    for (const [roleId, context] of Object.entries(word.roleContexts ?? {})) {
      contexts += 1;
      assert.ok(word.roles.includes(roleId), `${word.id}: context belongs to an untagged role`);
      for (const field of ["meaning", "example", "whenToUse", "avoidOrMisuse", "mission"]) assert.ok(context[field]?.trim());
      assert.ok(context.collocations.length >= 2);
      assert.ok(context.example.toLowerCase().includes(word.term.toLowerCase()), `${word.id}/${roleId} example must use the term`);
    }
  }
  assert.ok(contexts > 100, "Shared terms need genuinely authored role contexts");
  const legacy = JSON.parse(await text("tests/fixtures/catalogue-v1-identities.json"));
  for (const word of legacy) assert.ok(catalogue.words.some(current => current.id === word.id && current.term === word.term), `Lost legacy identity: ${word.id}`);
});

test("iOS implementation is native, mobile-accessible, and review ready", async () => {
  const sources = await Promise.all([
    "ios/Lucid/Lucid/LucidApp.swift",
    "ios/Lucid/Lucid/LearningStore.swift",
    "ios/Lucid/Lucid/RootView.swift",
    "ios/Lucid/Lucid/SecondaryViews.swift",
    "ios/Lucid/Lucid/Services.swift",
    "ios/Lucid/Lucid/SettingsView.swift",
  ].map(text)).then((files) => files.join("\n"));
  const project = await text("ios/Lucid/Lucid.xcodeproj/project.pbxproj");
  const privacy = await text("ios/Lucid/Lucid/PrivacyInfo.xcprivacy");

  assert.match(sources, /import SwiftUI/);
  assert.match(sources, /requestReview/);
  assert.match(sources, /SFSpeechRecognizer/);
  assert.match(sources, /UNUserNotificationCenter/);
  assert.match(sources, /AVSpeechSynthesizer/);
  assert.doesNotMatch(sources, /WKWebView|SFSafariViewController/);
  assert.match(sources, /\[1, 3, 7, 14, 30\]/);
  assert.match(sources, /accessibilityLabel/);
  assert.match(sources, /Erase learning data/);
  assert.match(project, /PRODUCT_BUNDLE_IDENTIFIER = com\.sunilnjc\.lucid/);
  assert.match(project, /IPHONEOS_DEPLOYMENT_TARGET = 17\.0/);
  assert.match(project, /NSSpeechRecognitionUsageDescription/);
  assert.match(project, /NSMicrophoneUsageDescription/);
  assert.match(privacy, /NSPrivacyTracking/);
});

test("public App Store privacy and support routes are present", async () => {
  const privacyPage = await text("app/privacy/page.tsx");
  const supportPage = await text("app/support/page.tsx");

  assert.match(privacyPage, /No account|without creating an account/i);
  assert.match(privacyPage, /beta feedback/i);
  assert.match(privacyPage, /erase/i);
  assert.match(supportPage, /Open a support request/);
  assert.match(supportPage, /1, 3, 7, 14, and 30 days/);
});
