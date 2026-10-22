# Sign-in, idiom discovery and pagination — 22 October 2026

Status: **source frozen and locally verified; current public Site remains version 7**. GitHub push is reported separately from website delivery; no final Git commit or new deployment receipt is claimed in this record yet. The user authorized code changes, the GitHub push and release to [learnwithlucid.com](https://learnwithlucid.com), including Library/idiom search and A–Z pagination with at most 20 entries per page. No new provider, credential creation, public signup, destructive account feature or owner-phone change is included.

## Scope and source review

- Library and idiom browsing filter/search first, then sort by English term A–Z, then slice into pages of 20. Search/filter changes reset pagination; invalid page requests clamp safely. The helper copies before sorting and uses stable IDs to resolve ties. Current 14 authored idioms fit one page; the controls support larger lists without inventing content.
- A dedicated idiom destination and Today shortcut expose the existing authored catalog before onboarding. English examples remain visible with Korean guidance. Reference browsing earns no mastery, production/review credit or points. Daily assignments, private originals and existing review schedules are preserved.
- Server auth validates the provider UUID, keeps provider tokens in HttpOnly cookies, rejects cross-origin mutations and preserves valid cookies when an older background refresh fails. Sign-out alone explicitly clears browser cookies. Existing-account OTP sign-in and same-account reverification use `create_user:false`; no implicit account registration is intended.
- Browser account requests serialize status/mutations and drain learning saves before identity changes. An unsaved candidate remains bound to its original account; failed persistence blocks switching and later recovery cannot replay it into another account. Direct replacement is refused while a pending candidate exists, preventing silent loss of newer private writing.
- Ordinary account sync remains the existing privacy-limited projection: course placement/progress, bookmarks and safe history metadata. The optional `dailyVocabulary` sidecar, including idiom schedules and private originals, stays device-local or in an explicit private backup. These changes do not claim complete cross-device portability of every saved field.
- Native account and shared-sync regressions pass as part of the 16-suite verification. A bounded independent source review found no pagination data/order blocker. Catalog focus restoration and language wiring are complete in the frozen web source and covered by the local UI checks. No actual browser interaction, keyboard journey or mobile viewport acceptance was performed in this run.

Direct source: `lib/list-pagination.ts`, `app/VocabularyApp.tsx`, `app/DailyVocabulary.tsx`, `lib/web-account.ts`, `lib/web-account-request.ts`, `app/WebAccountPanel.tsx`, `lib/web-learning-sync.ts`, the account/state routes and native `AccountService.swift`. No product or test files were edited for this documentation review.

The supplied Library reference was materialized and inspected by the coordinator at `/tmp/lucid-oct22-reference/image.png`, SHA-256 `cc25eb63770b0db167a098198096f1a30c28b5682778f18f896ff9292326bc6a`. The requested pattern is the Library filter/grid, with example cards “discrepancy”, “outstanding” and “cut-off”. No private learner writing is reproduced here.

## Frozen web verification

The isolated release checkout is `.build/github-release-20261022`. Final web/native results are complete; delivery receipts are tracked separately.

| Check | Frozen result |
| --- | --- |
| Production build through the Sites build helper | Exit 0 |
| `npm run typecheck` | Exit 0 |
| Full repository ESLint | Exit 0 |
| Full staged Node suite | **337/337 passed**, zero failures/skips; `.build/qa/2026-10-22-signin-idioms/staged-node-tests-final.log` |
| Auth lifecycle and integrated UI checks | 14 lifecycle + 10 integrated UI checks passed, included in the 337 total |
| Backend account and security checks | 10 account + 11 security checks passed, included in the 337 total |
| Isolated PostgreSQL account/isolation/cascade checks | 8/8 passed; disposable local PostgreSQL/PGlite, synthetic identities and rollback; zero synthetic rows retained |
| Earlier scoped sync and catalog checks | 30 sync/persistence, 33 Library/idiom UI/pagination and 2 catalog engine checks passed; do not add overlapping focused counts to the full-suite total |
| Actual local Wrangler HTTP worker | **57/57 passed**: exact Korean query, idiom deep link, EN/KO/legal routes, two intentional `/start` 307 redirects, disabled account status, four expected gated account POST 503 responses, and all 29 public precache files |
| Native behavior regression | **264/264 groups across 16 suites passed**, exit 0, zero failures; includes 21 shared-sync, 23 account QA, 22 daily and 7 localization groups |
| GitHub delivery | Source prepared from the preserved remote baseline; push receipt reported separately, with no final SHA claimed here |
| Website delivery | Current live Site is version 7; no October 22 release receipt yet |
| Actual browser/mobile viewport/provider journey | Unrun; HTTP/component checks do not establish these acceptance cases |

The first full Node run reported 336 passes and one failure because generated `learning-locales.json` was out of sync with the authored source. The coordinator ran `npm run ios:content`; only `ios/Lucid/Lucid/Resources/learning-locales.json` changed. The final rerun passed all 337 checks. No learning IDs, progress or private writing were pruned to resolve the failure.

No hosted account was created/deleted and no real learner text was sent to a provider by these isolated tests. The local PostgreSQL runtime is under `/tmp/lucid-oct22-pg-runtime`; local security checks do not establish hosted Supabase ownership, SMTP delivery or independent simultaneous PostgreSQL connections. The local Wrangler account gates were expected results, not an accepted real-provider OTP journey.

The tested local worker was stopped and port **4778** was verified closed. The generated worker SHA-256 is `cc0ae898800667245fbffe83ecda0ac5cbd3dbc0b827e8d470ed594823cb9ddf`; service-worker SHA-256 is `de3e78a0b622de1898e9e3b66c013e39bfc862897064e3f42780db8304bb09e6`. The 213-file source snapshot matches staging. The full GitHub-eligible set contains 216 files, including retained protected baseline documents, with no private paths or symlinks.

Repository email templates use the code-only OTP marker `{{ .Token }}`. Account API calls use relative endpoints and do not put tokens in redirects. Hosted email-template configuration remains unverified and unchanged.

## Current live state and observed blockers

Site ownership/public audience and **version 7** were reconfirmed on 22 October through Site metadata, with runtime environment revision **0** and no environment entries. Observed account status is `enabled=false`, `emailReady=false`; automatic native/web shared-account sync is inactive. Native Release auth/email remain NO/NO.

The previously documented hostname `idhnrnqrpyimknakpyrn.supabase.co` currently returns **NXDOMAIN (DNS status 3)** from both Cloudflare and Google DNS-over-HTTPS. `/auth/v1/health` failed DNS resolution (curl exit 6). The dashboard URL `https://supabase.com/dashboard/project/idhnrnqrpyimknakpyrn` returned HTTP 200 for a public shell; that is not authenticated ownership/schema/configuration evidence and does not prove the project currently exists. Do not infer that a new project should be created or guess a replacement URL.

No authenticated Supabase connector, CLI, psql, session environment or current browser-control access was exposed for provider inspection in this execution context. The historical October 14 dashboard-login observation is not current access evidence. Current ownership, project reference, schema/RLS, email settings and capacity remain unverified. No DNS, production configuration or mail setting changed.

GitHub SSH and `gh` authentication succeed for public `sunilnjc/Lucid` using the existing `github` SSH remote. Preparation began from canonical `main` `f6e9bffc5530091205142ecc904092ccc0b4dc64` and remote default `main` `9146fdd4c01994aeae2e1a7a84e65417248a61dd`; the remote baseline differed only by its README overview. The isolated `.build/github-release-20261022` clone preserves active canonical work and that remote documentation intent. These are preparation baselines, not a claim about the final pushed commit; the push receipt is reported separately.

Old Sites release checkouts intentionally have no remotes/access credentials, and the 22 October Site metadata response again supplied no source credential. The publication action still needs reuse of existing source-write authorization for Site `appgprj_6a833d823f0481919f479e812c7998e8` through the official path. Existing access may be reused if the owner restores it. Otherwise, the official path may require `create_source_repository_write_credential`, which creates short-lived write access for this existing repository. That tool has not been called because the user forbids new credential creation. The precise remaining approval would be an exception only for this short-lived existing-Site repository credential, with no provider or infrastructure change. Do not create credentials or expand permissions without that explicit approval, and do not request website-publication consent again. No credential was created.

## Exact pending activation scope

1. **Establish the correct existing project and read access.** Obtain owner-confirmed current project/reference and authenticated read-only access using existing authorization. Inspect schema/migration history, RLS/grants/triggers, RPCs and existing email configuration without reading or printing secret configuration. Reuse the existing Supabase/Resend integration; no new provider, project, credentials or paid plan is proposed.
2. **Approve only verified backend changes.** After that inspection, present the exact required migration diff and destination, with owner-only row/function/grant/configuration backups and a transaction/compatibility rollback. The prior proposals are `202609140002_lucid_payload_validation.sql` then `202610140001_lucid_shared_progress.sql`, are non-idempotent and must not be applied blindly to an unverified schema. Preserve learner UUIDs, history, source records and private writing; never join accounts by email.
3. **Approve existing-account activation and test destinations.** After schema/RLS and isolated hosted acceptance pass, approve the existing project's URL/public-publishable key plus web shared-auth/email flags and approved owner-controlled test email recipients. No service-role key or local-test flag belongs in public configuration. Do not change Sites identity trust. Test real OTP, strict cookie/origin behavior, exact-UUID reverification, reconnect/CAS, account isolation and consented import with disposable approved records. `create_user:false` keeps public signup outside this scope. Native Release flags and phone installation remain unchanged unless separately authorized.
4. **Keep publication/access boundaries explicit.** GitHub push and the learnwithlucid.com release are authorized. Existing Site source-write access may still need a narrow access grant if the official path cannot use current authorization; that does not authorize creating credentials. Do not claim deployment success until the release receipt and live acceptance are available.

Provider/security activation needs specific approval because it modifies the live learning RPC/RLS/configuration and exposes verified email sign-in and synced metadata. Public website publication authorization does not establish correct provider ownership or approve those changes. No fixed free-tier capacity, price or old email rate is treated as current evidence.

Automatic approval review rejected a new web account-deletion API as an unrequested irreversible feature. That product API/UI is omitted from this task. Existing isolated SQL cascade/isolation checks remain allowed; no hosted deletion was performed. Safe auth work continues without adding that feature.

## Preservation

Older QA/publication/rollout records, `CLAUDE.md`, `LOCAL_DEVELOPMENT.md`, `ios/AppStore/AUTH_SETUP.md`, private configuration and incidental `infra` are preserved. No raw private learner content, credentials or runtime databases belong in this repository record or release package. The native regression log is `.build/qa/2026-10-22-signin-idioms/native-regression.log`, SHA-256 `eaa926d08a04adcd53571019af7ea4480e78fac420134e4bfbed5285490874ad`; it used the regenerated localization resource SHA-256 `d06908b2d70ac4bbd63b9b0ebb6d4cd61c755eeb1047797d57e9f8a718ce4584`.

A final read-only canonical-domain check on 22 October returned HTTP 200 for `/?lang=ko` and the idiom query. HTTP and www redirect to HTTPS apex with query preserved (308). Live account status remains disabled and live service-worker SHA-256 remains `79b49c18302ee7d851c991d67df05c1c74f806f813c379d1af5dcf4f9c124d4e`, confirming the old release is still served. No new deployment is claimed. Final GitHub push receipts are in the task output; source provenance is the commit containing this record.
