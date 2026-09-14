import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const sourcePath = resolve(root, "lib/professional-content.ts");
const outputPath = resolve(
  root,
  "ios/Lucid/Lucid/Resources/professional-content.json",
);

const source = await readFile(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourcePath,
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`;
const content = await import(moduleUrl);
const payload = {
  schemaVersion: 1,
  roles: content.professionalRoles,
  seniorityLevels: content.seniorityLevels,
  goals: content.communicationGoals,
  words: content.professionalWords,
  learningPaths: content.professionalLearningPaths,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(
  `Exported ${payload.words.length} words, ${payload.roles.length} roles, and ${payload.goals.length} goals to ${outputPath}`,
);
