# Sign-in, guest exploration, idioms and pagination — 22 October 2026

**Version 8 is live on [learnwithlucid.com](https://learnwithlucid.com), including [Korean idioms](https://learnwithlucid.com/?lang=ko&view=idioms).** The guest-first and signup follow-up is locally verified and prepared for release, with public deployment still pending. Public shared sign-in remains disabled. GitHub follow-up: the source is tested locally; the verified implementation receipt is added below after push.

This record separates live delivery, prepared source, local verification and real-provider acceptance. Exact version-8 provenance is retained in [PUBLICATION_2026_10_22.md](PUBLICATION_2026_10_22.md); the new backend setup is recorded in [SUPABASE_SETUP_2026_10_22.md](SUPABASE_SETUP_2026_10_22.md).

## Delivered version 8

The user authorized the existing GitHub push and canonical-domain release, then approved one short-lived source-repository credential for that publication. It was used for the completed version-8 release; no replacement hosting project, DNS/mail change or alternate finished-product URL was introduced.

- GitHub implementation: `6cae19c9bbca457602fceaeec1bde3fefc83f576`; release-source checkpoint: `a41997130230b4386c39d418512072c6c9fcdc8d`.
- Sites source: `425c31f6994a98a415af59c17265700919457f82`.
- Deployment: `appgdep_6ada247f73b48191acc484f275366310`, succeeded; public version **8**, runtime environment revision **0**.
- Library/idiom search and filters run first, English-headword A–Z sorting second, then pagination at at most 20 entries. Stable IDs resolve ties; search/filter changes reset or clamp pages.
- A primary Idioms destination and Today shortcut expose all 14 authored idioms before onboarding. English examples and Korean guidance are visible; reference browsing earns no mastery or review credit. Daily curated order, IDs and schedules are preserved.
- All 29 public precache files match tested bytes; account/auth APIs are not precached. Canonical HTTP/www redirects preserve path/query. No learner cache was cleared or waiting worker forced to activate.

The curated hosted source passed build, TypeScript, ESLint and **153 tests**, zero failures/skips. The canonical HTTP receipt covers **47 logical checks**.

## Live version-8 desktop/mobile browser verification

An isolated fresh **Google Chrome 156.0.8078.47 headless profile on macOS** tested the live Korean idiom route at 1440px desktop and 390px mobile widths. **12/12 checks passed**:

- All 14 idioms appear in A–Z order; English headwords and Korean meanings remain visible.
- Neither viewport has horizontal overflow.
- Opening a detail focuses its heading; Back restores focus to the originating card.
- Korean search returns the matching idiom; unmatched search shows an empty state with a disabled single-page pager.
- Reference browsing has no account modal wall.

Receipt: `.build/qa/2026-10-22-guest-first/live-version8-catalog-browser-receipt.json`, with screenshots/hashes. The existing signed-in browser was not used and the owned browser was closed. State API requests were deliberately blocked to avoid production learning writes. These checks establish version-8 reference browsing, not delivery of the new guest-first source, canonical account sessions, physical touch hardware or installed/offline behavior.

## Locally verified guest-first and signup source

The user's latest direction is free public exploration with a modest guest-practice allowance and verified sign-in for durable saving. The locally verified source implements:

- Public word/idiom browsing before account/profile readiness; optional one-step role practice and personalization.
- A fresh tab-scoped temporary learning record, with an in-memory fallback. New guest practice does not update durable anonymous server records.
- An initial **five-distinct-item-per-tab assumption**, configurable in the policy/controller from 1–20 with a fallback of five. Words, idioms and expressions represent learning items; reference exposure and plans do not consume allowance. Revisiting admitted items remains available. This is a product allowance rather than a security, billing or entitlement boundary.
- Separate prompts for saving and reaching the practice allowance, with a route back to browsing. Durable bookmarks, review schedules and account progress require verified sign-in.
- Exact preservation of earlier local source bytes. Earlier-device backups and guest/legacy import stay explicit, do not run merely on sign-in, and use the safe account projection. Private writing is not silently imported or uploaded.
- Initial verified-email signup behind explicit shared-auth/email/signup flags. Caller bodies cannot enable signup; reverification always uses the current account's server-selected email and `create_user:false`.
- Browser/account save barriers, exact-UUID ownership, HttpOnly cookies and cross-origin mutation rejection. Account changes and revoked sessions clear stale visible private snapshots and block stale commits, while preserving exact account caches, failed candidates and guest/import source bytes. Ordinary network failures retain their distinct recovery behavior.

Direct source includes `lib/guest-learning.ts`, `lib/web-learning-sync.ts`, `app/GuestLearning.tsx`, `app/VocabularyApp.tsx`, daily/Express practice, `app/api/state/route.ts`, `lib/web-account.ts`, `lib/web-account-request.ts` and `app/WebAccountPanel.tsx`.

No billing or paid entitlement is implemented. A future tier remains a planning topic, with no published price, period or feature promise.

## Verification checkpoints

| Scope | Actual result |
| --- | --- |
| Earlier sign-in/idiom snapshot | Build/typecheck/lint and **337/337 Node checks**, zero failures/skips |
| Signup follow-up before guest-first changes | Build/typecheck/repository lint passed; **344/344 Node checks**, zero failures/skips |
| Initial signup full-suite attempt | 316 passed, eight PostgreSQL-dependent entries skipped; rerun with the existing `PGLITE_MODULE_PATH` produced the complete 344/344 result |
| Final guest-first integrated JavaScript/TypeScript source | **414/414 Node checks**, zero failures/skips; production build/typecheck/repository ESLint passed |
| Final CSS-only mobile button adjustment | Asset rebuild and **56/56 focused PWA/SSR/guest-UI checks passed**; no JavaScript change or added full-suite count |
| Actual built local HTTP worker | **64/64 passed**, including 29 public precache files, anonymous/device PUT 401, cross-origin PUT 403 and gated auth POST 503 |
| Prepared hosting candidate | 22 curated files (14 runtime, eight tests); build/typecheck/lint and **260/260 curated checks passed** |
| Local guest-first Chrome acceptance | **79/79 passed**, actual desktop/mobile Chrome |
| Earlier actual local Wrangler HTTP worker | **57/57 passed**; predates the signup and guest-first follow-ups |
| Latest native regression | **264/264 groups across 16 suites**, zero failures; no subsequent native change is included in this web follow-up |
| Version-8 hosted build | **153 curated tests** plus build/typecheck/lint passed |
| Version-8 canonical delivery | **47 logical HTTP checks**, all **29 assets** byte-matched |
| Version-8 isolated Chrome reference browsing | **12/12 desktop/mobile checks** passed |
| Fresh hosted backend metadata/security | **16/16 checks** passed; all 11 function hashes match reviewed local definitions |
| Real provider identity checks | Two approved Auth accounts verified, both sessions logged out; six first-account and two second-account checks passed |
| Canonical web account acceptance | Not performed; code-entry email, cookies/restoration, cross-account saves/isolation/CAS and explicit import remain pending |

The initial 337-suite run had previously found stale generated native localization. Running `npm run ios:content` updated only the generated localization resource; its final rerun passed. No progress IDs or private writing were pruned. The later 344 suite includes signup coverage; the final 414 suite includes the guest-first changes and account-snapshot regressions. A visually discovered mobile button flex-basis issue was corrected in CSS only, then rebuilt and covered by 56 focused checks. Overlapping focused counts are not added to the full-suite total.

Evidence remains local and ignored under `.build/qa/2026-10-22-signin-idioms/` and `.build/qa/2026-10-22-guest-first/`. The final guest-first suite is `final-full-node.log`; final build/type/lint logs and `final-css-production-build.log`/`final-css-followup.log` retain the exact asset-validation results. `local-http-receipt.json` records all 64 worker checks. The preceding 344-suite receipt remains `signup-full-node-with-postgres.log`. Local PostgreSQL tests use disposable fixtures and synthetic sessions; they do not replace real hosted acceptance.

## Actual local guest-first browser acceptance

A fresh isolated Chrome profile exercised the built local guest-first source with desktop and mobile layouts. The verification includes actual browser mouse/keyboard focus behavior, rather than only server rendering or component assertions. All **79/79 checks passed**, recorded in `.build/qa/2026-10-22-guest-first/local-browser-receipt.json`.

The passed journeys cover the public landing/catalog before personalization or sign-in; temporary guest practice and its five-item allowance; same-tab reload; and saving prompts that leave public browsing available. Keep browsing and Escape now dismiss the limit prompt without a focus loop. A captured browser trace before reload contained ten GET requests and no anonymous PUT.

Dictionary checks cover the 93-item role list (13 items on its last page), all 472 words (12 on the last page), alphabetical order and filter/search page resets. Korean mobile checks cover catalog search, detail navigation and focus restoration. The final 390px viewport renders both corrected buttons at 47px high; the desktop viewport is 1440px. Native Chrome DevTools Protocol mouse and keyboard input verified Keep browsing and Escape, and public guest PWA update acceptance passed. Corrupt temporary storage still permits blank public browsing and repair access, without exposing a stale private account snapshot. Screenshots are `lucid-guest-ko-mobile-explore.png`, `lucid-guest-ko-desktop-explore.png` and `lucid-guest-ko-mobile-idiom.png` in the ignored QA directory.

Legacy fixture bytes and the downloaded original backup remain exact; sign-in does not auto-import them. An actual local version-8 controller→version-9 server transition rejects the old anonymous PUT with 401 while preserving the source bytes. The old version-8 in-app Update button is disabled after that 401; an ordinary browser reload is required for the new UI. The seeded version-9 reload path was verified without clearing site data or force-activating a waiting worker.

These are controlled local fixtures. They establish the new source's guest/catalog behavior, not its public deployment, real canonical account sessions, physical touch hardware or installed/offline acceptance.

## Prepared publication artifact

The hosting candidate preserves runtime environment revision 0 and keeps auth off. Its 22-file curated delta contains 14 runtime files and eight tests. The final CSS change was rebuilt; the actual local 64/64 HTTP receipt was rechecked after that change.

| Prepared artifact evidence | SHA-256 or value |
| --- | --- |
| Official publication artifact | `3020164b8ddcffe88b879163da95d1ef3184b3a536a6bb16c8dc92d84f9ed15e` |
| Curated 22-file source delta | `65102c7e68fe8604a11bf3e1b0d50d91fcfd2dc008ac3c25623ef3a71b5c4a92` |
| Candidate service worker | `9639c4d5d02a63edb32f4dec3c53c639235f4e7167d69394392fbd1f0e97500d` |
| Candidate cache suffix | `403b060ccc526ad6` |

These identify the tested release candidate, not a new GitHub commit or successful public deployment. The current canonical deployment remains version 8.


## New Supabase project and remaining activation

Authenticated discovery found the owner-approved Launch organization empty. After explicit approval, Lucid was created on Free in Singapore as `eaorljzxspmiexlmlfvb`. The $0/month provisioning quote is recorded without promising future capacity or pricing.

The guarded initialization succeeded once and migration history records `20261022151015_lucid_initial_shared_schema`. It created six tables and eleven functions with the reviewed authored seeds. Hosted metadata confirmed own-row RLS on both learner tables, no anonymous application access, authenticated own-row SELECT plus public save-wrapper EXECUTE only, no direct client/column writes or schema CREATE, and no custom learner/Auth table triggers. Initial zero-row counts were checked before approved test accounts were created.

Two real owner-controlled test accounts were subsequently verified using legitimately delivered confirmation links and their provider sessions logged out. Own empty-state reads returned 200; anonymous reads/RPC and direct authenticated INSERT were denied. No learning records were written. These are basic provider checks, not two-account cross-read/write/CAS or canonical web-session acceptance.

The existing publishable key was retrieved through the official filtered tool after authorization; no new key or service-role credential was created. Actual public provider settings require email confirmation and permit email signup. However, delivered messages still use the default confirmation link to **`localhost:3000`**, with **no numeric OTP**. No SMTP, Site URL or template configuration has been changed.

The user authorized the necessary SMTP setup. Its remaining blocker is capability: the available official MCP groups lack Auth-configuration/SMTP controls, and the fresh test browser does not inherit an authenticated Supabase Dashboard session. See the setup record for exact canonical URL and code-template targets. Do not request the already retrieved publishable key again.

Public auth remains gated. The tested hosting candidate and official publication artifact are prepared. A fresh narrowly scoped Sites source credential approval has been requested for the version-9 follow-up and is pending; the approved version-8 credential was already used. No new credential has been created for the pending follow-up. Website release authorization itself persists, and current public delivery remains version 8 until a later successful deployment receipt is verified.

## Data preservation and limits

Ordinary account sync includes the existing privacy-limited course progress, bookmarks and safe history projection. Daily idiom schedules, personal situations, originals/retries and freeform drafts are not promised full cross-device portability; explicit private backups may include personal writing. Matching email labels never merge separate UUIDs or recover records from the old project.

Domain/mail DNS, the gateway, native configuration and the owner's installed app remain unchanged. Canonical dirty work and historical records, including `CLAUDE.md`, `LOCAL_DEVELOPMENT.md`, `ios/AppStore/AUTH_SETUP.md`, prior QA/publication records and incidental `infra`, are preserved.

Automatic approval review previously rejected a new web account-deletion API as an unrequested irreversible feature. That product API/UI remains omitted. The allowed isolated cascade/isolation tests do not establish or perform hosted deletion.
