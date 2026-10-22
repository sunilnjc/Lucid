# Korean localization acceptance — 15 October 2026

Local implementation in `/Users/Sunil/Developer/Lucid`. This report concerns the Korean learning-support batch, alongside the existing local daily vocabulary work. Public version 5, owner phone, hosted Supabase settings/migrations, credentials and paid services were not changed.

## Scope and editorial validation

Korean navigation, onboarding, Today, daily Words/Idiom and Review instructions are implemented on web and native. The shared catalogue has support for all 731 role-specific senses across 472 canonical IDs and eight roles, plus all 14 idioms. The English course and idiom sources are preserved. The UI catalogue contains 614 Korean strings; this is a coverage count, not evidence of linguistic correctness.

Parallel authoring was followed by independent agent review of every role-sense meaning/usage pair against the actual canonical context, all idioms and the complete UI dictionary. Corrections clarified Consulting discrepancy, healthcare prognosis and psychological safety, the distinction between an unsaved original and an unwritten answer, and learn-the-ropes usage. Specialist checks used primary sources listed in the translation files, including IFRS, Google SRE, NHS, AHRQ, NCI/MedlinePlus and CIPD. This is agent editorial review, not certified human Korean or professional review. Retained review records: `.build/ko-business-independent-review.json`, `.build/ko-people-independent-review.json`, `.build/ko-health-independent-review.json`, `.build/ko-ui-independent-review.json`.

Course questions/narratives, Express scenarios, Library/Progress details, account controls, detailed settings, PWA installation messages, privacy and support remain English where disclosed. Only en/ko learning locales are implemented. See KOREAN_LOCALIZATION.md for maintenance.

## Automated verification

- Production web build: passed (`web-build.log`). Existing toolchain deprecation/chunk-size advisories remain; no build errors.
- TypeScript and repository ESLint: passed (`web-typecheck.log`, `eslint.log`).
- Final Node regression suite with the existing disposable PGlite fixture: **277 passed, zero failures/skips**, including shared-account security, persistence, backups and actual native/web tap-generator parity (`all-node-tests-with-sql-final.log`). The first run found three source-label assertions that assumed literal English; those assertions now accept the exact localization wrapper while retaining their original action/accessibility checks. An intermediate run without the fixture skipped seven fixture entries; the final run includes them.
- Focused localization checks verify exact role-sense and idiom coverage, no extra keys, nonempty Hangul support, named-placeholder parity, missing/malformed/prototype-key fallback, generated native resource equality, actual rendered bilingual word/idiom components, reveal gating, URL navigation preservation and language-only storage. They do not alone establish semantic correctness.
- Native affected suites: 7 localization +22 daily vocabulary +21 shared-sync groups passed. All app Swift sources also typechecked for the iOS simulator, and canonical Xcode source/resource registration validated.
- Final complete native suite: **264 behavior groups across all 16 suites passed**, exit 0, no failures/compiler errors (native-all-tests-final.log).
- Native simulator: final guidance/layout checkpoint **1/1 passed, zero failures/skips, 74.031 seconds** (native-run/KoreanGuidanceLayout.xcresult and xcodebuild-guidance-layout.log). Earlier partial journey milestones and their harness failures are distinguished below.

All logs above are under `.build/qa/2026-10-15-korean/` unless otherwise noted.

## Actual web acceptance

Codex In-app Browser, local production build on loopback, 390×844 viewport, existing synthetic Finance guest record. No real learner text or external AI request was used.

- Upgrading the existing record retained the Finance role, one-word course pace, 8 pinned daily word IDs, prior explored word and daily idiom, and pending review schedules.
- Filled an unrevealed proportionate card with a fictional private sentence. English/Korean switching retained it and kept both definitions hidden. Reopened the app without a lang query: Korean remained selected, the same sentence and word collection returned, and the original course pace remained unchanged.
- Revealing the card locked the exact original and showed English meaning/example with the Korean meaning and usage. Daily exposure rose from one to two; course guided completion remained 0/1.
- The previously explored raise-the-bar idiom displayed bilingual meaning, register, context, plain-English alternative and caution while retaining its existing private response and next self-check date.
- Review showed Korean instructions, its unchanged empty current-day queue, and the existing 1/3/7/14/30-day explanation. No fresh review credit was manufactured.
- No horizontal overflow on Today or Review: document width equalled the 390-pixel viewport. Actual word/idiom screenshots show Korean wrapping. Language buttons remain visible and usable.
- Browser viewport override reset and owned QA tab closed after inspection.

