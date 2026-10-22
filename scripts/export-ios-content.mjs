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

// Both clients use the same authored, deterministic expression curriculum.
const expressionPath = resolve(root, "lib/expression-content.ts");
const expressionSource = await readFile(expressionPath, "utf8");
const expressionCompiled = ts.transpileModule(expressionSource, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  fileName: expressionPath,
});
const expressionModule = await import(`data:text/javascript;base64,${Buffer.from(expressionCompiled.outputText).toString("base64")}`);
const expressionOutput = resolve(root, "ios/Lucid/Lucid/Resources/expression-content.json");
await writeFile(expressionOutput, `${JSON.stringify(expressionModule.getExpressionPracticeContent(payload.words), null, 2)}\n`, "utf8");
console.log("Exported shared expression practice curriculum");

// Daily idioms have their own stable IDs and never replace course word content.
const idiomPath = resolve(root, "lib/daily-idioms.ts");
const idiomSource = await readFile(idiomPath, "utf8");
const idiomCompiled = ts.transpileModule(idiomSource, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  fileName: idiomPath,
});
const idiomModule = await import(`data:text/javascript;base64,${Buffer.from(idiomCompiled.outputText).toString("base64")}`);
const idiomOutput = resolve(root, "ios/Lucid/Lucid/Resources/daily-idioms.json");
await writeFile(idiomOutput, `${JSON.stringify({ schemaVersion: 1, idioms: idiomModule.dailyIdioms }, null, 2)}\n`, "utf8");
console.log(`Exported ${idiomModule.dailyIdioms.length} shared daily idioms`);

// Korean learning support has stable role/word identities; English content stays canonical.
const localeModuleNames = ["learning-locale-copy", "korean-idioms", "korean-words-business", "korean-words-people", "korean-words-health"];
const localeModules = {};
for (const name of localeModuleNames) {
  const path = resolve(root, `lib/${name}.ts`);
  const source = await readFile(path, "utf8");
  const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022},fileName:path});
  localeModules[name] = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`);
}
const koreanWords = {...localeModules["korean-words-business"].koreanBusinessWords,...localeModules["korean-words-people"].koreanPeopleWords,...localeModules["korean-words-health"].koreanHealthWords};
const localePayload = {schemaVersion:1,locales:["en","ko"],koreanUI:localeModules["learning-locale-copy"].koreanLearningUI,koreanWords,koreanIdioms:localeModules["korean-idioms"].koreanIdiomTranslations};
await writeFile(resolve(root,"ios/Lucid/Lucid/Resources/learning-locales.json"),`${JSON.stringify(localePayload,null,2)}\n`,"utf8");
console.log(`Exported Korean support for ${Object.values(koreanWords).reduce((n,words)=>n+Object.keys(words).length,0)} role senses and ${Object.keys(localePayload.koreanIdioms).length} idioms`);
