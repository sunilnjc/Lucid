# Lucid public guest launch — 14 October 2026

Status: **deployment succeeded** under explicit publication authorization. Canonical source remains `/Users/Sunil/Developer/Lucid`. The earlier local report `IMPLEMENTATION_QA.md` is unchanged; local shared-account fixture evidence must not be presented as active public sync.

## Published release

| Item | Exact value |
| --- | --- |
| Public URL | https://lucid-vocabulary-sunil.sunilkumar-kalabandi.chatgpt.site |
| Site | `appgprj_6a833d823f0481919f479e812c7998e8` |
| Saved version | **5** — `appgprj_6a833d823f0481919f479e812c7998e8~appgver_4a81b34a46d08191a7ccab76d1be9e80` |
| Deployment | `appgdep_6acfb086f6908191ac21168b9efffc05` — succeeded |
| Exact pushed source | `20576b518af84f7174a545430c876951ea48a4cb` |
| Curated release checkout | `.build/site-release-20261014` |
| Local tar | 4,274,335 bytes; SHA-256 `bb11a4f1452355a2feb6d81e4753128840ea46de0654ba73128a8fafeb8c2baa` |
| Saved backend archive | `sha256:d2452b9bc9956e9ac7d38ea3639233dcb47c3b3892328a1201b09391418075a2`; 131 files |

The official Sites helper built, pushed and packaged the curated release. The original GitHub repository was untouched: HEAD `f6e9bffc5530091205142ecc904092ccc0b4dc64`. The site archive did not publish incidental `LOCAL_DEVELOPMENT.md`, `ios/AppStore/AUTH_SETUP.md` or `infra`; it contained no credentials, environment files, `.wrangler`, local databases or symlinks. Drizzle SQL and migration journal were byte-identical to live version 4. The previous remote-v4 native snapshot was unchanged; current native work remains in the canonical checkout and was not installed on the owner's phone.

## Actual public capability

- `/en` and `/ko` provide English and Korean introduction pages, available language links and an authored tone demo. `/start` redirects to the original learning app. The app, setup, exercises, feedback, privacy policy and support remain in English. Japanese/Chinese locale entries are planned; no translated pages are claimed.
- Guest courses, tap practice, review, Express, bookmarks, progress and explicit portable backups are available. Shared-account sign-in/email are disabled. **Automatic native/web progress synchronization is inactive in this release.** Existing guest/D1/Sites web storage and native Supabase UUID identity remain separate.
- Portable backups are the current cross-device transfer path and can include private writing. Browser and installed-app storage may differ. No account is joined by matching email labels.
- The PWA exposes installation guidance/prompts when the browser supports them, a standalone manifest and build-owned public shell caching. iPhone installation is completed through the browser's Share → Add to Home Screen flow. No physical installation was performed during release QA.

## Release checks

| Check | Result and limit |
| --- | --- |
| Full Node suite | **224 passed**, zero failures/skips, including six landing/localization entries |
| Production build and TypeScript | Passed |
| Repository ESLint | Passed |
| Staged focused checks | 25/25 passed |
| Final account/installation-introduction checks | 19/19 passed |
| Live read-only route checks | `/en`, `/ko`, `/`, `/support`, `/privacy`, manifest, service worker and public shell returned 200 |
| Live app entry | `/start` returned 307 → `/?source=landing` |
| Live account status | `enabled=false`, `emailReady=false`, `identity=null` |
| Live identity isolation | Anonymous/no-device request and forged Sites header each returned 401; a fresh synthetic device GET returned 200 with device identity and null state |
| Live Chrome | Korean introduction, authored tone switching, English language selector and English app entry verified |
| Local Chrome Korean layout | 390-pixel viewport had no horizontal overflow; Korean region, English example language and canonical checked |
| Live public cache readiness | Controlling worker cache proof succeeded on the hosted origin; app showed Offline app ready on this browser, guest-safe introduction, disabled shared sign-in and the English five-step onboarding |
| Hosted network-offline launch or physical PWA install | Unrun; hosted online cache readiness does not establish either |
| Native launch regressions | Not rerun; earlier local 235 groups/14 suites and simulator XCTest 1/1 remain historical evidence |

Live checks were read-only. No synthetic learning or feedback was written to the hosted database. No Supabase migration, runtime environment, identity configuration, paid service, social publication, App Store submission or phone installation changed.