Screenshots retained locally: `lucid-korean-web-overview-390.jpg`, `lucid-korean-web-word-390.jpg`, `lucid-korean-web-idiom-390.jpg` in the QA directory. These are real browser captures, not mockups.

## Remaining acceptance limits

Physical iPhone install/use, human VoiceOver testing, certified Korean/professional editorial review, real two-device hosted sync, production email and hosted offline installation were not repeated for this local batch. The existing public release remains separate. Simulator acceptance and private Library delivery are recorded below.

## Actual native acceptance

Auth-disabled com.sunilnjc.lucid.uiqa in a newly created iPhone 17e simulator (iOS 26.5); no owner device, existing simulator, Keychain session or real account used. Product source stayed frozen. The disposable simulator 98B3394D-7DC1-4AE8-9244-F97087BB8E46 was deleted after capture; native-run/simulator-cleanup.txt records success.

The initial journey reached Korean Welcome/onboarding, selected Finance with a one-word course pace, verified all four normal-size Today destinations were visible/hittable with at least 44-point height, expanded five words to eight stable unique IDs, and entered a private draft while definitions remained hidden. English Settings retained the role and pace. Returning to the word kept the exact draft. These were observed milestones in partial runs, not passing full end-to-end test results. Early harness failures involved overscrolling, virtualized Form rows/pickers and ambiguous SwiftUI accessibility descendants; only the test helpers/selectors changed.

A continuation verified English→Korean switching, the same eight IDs and private unrevealed draft across two relaunches, then captured the revealed English word/meaning/example alongside the Korean meaning and usage. Its later ambiguous idiom selector was narrowed before the final checkpoint. The **passing final guidance/layout checkpoint** verified the frozen original again, English idiom source with Korean guidance present, and the largest accessibility Dynamic Type category. All four Today destination controls were reachable, at least 44 points high and within the 390-point device width; the same eight words and first row remained within bounds. At maximum text size the destinations require scrolling; they are not all simultaneously visible.

Actual exported native screenshots: native-korean-today-overview.png, native-korean-word-guidance.png, native-korean-word-example.png, native-korean-idiom-guidance.png, native-korean-large-text-today.png, native-korean-large-text-words.png, native-korean-final-word-guidance.png. native-screenshots.json records source attachments. The idiom capture places its Korean explanation below the fold, so the web idiom and native word captures are clearer delivery evidence. No screenshots were retouched.

## Private Library delivery and cleanup

Four verified synthetic screenshots were saved as new private Library images, version 0, with identity metadata applied successfully to each original local file. Sharing was not changed. The prepared-upload helper failed during tool discovery before any prepare call; the available direct ordered batch completed all four writes. No uncertain write was retried.

| Screenshot | Library ID | File ID | Version |
| --- | --- | --- | --- |
| lucid-korean-web-word-390.jpg | libfile_8fd18d4c40a481919c213108bbf29c93 | file_000000003b98824691ce2384d3ae0341 | 0 |
| lucid-korean-web-idiom-390.jpg | libfile_40a92900c5f88191a1c3fba50d41a2ea | file_000000001bf081f4809c1ed077e452fc | 0 |
| native-korean-today-overview.png | libfile_933e0341b6848191ab2babb6a0f23ce9 | file_00000000b2908211809287e50461820e | 0 |
| native-korean-word-guidance.png | libfile_50b7e164b3f481918073c5a049ff7451 | file_000000007b448211b29fa0139437f49f | 0 |

The owned local preview stopped, its loopback listener closed, browser viewport override reset and QA tab closed. Historical IMPLEMENTATION_QA.md, LOCAL_DEVELOPMENT.md and ios/AppStore/AUTH_SETUP.md retain their pre-batch hashes. No deployment, phone installation or hosted configuration/migration occurred.
