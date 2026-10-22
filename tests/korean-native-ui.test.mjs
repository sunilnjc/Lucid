import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const root = new URL("../", import.meta.url);
const copySource = await readFile(new URL("lib/learning-locale-copy.ts", root), "utf8");
const { koreanLearningUI } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(copySource)).toString("base64")}`);
const catalog = JSON.parse(await readFile(new URL("ios/Lucid/Lucid/Resources/professional-content.json", root), "utf8"));

test("every native localized interface key has Korean copy, including named counts and accessibility labels", async () => {
  const keys = new Set();
  for (const name of ["LucidApp", "RootView", "DailyVocabularyViews", "SecondaryViews", "ExperienceViews", "SettingsView"]) {
    const source = await readFile(new URL(`ios/Lucid/Lucid/${name}.swift`, root), "utf8");
    for (const match of source.matchAll(/\blearning(?:Text|Format)\("((?:\\.|[^"\\])*)"/g)) keys.add(JSON.parse(`"${match[1]}"`));
  }
  assert.ok(keys.size >= 250, "Expected native navigation, setup, daily and review coverage");
  const missing = [...keys].filter(key => typeof koreanLearningUI[key] !== "string" || !koreanLearningUI[key].trim());
  assert.deepEqual(missing, []);
});

test("native onboarding dynamic labels and grammar metadata are covered by the same canonical Korean dictionary", () => {
  const keys = new Set([
    ...catalog.roles.flatMap(role => [role.label, role.shortLabel, role.description, ...role.situations.flatMap(situation => [situation.label, situation.description])]),
    ...catalog.seniorityLevels.flatMap(level => [level.label, level.communicationFocus]),
    ...catalog.goals.flatMap(goal => [goal.label, goal.outcome]),
    ...catalog.words.map(word => word.partOfSpeech),
  ]);
  assert.ok(keys.size >= 100);
  assert.deepEqual([...keys].filter(key => typeof koreanLearningUI[key] !== "string" || !koreanLearningUI[key].trim()), []);
});
