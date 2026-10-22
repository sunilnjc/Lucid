# Lucid canonical-domain UI publication — 22 October 2026

**Published:** version **8** is live at [learnwithlucid.com](https://learnwithlucid.com), including [Korean idiom browsing](https://learnwithlucid.com/?lang=ko&view=idioms). This release exposes the existing 14 authored idioms through a dedicated destination and makes Library/idiom browsing use search/filter → English A–Z sort → pages of at most 20. Daily curated assignments and existing learner progress are preserved. Public shared sign-in remains disabled; this publication does not activate the separate backend setup.

## Authorization and exact provenance

The user authorized the canonical-domain release and separately approved one short-lived source-repository credential for the existing Lucid hosting project. No replacement hosting project or alternate finished-product URL was created. The credential was kept in session memory, supplied through the official helper’s hidden stdin, never written to a file/log, and cleared from the session store after publication.

- Existing Site: `appgprj_6a833d823f0481919f479e812c7998e8`, owner/public audience preserved.
- Verified GitHub source: `a41997130230b4386c39d418512072c6c9fcdc8d`; implementation commit `6cae19c9bbca457602fceaeec1bde3fefc83f576` in `sunilnjc/Lucid`.
- Fresh official source opening: version-7 base `3e405662ae4d5cd4e745a61c3eba8b6c92ea2641`.
- Exact pushed Site source: `425c31f6994a98a415af59c17265700919457f82`.
- Saved version ID: `appgprj_6a833d823f0481919f479e812c7998e8~appgver_dda0e1bce0c481918d57d7da2596a45b`, number **8**.
- Deployment: `appgdep_6ada247f73b48191acc484f275366310`, **succeeded**, `2026-10-22T14:58:26.237139+00:00`, runtime environment revision **0**.

The official Sites workflow opened a new ignored checkout at `.build/site-release-20261022-ui`, curated 13 runtime web files and focused tests/record from the verified GitHub commit, committed/pushed that source, then packaged its matching build. Existing hosted native files, Drizzle SQL/journal, D1 source and `.openai/hosting.json` remained byte-identical to the version-7 base. The active canonical dirty checkout and owner’s installed phone app were preserved.

Local archive: `.build/site-archives/lucid-20261022-ui.tar.gz`, 4,468,783 bytes, SHA256 `b15f17879c65dee7ee83410c941e6967cb748e14fd0db6f15c92d5aaf3d20eed`. Local archive inspection found 289 regular files, no links/private paths, and the matching project manifest/worker/shell. The saved-version tool separately returned archive format `tar`, content hash `sha256:bdc457158873768617bc6e87c5e4bead2a971dd60504f7b9a40b20660de17207`, 8,970,240 bytes and 133 files. These service-reported metrics are retained verbatim alongside the local compressed-file metrics; deployed asset bytes were checked independently below.

## Validation on the curated source

- Production build, TypeScript, repository ESLint and whitespace checks passed.
- **108** focused account sequencing, account isolation/recovery, Korean rendered UI, idiom discovery and pagination tests passed.
- **45** retained PWA, introduction, rendered-page and hosted-native-baseline checks passed.
- Total curated Node entries: **153 passed, zero failures/skips**. The broader GitHub/native verification is recorded separately in `SIGNIN_IDIOMS_PAGINATION_2026_10_22.md`; this release did not replace the hosted historical native snapshot with current canonical native files.
- Publication audit found no private paths or credential patterns in eligible source/build packaging. All copied source bytes still matched the verified GitHub commit at packaging.

## Actual canonical-domain verification

Read-only anonymous HTTP checks used macOS `/usr/bin/curl` with normal TLS certificate verification. Python’s separate local certificate store failed before useful checks; no certificate validation was disabled. The resulting receipt covers 47 logical HTTP checks, with the expected public-shell redirect explicitly resolved.

- `/`, exact `/?lang=ko`, `/?lang=ko&view=idioms`, English idiom link, `/en`, `/ko`, privacy/support, manifest and worker resolve successfully.
- All **29** public precache files returned the exact tested bytes. `/app-shell.html` has the existing expected **307** redirect to same-origin `/app-shell`; following it returns **200** and the tested static shell bytes.
- Deployed service worker SHA256: `f03386576773a22bdd1dc3a5c2dbd326e36bedb90b018b851471aa1670b813eb`; cache: `lucid-public-v4-75d7e2fc5e81b637`. Public precache has no API/auth paths. No user cache was cleared and no waiting worker was forced to activate.
- HTTP apex, HTTP www and HTTPS www redirect **308** to canonical HTTPS apex while preserving `?lang=ko&view=idioms`.
- `/api/account/status`: **200**, `enabled:false`, `emailReady:false`, `identity:null`, `email:null`, `Cache-Control:no-store, private`.
- Unidentified `/api/state`: **401**, without querying a real learner record. New same-account reverification endpoints reject GET with **405**; no production account mutation was sent.

This publication made no runtime-variable, auth flag, DNS, mail, gateway, audience, tunnel, provider or phone-installation changes. Backend initialization/activation is a separate approved or pending workflow and is not established by this UI release.

## Verification limits and retained evidence

No browser control was available for actual desktop/mobile paging, keyboard focus, hosted session interaction, waiting-worker acceptance, cold offline startup or physical installation. Helper/SSR tests and exact hosted asset matches establish deployment/code delivery; they do not establish these interactive journeys. Real OTP/email delivery, hosted session restoration/logout/account switching, approved-account isolation and consented guest migration remain acceptance work before public sign-in activation. No real personal writing or learner records were sent to AI or modified during publication checks.

Retained local evidence under `.build/qa/2026-10-22-publication/`: `build.log`, `typecheck.log`, `lint.log`, `focused-tests.log`, `retained-regression-tests.log`, `prepublish-artifact-audit.json`, `packaged-artifact-audit.json`, and `canonical-live-http-receipt.json`. Build output and evidence remain ignored and local.
