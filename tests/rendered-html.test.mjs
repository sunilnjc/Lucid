import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
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

const expectedDayFiveWords = [
  "Wistful",
  "Disquieted",
  "Buoyant",
  "Empathetic",
  "Incisive",
  "Tenable",
  "Reconcile",
  "Unflappable",
  "Strategic",
  "Champion",
];

const expectedCategoryCounts = {
  emotions: 4,
  intellectual: 3,
  leadership: 3,
};

let renderedPagePromise;
const typescriptModulePromises = new Map();
let applicationSourcePromise;

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

async function typescriptModule(relativePath) {
  if (!typescriptModulePromises.has(relativePath)) {
    typescriptModulePromises.set(
      relativePath,
      (async () => {
        const source = await readFile(new URL(relativePath, root), "utf8");
        const { diagnostics = [], outputText } = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
          fileName: relativePath,
        reportDiagnostics: true,
      });

        const errors = diagnostics.filter(
          ({ category }) => category === ts.DiagnosticCategory.Error,
        );
        assert.deepEqual(
          errors.map(({ messageText }) =>
            ts.flattenDiagnosticMessageText(messageText, "\n"),
          ),
          [],
          `${relativePath} must be valid TypeScript`,
        );

        const moduleUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
        return import(moduleUrl);
      })(),
    );
  }

  return typescriptModulePromises.get(relativePath);
}

async function vocabularyData() {
  return typescriptModule("lib/vocabulary-data.ts");
}

