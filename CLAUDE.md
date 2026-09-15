# Lucid development handoff

Read `AGENTS.md` first and follow its local-storage and data-preservation rules. On Sunil's Mac, the active checkout is `/Users/Sunil/Developer/Lucid`; do not recreate the former iCloud/Documents checkout. Keep paid plans off unless explicitly authorized.

## Current delivery

- Native SwiftUI iOS app: `ios/Lucid/Lucid.xcodeproj`, scheme `Lucid`, bundle `com.sunilnjc.lucid`.
- Version 1.0, build 2 installed **in place** and launched on the owner's iPhone on 14 September 2026. Do not uninstall/reset it to deliver future builds.
- Eight professional courses, each with 90 word/phrase entries, six chapters and 30 lessons. Shared catalogue: 472 distinct entries; role-specific contexts retain shared word IDs.
- Optional six-question starting check, kept separate from career stage, mastery and XP.
- Daily tap-first practice: meaning choices, sentence completion and incorrect-guidance checks; automatic saving, wrong-answer feedback, Help, Continue, Pause/Skip/resume. Writing/speaking is an optional stretch. Bookmarking is separate from learning credit.
- New mint-on-midnight folded-L icon/header. Review and Library default to the selected role; other-role content requires opt-in.
- The web app shares the catalogue but does **not** yet have native course/starting-check/tap-flow UI parity. GitHub pushes are not permission to publish website changes.

## Code and persistence

`lib/professional-content.ts` is the canonical course source. After changing it, run `npm run ios:content`; never independently edit the exported `ios/Lucid/Lucid/Resources/professional-content.json`.

Native behavior lives in `LearningStore.swift`, `PracticeChallenges.swift`, `LearningPersistence.swift`, `LocalBackup.swift` and `AccountService.swift`. UI lives in `RootView.swift`, `LearningPathViews.swift`, `SecondaryViews.swift`, `ExperienceViews.swift` and `SettingsView.swift`.

Retain v2 compatibility, word IDs, role plans, bookmarks, review schedules and history. Guided practice is not independent recall/mastery. Daily completion bonus is awarded only once across roles. Failed local writes keep recoverable memory and block advancing. Account/role/day guards reject stale UI actions.

Tap answers/cursors and unfinished checks/drafts remain device-local and are stripped from cloud payloads. Completed learning and starting-point preferences can sync. Never import guest work into an account without consent. Do not deploy the proposed nested-payload SQL until its disposable-database tests pass.

## Accounts and secrets

The existing Free Supabase project and Resend email delivery support private Debug sign-in. Release authentication/email flags remain **NO/NO**. Do not enable public auth without completing the release gates and user authorization.

Private `ios/Lucid/Config.local.xcconfig` exists only on the owner's Mac and is intentionally absent from Git. A new clone uses `Config.example.xcconfig` as a setup guide; guest/local development does not require production credentials. Never commit credentials, local databases, learner backups, Xcode user state, or build output. Never request secret values in chat. See `ios/AppStore/AUTH_SETUP.md`.

## Run and verify

- Use `LOCAL_DEVELOPMENT.md` for setup. Keep the same Node runtime for `npm ci` and builds; avoid mixing x64 and arm64 native dependencies on this Mac.
- Web: `npm run build`, then `npm run typecheck` (the latter needs generated build configuration).
- Native regression suite: `npm run ios:test`.
- Lightweight checks: `node --test tests/ios-app.test.mjs tests/ios-auth-delete.test.mjs tests/ios-usability.test.mjs tests/ios-email-templates.test.mjs`.
- Repeatable isolated simulator journey: `tests/ios-ui/README.md`. It uses a separate auth-disabled QA bundle, never the user's phone data.
- Build locally in Xcode or use ignored `.build/` for derived output. Discover connected devices instead of hard-coding an old device/simulator ID.

Last full verification (14 September): 182 native behavior groups, 20 Node entries, the end-to-end simulator journey, signed Debug iPhone build, Release simulator build, web build and TypeScript check passed. The 20 Node entries and diff whitespace checks were rerun before this GitHub handoff on 15 September. See the **top** of `ios/AppStore/QA_REPORT.md`; older sections are historical and describe older behavior.

## Next release gates

The agreed courses → tap-first practice → logo batch is implemented; this is not App Store approval. Prioritize hands-on physical account/reconnect/two-device/backup acceptance, VoiceOver and large-text testing, permissions/offline/low-storage scenarios, professional/healthcare editorial review and a small learner pilot. Current sentence feedback is a limited pattern checker, not semantic or AI grading.

Read `ios/AppStore/LAUNCH_READINESS.md`, `PROFESSIONAL_COURSES.md`, `DAILY_PRACTICE.md` and `BRAND.md` for scope and remaining limits. New features, public deployment, live backend changes and account deletion need their own task authorization.
