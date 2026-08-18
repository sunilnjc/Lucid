import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function text(path) {
  return readFile(new URL(path, root), "utf8");
}

test("iOS catalogue stays aligned with the canonical professional content", async () => {
  const raw = await text("ios/Lucid/Lucid/Resources/professional-content.json");
  const catalogue = JSON.parse(raw);

  assert.equal(catalogue.schemaVersion, 1);
  assert.equal(catalogue.roles.length, 8);
  assert.equal(catalogue.seniorityLevels.length, 5);
  assert.equal(catalogue.goals.length, 8);
  assert.equal(catalogue.words.length, 64);
  assert.equal(new Set(catalogue.words.map(({ id }) => id)).size, 64);
  assert.ok(catalogue.roles.every(({ situations }) => situations.length === 4));
  assert.ok(catalogue.words.every(({ collocations }) => collocations.length >= 2));
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