Evidence remains in `.build/qa/2026-10-14`: `launch-node-tests.log`, `launch-lint.log`, `launch-build.log`, `launch-typecheck.log`, `launch-stage-focus.log`, `launch-live-http.json` and `lucid-launch-live-ko.png`. The previous local offline/reload/update evidence remains in `IMPLEMENTATION_QA.md`; it is not a hosted offline acceptance result.

## Shared-sync activation gate

The canonical shared-sync source has passed disposable local PostgreSQL 18.6/PGlite 0.5.9 and signed synthetic Auth/PostgREST checks, using actual production web routes, a separate Swift HTTP client and a simulator UI. Hosted Supabase Auth/email, independent simultaneous PostgreSQL connections and physical two-device acceptance remain unverified. None of those fixture results activates the public account feature.

Before activation, approve the exact Supabase destination and proposed validators, including `supabase/proposals/202609140002_lucid_payload_validation.sql` and `202610140001_lucid_shared_progress.sql`. Take an owner-only backup of learning rows, configuration and existing RPC definitions; inspect existing records without printing private learner text; apply transactionally and retain the non-destructive compatibility rollback. Complete hosted non-production acceptance before approving web shared-auth/email flags, provider URL/public key/email configuration and native Release auth. Native Release authentication/email remain **NO/NO**. Never use a service-role key in a client or automatically link Sites and Supabase accounts by email.

## Preservation and cleanup

Original file hashes remained unchanged:

- `LOCAL_DEVELOPMENT.md`: `6d73f89e333db979468864ceed89a3f37889f31685097d1033e00887bb387062`.
- `ios/AppStore/AUTH_SETUP.md`: `b71fa2c451bb8238748945b216d949f879592cde03dd0213d0d2547b737edc85`.

The staged Git checkout was clean after publication. The expiring Git credential was removed from orchestration memory; no persistent credential was written. Preview port 4360 had no listener and the default Chrome viewport was restored. Only the dedicated live `/en` browser tab was left as the deliverable.

## Follow-up access and rollout limits

The documented existing Supabase destination is **lucid-vocabulary**, `idhnrnqrpyimknakpyrn`, Singapore, `https://idhnrnqrpyimknakpyrn.supabase.co` (`ios/AppStore/AUTH_SETUP.md`, lines 3–5). An actual read-only Chrome dashboard attempt redirected to sign-in with the project as its return destination. No authentication or agreement was completed. The sign-in UI presents Terms/Privacy and periodic-email acceptance language when continuing; the owner must review any choices. Current ownership/schema/configuration/plan/capacity remain unverified. No new service, purchase, credential creation or contract is proposed by the rollout; that is not a claim that current provider sign-in is agreement-free.

The smallest owner action is to sign in to the existing dashboard. A dedicated dashboard handoff tab is available, alongside the original live `/en` deliverable. The exact backup, ordered non-idempotent migrations, hosted disposable-account acceptance, deletion prerequisite, later web flags and separate native approval are in `SHARED_SYNC_ROLLOUT.md`. No backend or runtime changes were performed in this follow-up. Public automatic native/web sync remains inactive.

Available browser controls do not safely provide a hosted cold-offline test: Chrome exposes viewport and the existing Person 1 profile; In-app Browser exposes visibility and viewport. No isolated-profile creation or per-tab offline/network simulation API is available. No OS/network/security settings were changed. Hosted online cache readiness remains the verified boundary; actual hosted offline launch and physical iPhone installation remain unrun.

## Library screenshot identity

The live Korean launch screenshot was successfully uploaded to the Library at `/lucid-launch-live-ko.jpg`:

| Field | Saved value |
| --- | --- |
| Library file | `libfile_e59601a5f0d881918d2e75051b4c5591` |
| Native file | `file_00000000864481f58e45a708a23cfe14` |
| Version | 1 |
| Size/type | 85,747 bytes; image/jpeg |

Metadata was applied to this original file, preserving its identity. No sharing or access settings changed. The local retained screenshot remains `.build/qa/2026-10-14/lucid-launch-live-ko.jpg`.

The current Library version corrects the initial PNG label to JPEG metadata without changing screenshot pixels or bytes. The stable Library ID and sharing remain unchanged. Current local working file: `.build/qa/2026-10-14/lucid-launch-live-ko.jpg`; SHA-256 `666c3dc76ef28c9f55c192db4e14fb4df59207f4b68199245dbae7ac61b4695e`. The original retained screenshot remains available.
