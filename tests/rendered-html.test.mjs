import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const starterCopy =
  /codex-preview|Starter Project|Your site is taking shape|Building your site|Your first version will appear here automatically|sites-skeleton|react-loading-skeleton/i;

const expectedSeedWords = [
  "Equanimity",
  "Apprehensive",
  "Disillusioned",
  "Exasperated",
  "Nuanced",
  "Cogent",
  "Conjecture",
  "Resolute",
  "Pragmatic",
  "Galvanize",
  "Ambivalent",
  "Indignant",
  "Introspective",
  "Vulnerable",
  "Articulate",
  "Discern",
  "Premise",
  "Decisive",
  "Accountable",
  "Delegate",
  "Despondent",
  "Perturbed",
  "Resentful",
  "Composed",
  "Elucidate",
  "Substantiate",
  "Fallacious",
  "Judicious",
  "Empower",
  "Forthright",
  "Remorseful",
  "Elated",
  "Stoic",
  "Disconcerted",
  "Infer",
  "Equivocal",
  "Scrutinize",
  "Visionary",
  "Diplomatic",
  "Cultivate",
];

const expectedCategoryCounts = {
  emotions: 4,
  intellectual: 3,
  leadership: 3,
};

let renderedPagePromise;
let vocabularyDataPromise;

async function renderedPage() {
  if (!renderedPagePromise) {
    renderedPagePromise = (async () => {
      const workerUrl = new URL("../dist/server/index.js", import.meta.url);
      workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
      const { default: worker } = await import(workerUrl.href);
      const response = await worker.fetch(
        new Request("http://localhost/", {
          headers: { accept: "text/html" },
        }),
        {
          ASSETS: {
            fetch: async () => new Response("Not found", { status: 404 }),
          },
        },
        {
          waitUntil() {},
          passThroughOnException() {},
        },
      );

      return {
        status: response.status,
        contentType: response.headers.get("content-type") ?? "",
        html: await response.text(),
      };
    })();
  }

  return renderedPagePromise;
}

async function vocabularyData() {
  if (!vocabularyDataPromise) {
    vocabularyDataPromise = (async () => {
      const source = await readFile(
        new URL("lib/vocabulary-data.ts", root),
        "utf8",
      );
      const { outputText } = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
        fileName: "vocabulary-data.ts",
        reportDiagnostics: true,
      });
      const moduleUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
      return import(moduleUrl);
    })();
  }

  return vocabularyDataPromise;
}