async function applicationSource() {
  if (!applicationSourcePromise) {
    applicationSourcePromise = (async () => {
      const files = await readdir(new URL("app/", root), { recursive: true });
      const sourceFiles = files.filter(
        (file) => file.endsWith(".tsx") || file.endsWith(".ts"),
      );
      return Promise.all(
        sourceFiles.map((file) => readFile(new URL(`app/${file}`, root), "utf8")),
      ).then((sources) => sources.join("\n"));
    })();
  }

  return applicationSourcePromise;
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

function taggedValues(entry, key) {
  return entry[key] ?? entry.tags?.[key];
}

function vocabularyText(entry) {
  return entry.word ?? entry.term;
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

test("server-renders the professional-English product handoff", async () => {
  const { status, contentType, html } = await renderedPage();

  assert.equal(status, 200);
  assert.match(contentType, /^text\/html\b/i);
  assert.match(html, /<html[^>]+lang=["']en["']/i);
  assert.match(
    html,
    /<title>Lucid\s*(?:—|&mdash;|&#x2014;)\s*Professional English for Your Role<\/title>/i,
  );
  assert.match(
    html,
    /<meta[^>]+name=["']description["'][^>]+content=["'][^"']*Role-specific daily vocabulary practice/i,
  );
  assert.match(html, /<main\b/i);
  assert.match(html, /class=["'][^"']*loading-screen/i);
  assert.match(html, /<h1>Lucid<\/h1>/i);
  assert.match(html, /Preparing your professional English path/i);
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
  assert.match(vocabularyApp, /Professional English/i);
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
  assert.deepEqual(
    dayFiveWords.map(({ word }) => word),
    expectedDayFiveWords,
    "Day 5 must preserve the previously delivered lesson",
  );
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

test("builds a daily plan with three active words plus due review", async () => {
  const { createDailyPlan, createWordMastery } = await typescriptModule(
    "lib/learning-engine.ts",
  );
  const words = Array.from({ length: 6 }, (_, index) => ({
    id: `professional-${index + 1}`,
    active: true,
    roles: ["software engineer"],
    situations: ["stakeholder meetings"],
    goals: ["speak with precision"],
    usefulness: 5 - (index % 2),
    difficulty: 4,
  }));
  const due = createWordMastery(words[0].id, "2026-08-16");
  const plan = createDailyPlan({
    date: "2026-08-18",
    profile: {
      role: "software engineer",
      seniority: "senior",
      situations: ["stakeholder meetings"],
      goals: ["speak with precision"],
    },
    words,
    masteryByWordId: { [words[0].id]: due },
  });

  assert.equal(plan.activeNewWords.length, 3);
  assert.ok(
    plan.activeNewWords.every(({ word }) => word.id !== due.wordId),
    "introduced review words must not be selected as active new words",
  );
  assert.deepEqual(
    plan.dueReviews.map(({ word }) => word.id),
    [due.wordId],
    "all due review words must accompany the three active words",
  );
});

test("uses the exact 1/3/7/14/30-day spaced-review ladder", async () => {
  const { SRS_INTERVAL_DAYS } = await typescriptModule(
    "lib/learning-engine.ts",
  );

  assert.deepEqual([...SRS_INTERVAL_DAYS], [1, 3, 7, 14, 30]);
});

test("ships broad role coverage and at least 60 professionally tagged words", async () => {
  const content = await typescriptModule("lib/professional-content.ts");
  const roles =
    content.professionalRoles ??
    content.roles ??
    Object.values(content).find(
      (value) =>
        Array.isArray(value) &&
        value.length >= 8 &&
        value.every(
          (item) =>
            typeof item === "string" ||
            (item && typeof item === "object" && !item.word),
        ),
    );
  const words =
    content.professionalWords ??
    content.professionalVocabulary ??
    content.taggedWords ??
    Object.values(content).find(
      (value) =>
        Array.isArray(value) &&
        value.length >= 60 &&
        value.every(
          (item) =>
            item && typeof item === "object" && vocabularyText(item),
        ),
    );

  assert.ok(Array.isArray(roles), "professional content must export its roles");
  assert.ok(roles.length >= 8, "onboarding must offer at least eight roles");
  assertUnique(
    roles.map((role) =>
      String(
        typeof role === "string"
          ? role
          : role.id ?? role.label ?? role.name ?? role.title,
      ).toLocaleLowerCase("en"),
    ),
    "professional roles",
  );

  assert.ok(
    Array.isArray(words),
    "professional content must export its tagged vocabulary",
  );
  assert.ok(
    words.length >= 60,
    "the adaptive vocabulary pool must contain at least 60 entries",
  );
  assertUnique(
    words.map(({ id }) => id),
    "professional word IDs",
  );
  assertUnique(
    words.map((entry) => vocabularyText(entry).toLocaleLowerCase("en")),
    "professional vocabulary",
  );

  for (const entry of words) {
    const term = vocabularyText(entry);
    assert.ok(entry.id?.trim(), "every professional word needs an ID");
    assert.ok(term?.trim(), "every professional word needs display text");
    for (const tag of ["roles", "situations", "seniority", "goals"]) {
      const values = taggedValues(entry, tag);
      assert.ok(
        Array.isArray(values) && values.length > 0,
        `${term} needs at least one ${tag} tag`,
      );
    }
    assert.ok(
      Array.isArray(entry.collocations) && entry.collocations.length > 0,
      `${term} needs a useful collocation`,
    );
    for (const field of ["whenToUse", "avoidOrMisuse", "mission"]) {
      assert.ok(
        entry[field]?.trim(),
        `${term}.${field} must support the professional lesson`,
      );
    }
  }
});

test("exposes professional onboarding, practice, and beta-feedback surfaces", async () => {
  const source = await applicationSource();

  for (const required of [
    /profession(?:al role)?/i,
    /seniority/i,
    /communication situations?/i,
    /(?:learning )?goals?/i,
  ]) {
    assert.match(source, required, `missing onboarding field ${required}`);
  }

  for (const required of [
    /(?:workplace|today['’]s) (?:scenario|mission)/i,
    /when to use/i,
    /avoid(?: this)?/i,
    /collocations?/i,
    /written practice/i,
    /spoken practice/i,
  ]) {
    assert.match(source, required, `missing professional lesson surface ${required}`);
  }

  assert.match(source, /beta feedback/i);
  assert.match(source, /fetch\(["']\/api\/feedback["']/);
  assert.match(source, /<textarea\b/i, "beta feedback needs a written entry field");
});

test("keeps Settings and lesson progress available in responsive navigation", async () => {
  const [source, css] = await Promise.all([
    applicationSource(),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(source, /label:\s*["']Settings["']/);
  assert.match(source, /className=["']mobile-nav["']/);
  assert.match(
    source,
    /className=["']mobile-nav["'][\s\S]{0,800}(?:navItems\.map|Settings)/,
    "mobile navigation must retain access to Settings",
  );
  assert.match(source, /className=["']lesson-progress["']/);
  assert.match(css, /@media\s*\([^)]*max-width/i);
  assert.match(css, /\.mobile-nav\b/);
  assert.match(css, /\.lesson-progress\b/);
});

test("uses a dynamic greeting and date instead of the original fixed welcome", async () => {
  const [{ html }, source] = await Promise.all([
    renderedPage(),
    applicationSource(),
  ]);
  const fixedWelcome = /Good evening,\s*Sunil|MONDAY\s*[·•-]\s*17 AUGUST/i;

  assert.doesNotMatch(source, fixedWelcome);
  assert.doesNotMatch(html, fixedWelcome);
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
