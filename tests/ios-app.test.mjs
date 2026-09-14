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
  assert.equal(catalogue.words.length, 143);
  assert.equal(new Set(catalogue.words.map(({ id }) => id)).size, catalogue.words.length);
  assert.equal(catalogue.learningPaths.length, 1);
  const path = catalogue.learningPaths[0];
  assert.equal(path.roleId, "finance-accounting");
  assert.equal(path.modules.length, 6);
  assert.ok(path.modules.every(({ lessons }) => lessons.length === 5));
  const lessons = path.modules.flatMap(({ lessons }) => lessons);
  const ids = lessons.flatMap(({ wordIds }) => wordIds);
  assert.equal(ids.length, 90);
  assert.equal(new Set(ids).size, 90);
  assert.ok(lessons.every(lesson => lesson.wordIds.length === 3 && lesson.objective && lesson.challenge && lesson.exampleResponse));
  assert.ok(lessons.every(lesson => lesson.wordIds.every(id => catalogue.words.some(word => word.id === id && word.learningMode === "active" && word.roles.includes(path.roleId) && word.situations.includes(lesson.situationId)))));
  assert.ok(catalogue.roles.every(({ situations }) => situations.length === 4));
  assert.ok(catalogue.words.every(({ collocations }) => collocations.length >= 2));
  let contexts = 0;
  for (const word of catalogue.words) {
    for (const [roleId, context] of Object.entries(word.roleContexts ?? {})) {
      contexts += 1;
      assert.ok(word.roles.includes(roleId), `${word.id}: context belongs to an untagged role`);
      for (const field of ["meaning", "example", "whenToUse", "avoidOrMisuse", "mission"]) assert.ok(context[field]?.trim());
      assert.ok(context.collocations.length >= 2);
      assert.ok(context.example.toLowerCase().includes(word.term.toLowerCase()));
    }
  }
  assert.equal(contexts, 6);
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
