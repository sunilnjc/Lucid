# Daily words and idioms — local acceptance, 15 October 2026

This batch is implemented in `/Users/Sunil/Developer/Lucid` and has **not been published or installed on the owner's phone**. Public version 5, hosted Supabase, authentication settings and reminder subscriptions are unchanged. No existing record conversion or hosted migration was needed. See [DAILY_VOCABULARY.md](DAILY_VOCABULARY.md) for the feature contract.

## Delivered behavior

Today distinguishes **Today's Words**, **Today's Idiom**, **Review** and the existing **Courses** destination. The role-specific daily word collection starts with five entries and exposes three additional pinned entries only on request. The first five retain their identity; day/role/account changes reject stale actions. One global daily idiom uses the same 14-entry canonical catalogue and daily rotation on both clients.

Meanings, pronunciation where authored, examples and idiom register/context/plain alternatives come from canonical content. Private attempts are retained before guidance is revealed. Exploring is separate from successful review, mastery and XP. Explicit review enrollment schedules a later date without awarding credit. Idiom self-checks use the existing 1/3/7/14/30-day intervals in their own local schedule; guidance-first empty originals cannot become independent after editing or backup import. Existing role evidence without an introduction anchor is preserved. The chosen 1–3-word course pace is unchanged.

The optional local sidecar is excluded from normal cloud projections and retained by explicit portable backups. Export/import share a 2,000,000-byte cap without pruning records. Unsupported future daily versions block downgrade writes, including recovery paths. Failed writes retain recoverable work and block dependent actions.

## Automated evidence

- Final production web build, generated runtime types/TypeScript, repository ESLint and whitespace checks passed.
- **259 Node test entries passed, zero failures/skips.** This includes the disposable PostgreSQL fixtures, actual native tap parity across 720 course positions, and actual compiled Swift/web daily selection and idiom parity across 80 role/date/exclusion cases. Final logs: `.build/qa/2026-10-15-daily/daily-all-node-tests.log`, `daily-web-build.log`, `daily-typecheck.log`, `daily-eslint.log`.
- The full native regression run passed **254 groups across 15 suites** before the final backup size/future-version guards. After those guards, **70 affected groups across 3 suites** passed, including **22 daily behavior groups**. These are overlapping runs, not additive totals. Metadata and final source hashes: `.build/qa/2026-10-15/daily-native-verification.json`.
- Actual SwiftUI app/test builds passed in the separate auth-disabled QA project. The final normal-size synthetic guest XCTest passed (one test, no failures/skips; 81.589 seconds). It checked discoverability, minimum tap targets, five-to-eight identity, private recall/reveal/enrollment, idiom enrollment, return navigation and relaunch persistence. The final due-idiom Review XCTest passed (one test, no failures/skips; 33.282 seconds). The final maximum Dynamic Type journey passed (one test, no failures/skips; 46.090 seconds), including actual word-row bounds, after correcting intrinsic-width overflow in existing Today challenge/dashboard rows; text wraps and scrolling remains available. The large-text rows use adaptive layouts while the normal arrangement remains intact. After all native UI/copy edits, 17/17 focused iOS source/regression Node checks also passed. Final simulator evidence and result paths: `.build/qa/2026-10-15-daily/native-ui-evidence.json`.

## Rendered web acceptance

Actual local browsers: **Chrome** for the desktop overview and **Codex In-app Browser** for the complete interactive journey at `http://127.0.0.1:4362/`. The local Worker uses disposable state under `.build/daily-preview-state`; shared auth is disabled. Chrome input commands were intermittent, so the complete interaction checks used the in-app browser. This is a browser-tool limitation; the same frozen app completed the in-app journey.

A synthetic Finance learner selected a one-word course pace. At 390 × 844, the browser verified five initial words, explicit expansion to eight with unchanged first-five IDs, private writing before reveal, explicit word/idiom review enrollment, Back and repeated reopen, and persistence after a full reload. It retained all eight IDs, the locked original sentence and enrollment; course practice remained 0/1. Today's idiom was **raise the bar**, with next self-check 2026-10-16 after explicit enrollment. Same-day Review correctly showed no due item. The idiom page measured 390 pixels of content width for a 390-pixel viewport; daily overview entries measured 354 × 135.55 pixels.

The verified Finance collection was oversight, proportionate, rationale, remediate, salient, with optional sensitivity, substantiate and trajectory. These are editorially selected advanced vocabulary, not a validated proficiency assessment. The finite catalogue rotates; it does not promise never-repeated words.

## Screenshots

All files are under `.build/qa/2026-10-15-daily/`.

- `lucid-daily-web-overview-390.jpg`: real 390 × 844 viewport with clear daily entries; the optional install suggestion was dismissed to its compact state.
- `lucid-daily-web-five-390.jpg`, `lucid-daily-web-word-guidance-390.jpg`, `lucid-daily-web-idiom-390.jpg`: actual daily browser states.
- `native-daily-today-overview.png`, `native-daily-five-words.png`, `native-daily-eight-words.png`, `native-daily-optional-three.png`: simulator collection/navigation states.
- `native-daily-word-guidance.png`, `native-daily-idiom-guidance.png`, `native-daily-review-with-idiom.png`, `native-daily-idiom-self-check.png`, `native-daily-review-next-day.png`: actual guidance and delayed self-check states.
- `native-daily-large-text-today.png`, `native-daily-large-text-words.png`: maximum Dynamic Type layout evidence.

The disposable simulator used `com.sunilnjc.lucid.uiqa` and contained only synthetic guest content; it was shut down, deleted and verified absent after testing. Owned browser tabs were closed, the temporary viewport override was reset, and local preview listeners on ports 4361/4362 were stopped. The due-idiom fixture alters only that QA record; it does not change the OS clock. Physical iPhone acceptance, VoiceOver operation, hosted synchronization and publication are outside this local batch and were not performed. The historical `IMPLEMENTATION_QA.md`, original `LOCAL_DEVELOPMENT.md` and `ios/AppStore/AUTH_SETUP.md` remained byte-identical to their starting hashes.
