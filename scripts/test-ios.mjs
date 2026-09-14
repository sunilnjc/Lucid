import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const directory = await mkdtemp(join(tmpdir(), "lucid-native-tests-"));
try {
  for (const suite of ["learning", "path", "auth-protocol", "auth-recovery", "learning-qa", "auth-qa", "role-switch", "role-switch-edge", "review-navigation", "library"]) {
  const executable = join(directory, `${suite}-tests`);
  const build = spawnSync("xcrun", [
    "swiftc", "-parse-as-library",
    "ios/Lucid/Lucid/Models.swift", "ios/Lucid/Lucid/LearningPersistence.swift",
    "ios/Lucid/Lucid/LearningStore.swift", "ios/Lucid/Lucid/AccountService.swift",
    "ios/Lucid/Lucid/LocalBackup.swift",
    `tests/native-${suite}-tests.swift`, "-o", executable,
  ], { stdio: "inherit" });
  if (build.status !== 0) { process.exitCode = build.status ?? 1; break; }
  else {
    const run = spawnSync(executable, ["ios/Lucid/Lucid/Resources/professional-content.json"], { stdio: "inherit" });
    if (run.status !== 0) { process.exitCode = run.status ?? 1; break; }
  }
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