function countBy(items, key) {
  return Object.fromEntries(
    items.reduce((counts, item) => {
      const value = item[key];
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map()),
  );
}

function assertUnique(items, label) {
  assert.equal(new Set(items).size, items.length, `${label} must be unique`);
}

function assertCompleteWord(entry) {
  for (const key of [
    "id",
    "word",
    "partOfSpeech",
    "category",
    "pronunciation",
    "meaning",
    "example",
  ]) {
    assert.equal(
      typeof entry[key],
      "string",
      `${entry.word || entry.id || "word"}.${key} must be text`,
    );
    assert.ok(
      entry[key].trim().length > 0,
      `${entry.word || entry.id || "word"}.${key} must not be empty`,
    );
  }

  // Permit ordinary inflections and the project's consistent British -ise
  // spelling while still requiring the example to demonstrate the word.
  const example = entry.example.toLocaleLowerCase("en").replaceAll("z", "s");
  const stem = entry.word
    .toLocaleLowerCase("en")
    .replaceAll("z", "s")
    .replace(/e$/, "");
  assert.match(
    example,
    new RegExp(`\\b${stem}(?:e|es|ed|ing|s|d)?\\b`),
    `${entry.word}'s example must use the target word or an inflection of it`,
  );
}

test("server-renders the vocabulary product shell", async () => {
  const { status, contentType, html } = await renderedPage();

  assert.equal(status, 200);
  assert.match(contentType, /^text\/html\b/i);
  assert.match(html, /<html[^>]+lang=["']en["']/i);
  assert.match(
    html,
    /<title>Lucid\s*(?:—|&mdash;|&#x2014;)\s*Advanced English Vocabulary Coach<\/title>/i,
  );
  assert.match(html, /<main\b/i);
  assert.match(html, /<nav\b/i);
  assert.match(html, /Lucid/i);
  assert.match(html, /Day\s*5/i);
  assert.match(html, /Review quiz today/i);
  assert.match(html, /Emotions/i);
  assert.match(html, /Intellectual conversation/i);
  assert.match(html, /Leadership/i);
  assert.match(html, /History/i);
  assert.match(html, /Progress/i);
});

test("does not ship starter metadata or the loading skeleton", async () => {
  const [{ html }, page, layout, vocabularyApp] = await Promise.all([
    renderedPage(),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/VocabularyApp.tsx", root), "utf8"),
  ]);

  assert.doesNotMatch(html, starterCopy);
  assert.doesNotMatch(page, starterCopy);
  assert.doesNotMatch(layout, starterCopy);
  assert.doesNotMatch(page, /_sites-preview|SkeletonPreview/);
  assert.match(vocabularyApp, /DAY 5[^\n]+ADVANCED ENGLISH PRACTICE/i);
  assert.match(vocabularyApp, /QUICK USAGE EXERCISE/i);
  assert.match(vocabularyApp, /review quiz/i);
});

test("preserves the exact 40-word learning history", async () => {
  const { seedWords } = await vocabularyData();

  assert.equal(seedWords.length, 40);
  assert.deepEqual(
    seedWords.map(({ word }) => word),
    expectedSeedWords,
    "Days 1–4 must preserve the supplied seed history",
  );
  assertUnique(
    seedWords.map(({ id }) => id),
    "seed word IDs",
  );
  assertUnique(
    seedWords.map(({ word }) => word.toLocaleLowerCase("en")),
    "seed words",
  );

  for (const day of [1, 2, 3, 4]) {
    const words = seedWords.filter((entry) => entry.day === day);
    assert.equal(words.length, 10, `Day ${day} must contain 10 seed words`);
    assert.deepEqual(
      countBy(words, "category"),
      expectedCategoryCounts,
      `Day ${day} must use the required 4/3/3 category split`,
    );
  }

  seedWords.forEach(assertCompleteWord);
});

test("Day 5 teaches exactly 10 new words with a 4/3/3 split", async () => {
  const { allWords, categories, dayFiveWords, seedWords } =
    await vocabularyData();

  assert.equal(dayFiveWords.length, 10);
  assert.ok(dayFiveWords.every(({ day }) => day === 5));
  assert.deepEqual(countBy(dayFiveWords, "category"), expectedCategoryCounts);
  assert.deepEqual(
    categories.map(({ label }) => label),
    ["Emotional expression", "Intellectual conversation", "Leadership"],
    "lesson sections must use the required category labels",
  );
  assertUnique(
    dayFiveWords.map(({ id }) => id),
    "Day 5 word IDs",
  );
  assertUnique(
    dayFiveWords.map(({ word }) => word.toLocaleLowerCase("en")),
    "Day 5 words",
  );

  const previouslyTaught = new Set(
    seedWords.map(({ word }) => word.toLocaleLowerCase("en")),
  );
  for (const entry of dayFiveWords) {
    assertCompleteWord(entry);
    assert.ok(entry.ipa?.trim(), `${entry.word} should include its IPA`);
    assert.ok(
      !previouslyTaught.has(entry.word.toLocaleLowerCase("en")),
      `${entry.word} must not repeat a previously taught word`,
    );
  }

  assert.equal(allWords.length, 50);
  assertUnique(
    allWords.map(({ word }) => word.toLocaleLowerCase("en")),
    "all taught words",
  );
});

test("the Day 5 exercise has five fills and two sentence prompts", async () => {
  const { dailyExercise, dayFiveWords } = await vocabularyData();

  assert.equal(dailyExercise.length, 7);
  assert.deepEqual(countBy(dailyExercise, "type"), {
    fill: 5,
    sentence: 2,
  });
  assertUnique(
    dailyExercise.map(({ id }) => id),
    "exercise IDs",
  );

  const lessonWords = new Set(
    dayFiveWords.map(({ word }) => word.toLocaleLowerCase("en")),
  );
  for (const exercise of dailyExercise) {
    assert.ok(exercise.prompt.trim(), `${exercise.id} needs a prompt`);
    assert.ok(exercise.answer.trim(), `${exercise.id} needs an answer`);
    assert.ok(exercise.reason.trim(), `${exercise.id} needs an explanation`);
    assert.ok(
      lessonWords.has(exercise.answer.toLocaleLowerCase("en")),
      `${exercise.id}'s answer must come from Day 5`,
    );
    if (exercise.type === "fill") {
      assert.match(exercise.prompt, /_{3,}/, `${exercise.id} needs a blank`);
      assert.doesNotMatch(
        exercise.prompt.toLocaleLowerCase("en"),
        new RegExp(`\\b${exercise.answer.toLocaleLowerCase("en")}\\b`),
        `${exercise.id} must not reveal its answer`,
      );
    }
  }
});

test("the Day 5 review quiz has the required 15-question composition", async () => {
  const { dayFiveQuiz, dayFiveWords, seedWords } = await vocabularyData();

  assert.equal(dayFiveQuiz.length, 15);
  assert.deepEqual(countBy(dayFiveQuiz, "type"), {
    meaning: 4,
    fill: 4,
    natural: 3,
    matching: 2,
    sentence: 2,
  });
  assertUnique(
    dayFiveQuiz.map(({ id }) => id),
    "quiz question IDs",
  );

  const seed = new Set(
    seedWords.map(({ word }) => word.toLocaleLowerCase("en")),
  );
  const newWords = new Set(
    dayFiveWords.map(({ word }) => word.toLocaleLowerCase("en")),
  );

  for (const question of dayFiveQuiz) {
    assert.ok(question.prompt.trim(), `${question.id} needs a prompt`);
    assert.ok(question.answer.trim(), `${question.id} needs an answer`);
    assert.ok(question.explanation.trim(), `${question.id} needs an explanation`);
    assert.ok(
      seed.has(question.word.toLocaleLowerCase("en")),
      `${question.id} may only review words taught on Days 1–4`,
    );
    assert.ok(
      !newWords.has(question.word.toLocaleLowerCase("en")),
      `${question.id} must not test a Day 5 word before it is taught`,
    );

    if (["meaning", "natural", "matching"].includes(question.type)) {
      assert.ok(
        Array.isArray(question.options) && question.options.length >= 3,
        `${question.id} needs plausible answer options`,
      );
      assert.equal(
        question.options.filter((option) => option === question.answer).length,
        1,
        `${question.id} must include exactly one correct option`,
      );
    }
  }
});
