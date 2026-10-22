# Lucid web publication — version 7 live, 15 October 2026

Version **7** is live at [Lucid](https://lucid-vocabulary-sunil.sunilkumar-kalabandi.chatgpt.site), retaining version 6’s daily Words (five plus three optional), daily Idiom and partial Korean learning support. Version 7 adds the narrow language-query PWA fallback described in the appended follow-up. The following version-6 publication and acceptance record is preserved as historical evidence; its offline limitation describes that run, and hosted offline acceptance remains unverified.

## Published release

- Site: `appgprj_6a833d823f0481919f479e812c7998e8`; existing owner/public audience and database binding retained.
- Version: **6**, saved ID `appgprj_6a833d823f0481919f479e812c7998e8~appgver_b7d66116954c8191a5c97e2edc9c099b`.
- Exact pushed source: `d3b122c07046d783bc638118b0155566ddfbd7a3`.
- Deployment: `appgdep_6ad102866f888191b341cfdfd8b506c1`, confirmed `succeeded` at `2026-10-15T16:42:58.339652+00:00`; no failure message; environment revision 0.
- [English introduction](https://lucid-vocabulary-sunil.sunilkumar-kalabandi.chatgpt.site/en), [Korean introduction](https://lucid-vocabulary-sunil.sunilkumar-kalabandi.chatgpt.site/ko) and [Korean learning entry](https://lucid-vocabulary-sunil.sunilkumar-kalabandi.chatgpt.site/start?lang=ko).

The official Sites helper packaged the isolated curated checkout `.build/site-release-20261015`, starting from version 5 source `20576b518af84f7174a545430c876951ea48a4cb`. Sixty-six approved web, asset, build and focused-test files were copied byte-for-byte from tested canonical source. Native source, dependencies, hosted account/state routes, SQL migrations and hosting bindings were not changed from the previous remote release. The previous release checkout was retained. The original GitHub repository was not pushed; canonical HEAD remains `f6e9bffc5530091205142ecc904092ccc0b4dc64`.

## Release verification

| Check | Result |
| --- | --- |
| Complete canonical Node suite, rerun for publication | 277 passed, 0 failed, 0 skipped |
| Official production build | Passed |
| TypeScript and repository ESLint in curated release | Passed |
| Focused staged checks | 62 passed, 0 failed, 0 skipped |
| Anonymous live HTTP acceptance | 36/36 passed |
| Public precache paths | All 29 available: shell, manifest and 27 assets |
| Archive inspection | 285 regular files; no private config, runtime data, unsafe paths or symlinks |
| Web source manifest | All 66 canonical/staged hashes match the tested inputs |

Build output retained the existing chunk-size/deprecation warnings. No dependencies were installed. The full Node run used the already available local PGlite runtime. Seven Drizzle SQL/snapshot/journal files, account/state routes, package files, Worker/database configuration and Sites bindings were independently checked against version 5 and remained byte-identical.

Release archive: `.build/qa/2026-10-15-publication/lucid-site-release-20261015.tar`, 4,455,610 bytes, SHA-256 `e0e561a26c6609ae12c3400af788b35007986146a309213323a007aa9859cfc5`. The official archive has a `dist/` prefix, `dist/.openai/hosting.json` and `dist/server/index.js`. Sites normalized stored archive metadata is recorded separately in `release.json`.

## Hosted browser acceptance

Verified using Codex In-app Browser (browser 3), a fresh guest and fictional QA text. Existing user learners were not cleared or overwritten. Finance / experienced contributor / month-end close / one course word per day were selected through Korean onboarding.

- Korean landing CTA preserves `lang=ko`; all five setup steps and learning navigation work.
- Daily Words begins with oversight, proportionate, rationale, remediate and salient. Opting into three extras adds sensitivity, substantiate and trajectory: eight distinct terms.
- Meanings stay hidden before reveal. A fictional private oversight sentence survives English → Korean switching, and reveal preserves its original text while displaying English meaning/example and Korean meaning/usage notes.
- Reload preserves Korean, role, course pace, the same eight words, the one-explored count and the revealed original sentence.
- Words → Today → daily Idiom → Review navigation works. “raise the bar” accepts a fictional private attempt, then reveals bilingual meaning, register, use, plain-English alternative and caution.
- Review displays Korean instructions and no reviews due after exposure alone. Progress displays 0 contexts started, 0 independent productions, 0 retained recall and 0 effort points; the one-word course remains incomplete.
- At 390 × 844, document width and scroll width both equal 390. The live first-word card was visually inspected. The temporary viewport override was reset.

These are focused hosted acceptance observations, not an exhaustive new browser test suite. The existing native simulator/unit evidence remains in [KOREAN_LOCALIZATION_QA.md](KOREAN_LOCALIZATION_QA.md) and [DAILY_VOCABULARY.md](DAILY_VOCABULARY.md); native tests were not rerun for this web-only publication.

## Screenshot deliverable

The live bilingual daily Words screenshot contains fictional QA text only and was saved privately in Library; no public share was created.

- File: `lucid-live-korean-daily-words.jpg`
- Library ID: `libfile_c89ec9af07088191a90a63845f7c6544`
- File ID: `file_00000000242881f5931d2ec2ee3ea079`
- Current Library version number: **0**
- Local file and Library identity metadata: `.build/qa/2026-10-15-publication/lucid-live-korean-daily-words.jpg`

## Limits and follow-up

Partial Korean scope remains explicit: course questions/narratives, Express scenarios, Library/Progress details, account controls, detailed settings, PWA installation messages, privacy and support remain English where disclosed. English terms and examples are preserved.

Actual hosted offline startup and physical PWA installation are **not accepted** by this run. The in-app browser reported offline setup not ready. Read-only HTTP checks confirm all public assets are available, but that does not prove service-worker installation. Source inspection also found that the service-worker navigation allowlist accepts `view` and `source` query keys but excludes `lang`; language-bearing URLs therefore do not receive its offline navigation fallback. The manifest's root launch remains eligible and uses the device-local language preference. Record this as a follow-up; do not advertise full offline acceptance.

Shared sign-in/email and automatic native/web account synchronization remain disabled (`enabled=false`, `emailReady=false`, anonymous identity/email null). No Supabase migration/security setting, runtime environment, provider, credential, paid service, phone installation, App Store or social-publication action changed.

## Local evidence

All generated evidence is in ignored `.build/qa/2026-10-15-publication/`: `canonical-node-tests.log`, `site-workflow.log`, `web-source-manifest.json`, `package-audit.json`, `live-http.json`, `live-browser.json`, `release.json`, `library-screenshot.json` and the release archive/screenshot. The HTTP harness used installed system curl with TLS verification after Python's local CA store failed; no browser security bypass occurred. Browser-tool telemetry errors were unrelated to the Lucid page.

Historical `IMPLEMENTATION_QA.md`, `LAUNCH_QA.md`, `LOCAL_DEVELOPMENT.md` and `ios/AppStore/AUTH_SETUP.md` were preserved.

## Version 7 follow-up — supported PWA language URLs

Deployment succeeded on 15 October 2026 at `2026-10-15T16:59:08.753026+00:00`, environment revision **0**. Public URL and audience are unchanged.

- Saved version: **7**, `appgprj_6a833d823f0481919f479e812c7998e8~appgver_f2089c64d0bc819181feaf8fa86f1fb6`.
- Exact source: `3e405662ae4d5cd4e745a61c3eba8b6c92ea2641`.
- Deployment: `appgdep_6ad10650dea881918fc4b4b6ca928add`, confirmed succeeded.
- Baseline: version-6 source `d3b122c07046d783bc638118b0155566ddfbd7a3`; exactly `public/sw.js` and `tests/pwa-install.test.mjs` changed in the released source.
- Generated public cache: `lucid-public-v4-fac56b5f2e7caa7e`.

The worker now accepts exactly one `lang=en` or `lang=ko` query on the already supported `/` and `/app-shell.html` navigation routes, alongside the existing `view`/`source` keys. Unknown query keys, invalid language values, duplicate lang parameters, authentication/token queries, API routes and unsupported paths remain excluded. Navigation stays network-first and navigation HTML is never stored in the public cache. This fixes the version-6 language-query eligibility issue without broadening private-response caching.

Production build, TypeScript, repository ESLint and **23 staged PWA tests** passed with zero failures/skips. The tests cover language-bearing offline fallback, unchanged online URLs, exclusion rules, missing-shell behavior, emitted production worker behavior and a changed worker producing a new release cache. **70 focused canonical account/state/UI integration checks** also passed with zero failures/skips; log: `.build/qa/2026-10-15-pwa-lang/canonical-account-state-tests.log`. Live HTTP acceptance passed **103/103 checks**. All **29 public precache paths** returned 200, and the deployed worker was byte-identical to the staged worker: SHA-256 `79b49c18302ee7d851c991d67df05c1c74f806f813c379d1af5dcf4f9c124d4e`. These are focused follow-up results; the earlier full-suite counts remain version-6 evidence.

Archive: `.build/qa/2026-10-15-pwa-lang/lucid-site-pwa-lang.tar`, **4,455,234 bytes**, SHA-256 `00b3091fad957dac9163da9378ac85aa3e288c41ced9c3a99422c684f3b354ca`; **285 regular files** audited.

Actual hosted online readiness and update acceptance were verified in **Codex In-app Browser**, browser 3, tab 8. The existing synthetic Finance learner first showed offline setup not ready and an Update app action. Accepting that action normally activated the update and reloaded online; the app then displayed “Offline app ready on this browser. Account sign-in still needs a connection.”

After the update, Korean remained selected and the Finance/experienced profile remained intact. Progress still showed 0 contexts started, 0 independent productions, 0 retained recall and 0 effort points; Today retained the one-word course at 0/1. Daily Words retained the same eight words with one explored. The idiom remained explored with 0 reviews due. The previously revealed oversight card preserved the exact original: “Fictional QA: oversight helps our sample team review the process.” No new attempts or reviews were awarded. A 1280 × 720 screenshot showing the readiness banner and Korean Words is retained at `.build/qa/2026-10-15-pwa-lang/lucid-v7-offline-ready.jpg`.

Actual hosted network-offline startup, cold offline launch and physical PWA installation remain **unverified**. Online cache readiness and a normal update/reload do not establish these outcomes. Remaining English scope, guest/backups behavior, inactive shared sync, Supabase settings/migrations and the owner's phone are unchanged. Canonical protected-file hashes and original GitHub HEAD remain unchanged. The historical version-6 record above has not been rewritten.
