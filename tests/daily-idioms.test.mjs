import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = await readFile(new URL("../lib/daily-idioms.ts", import.meta.url), "utf8");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`;
const { dailyIdioms, dailyIdiomForDay, dailyIdiomEditorialSources } = await import(moduleUrl);
const native = JSON.parse(await readFile(new URL("../ios/Lucid/Lucid/Resources/daily-idioms.json", import.meta.url), "utf8"));
const expectedIds = [
  "same-page", "get-ball-rolling", "keep-in-loop", "ballpark-figure", "on-fence", "up-in-air", "cut-corners",
  "raise-bar", "back-square-one", "big-picture", "read-between-lines", "touch-base", "break-ice", "learn-ropes",
];
const dayAfter = (day, count = 1) => new Date(Date.parse(`${day}T00:00:00.000Z`) + count * 86_400_000).toISOString().slice(0, 10);

test("canonical idioms retain unique stable IDs and usable meaning, register, context and plain wording", () => {
  assert.deepEqual(dailyIdioms.map(({ id }) => id), expectedIds);
  assert.equal(new Set(dailyIdioms.map(({ phrase }) => phrase)).size, dailyIdioms.length);
  for (const idiom of dailyIdioms) {
    for (const field of ["id", "phrase", "meaning", "example", "register", "context", "plainEnglish"]) {
      assert.equal(typeof idiom[field], "string", `${idiom.id}: ${field}`);
      assert.ok(idiom[field].trim().length > 0, `${idiom.id}: ${field}`);
    }
    if (idiom.avoid !== undefined) assert.ok(idiom.avoid.trim().length > 0);
    assert.notEqual(idiom.example, idiom.meaning);
    assert.notEqual(idiom.plainEnglish, idiom.phrase);
    assert.match(idiom.register, /Conversational/);
  }
});

test("one day has one stable idiom without mutable exposure or mastery side effects", () => {
  const before = JSON.stringify(dailyIdioms);
  const selected = dailyIdiomForDay("2026-10-15");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    assert.equal(dailyIdiomForDay("2026-10-15"), selected);
  }
  assert.equal(JSON.stringify(dailyIdioms), before);
  assert.ok(Object.isFrozen(dailyIdioms));
  assert.ok(dailyIdioms.every(Object.isFrozen));
  assert.throws(() => { selected.meaning = "changed"; }, TypeError);
  assert.ok(!("mastered" in selected || "quality" in selected || "recallSuccess" in selected));
});

test("every consecutive day gets a distinct idiom before the finite catalog rotates", () => {
  const first = "2026-10-15";
  const ids = Array.from({ length: dailyIdioms.length }, (_, offset) => dailyIdiomForDay(dayAfter(first, offset)).id);
  assert.equal(new Set(ids).size, dailyIdioms.length);
  assert.equal(dailyIdiomForDay(dayAfter(first, dailyIdioms.length)).id, ids[0]);
  assert.notEqual(dailyIdiomForDay(first).id, dailyIdiomForDay(dayAfter(first)).id);
});

test("calendar boundaries rotate across months, years and leap days in UTC", () => {
  for (const [before, after] of [
    ["2026-10-31", "2026-11-01"],
    ["2026-12-31", "2027-01-01"],
    ["2028-02-28", "2028-02-29"],
    ["2028-02-29", "2028-03-01"],
    ["2000-02-28", "2000-02-29"],
    ["2100-02-28", "2100-03-01"],
  ]) {
    assert.equal(dayAfter(before), after);
    const index = dailyIdioms.findIndex(({ id }) => id === dailyIdiomForDay(before).id);
    assert.equal(dailyIdiomForDay(after), dailyIdioms[(index + 1) % dailyIdioms.length]);
  }
});

test("pre-epoch dates use positive rotation and ISO years below 100 stay literal", () => {
  assert.equal(dailyIdiomForDay("1970-01-01").id, expectedIds[0]);
  assert.equal(dailyIdiomForDay("1969-12-31").id, expectedIds.at(-1));
  assert.equal(dailyIdiomForDay("1969-12-18").id, expectedIds[0]);
  assert.notEqual(dailyIdiomForDay("0099-12-31").id, dailyIdiomForDay("0100-01-01").id);
});

test("invalid or ambiguous calendar input fails instead of silently normalizing", () => {
  for (const day of [
    "", "2026-1-01", "2026-01-1", "26-01-01", "2026-02-29", "2026-04-31", "2026-00-01", "2026-13-01",
    "1900-02-29", "2100-02-29", "2026-01-00", "2026-01-32", "2026-10-15T00:00:00Z", " 2026-10-15",
    "2026-10-15 ", "not-a-day", null, undefined, 20261015,
  ]) assert.throws(() => dailyIdiomForDay(day), RangeError, String(day));
});

test("saved daily idiom identity resolves unchanged after a fresh module load", async () => {
  const checkpoint = JSON.parse(JSON.stringify({ day: "2026-10-15", idiomId: dailyIdiomForDay("2026-10-15").id }));
  const reloaded = await import(`${moduleUrl}#fresh-load`);
  assert.equal(reloaded.dailyIdiomForDay(checkpoint.day).id, checkpoint.idiomId);
  assert.deepEqual(reloaded.dailyIdioms.find(({ id }) => id === checkpoint.idiomId), dailyIdiomForDay(checkpoint.day));
});

test("generated native idiom resource exactly matches canonical content and order", () => {
  assert.equal(native.schemaVersion, 1);
  assert.deepEqual(native.idioms, dailyIdioms);
  assert.deepEqual(Object.keys(native).sort(), ["idioms", "schemaVersion"]);
});

test("editorial references cover every idiom without requiring a runtime dictionary service", () => {
  assert.deepEqual(dailyIdiomEditorialSources.map(({ id }) => id), expectedIds);
  for (const { url } of dailyIdiomEditorialSources) {
    const parsed = new URL(url);
    assert.equal(parsed.protocol, "https:");
    assert.equal(parsed.hostname, "www.merriam-webster.com");
    assert.ok(parsed.pathname.startsWith("/dictionary/"));
  }
  const shortcuts = dailyIdioms.find(({ id }) => id === "cut-corners");
  assert.match(shortcuts.meaning, /reducing quality/);
  const inference = dailyIdioms.find(({ id }) => id === "read-between-lines");
  assert.match(inference.avoid, /not a fact/);
});
