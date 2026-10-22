import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import ts from "typescript";

const root = new URL("../", import.meta.url);

async function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"], ...options });
    let stdout = "", stderr = "";
    child.stdout.on("data", (value) => { stdout += value; });
    child.stderr.on("data", (value) => { stderr += value; });
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 ? resolve(stdout) : reject(new Error(`${command} failed (${code ?? signal}): ${stderr || stdout}`)));
  });
}

async function typescriptLoader(directory) {
  const urls = new Map();
  async function moduleURL(relative) {
    if (!urls.has(relative)) urls.set(relative, (async () => {
      const sourceURL = new URL(relative, root);
      const source = await readFile(sourceURL, "utf8");
      let { outputText } = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: relative,
      });
      const parsed = ts.createSourceFile(relative, outputText, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
      const edits = [];
      for (const statement of parsed.statements) {
        const specifier = (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier;
        if (!specifier || !ts.isStringLiteral(specifier)) continue;
        const name = specifier.text;
        let url;
        if (!name.startsWith(".")) url = import.meta.resolve(name);
        else {
          const dependency = new URL(name, sourceURL);
          if (!/\.[cm]?[jt]sx?$/.test(dependency.pathname)) dependency.pathname += ".ts";
          url = await moduleURL(dependency.pathname.slice(root.pathname.length));
        }
        edits.push({ start: specifier.getStart(parsed), end: specifier.end, value: JSON.stringify(url) });
      }
      for (const edit of edits.sort((a, b) => b.start - a.start)) outputText = outputText.slice(0, edit.start) + edit.value + outputText.slice(edit.end);
      const path = join(directory, relative.replaceAll("/", "_") + ".mjs");
      await writeFile(path, outputText);
      return pathToFileURL(path).href;
    })());
    return urls.get(relative);
  }
  return (relative) => moduleURL(relative).then((url) => import(url));
}

test("web tap challenges match the actual native generator across all 720 role/course positions", { timeout: 240_000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "lucid-native-web-tap-parity-"));
  try {
    // Freeze compiler inputs so a parallel edit cannot change a Swift source
    // between type checking and linking. The fixture reuses production behavior.
    const sourceNames = ["Models", "LearningPersistence", "LearningStore", "AccountService", "LocalBackup", "PracticeChallenges", "ExpressionStudio", "DailyVocabulary"];
    const contents = await Promise.all(sourceNames.map((name) => readFile(new URL(`ios/Lucid/Lucid/${name}.swift`, root))));
    const sources = await Promise.all(sourceNames.map(async (name, index) => {
      const path = join(directory, `${name}.swift`);
      await writeFile(path, contents[index]);
      return path;
    }));
    const driver = join(directory, "NativeWebTapParity.swift");
    await writeFile(driver, await readFile(new URL("tests/native-web-tap-parity.swift", root)));
    const executable = join(directory, "native-tap-parity");
    await run("xcrun", ["swiftc", "-parse-as-library", "-module-cache-path", join(directory, "module-cache"), ...sources, driver, "-o", executable], { signal: t.signal });
    const native = JSON.parse(await run(executable, [new URL("ios/Lucid/Lucid/Resources/professional-content.json", root).pathname, join(directory, "synthetic-learner")], { signal: t.signal }));
    const load = await typescriptLoader(directory);
    const [web, catalog] = await Promise.all([load("lib/web-learning-ui.ts"), load("lib/professional-content.ts")]);
    const kinds = { chooseWord: "Meaning choice", completeSentence: "Sentence completion", spotMistake: "Spot incorrect guidance" };
    const expectedPositions = catalog.professionalLearningPaths.flatMap((path) => path.modules.flatMap((module) => module.lessons.flatMap((lesson) => lesson.wordIds)).map((wordId, courseIndex) => ({ roleId: path.roleId, wordId, courseIndex })));
    assert.equal(native.length, 720);
    assert.equal(expectedPositions.length, 720);
    assert.equal(new Set(native.map((item) => `${item.roleId}:${item.wordId}`)).size, 720);
    const observedKinds = new Set(), answerPositions = new Set();
    for (const [index, position] of expectedPositions.entries()) {
      const nativeChallenge = native[index];
      const label = `${position.roleId}/${position.wordId} at course position ${position.courseIndex}`;
      assert.deepEqual({ roleId: nativeChallenge.roleId, wordId: nativeChallenge.wordId, courseIndex: nativeChallenge.courseIndex }, position, `Native resource order changed: ${label}`);
      const word = web.contextualWord(position.wordId, position.roleId);
      assert.ok(word, label);
      const challenge = web.createTapChallenge(word, position.roleId);
      assert.deepEqual(web.createTapChallenge(word, position.roleId), challenge, `Web resume changed answer identity: ${label}`);
      assert.deepEqual({ kind: challenge.kind, correctId: challenge.correctId, optionIds: challenge.choices.map((choice) => choice.id) },
        { kind: kinds[nativeChallenge.kind], correctId: nativeChallenge.correctId, optionIds: nativeChallenge.optionIds },
        `Web/native challenge identity differs: ${label}; native signature ${nativeChallenge.signature}`);
      assert.equal(challenge.choices.length, 3, label);
      assert.equal(new Set(challenge.choices.map((choice) => choice.id)).size, 3, label);
      assert.equal(challenge.choices.filter((choice) => choice.id === challenge.correctId).length, 1, label);
      observedKinds.add(nativeChallenge.kind);
      answerPositions.add(nativeChallenge.optionIds.indexOf(nativeChallenge.correctId));
    }
    assert.deepEqual([...observedKinds].sort(), ["chooseWord", "completeSentence", "spotMistake"].sort());
    assert.deepEqual([...answerPositions].sort(), [0, 1, 2]);
    assert.equal(new Set(native.map((item) => item.roleId)).size, 8);
  } finally {
    await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});
