# Lucid Supabase setup — 22 October 2026

**Database setup is complete; public web sign-in remains gated.** This record covers the new owner-approved Lucid project and separates database verification from the remaining email and canonical-domain acceptance work. The version-8 website publication is recorded in [PUBLICATION_2026_10_22.md](PUBLICATION_2026_10_22.md).

## Verified project and initialization

Authenticated discovery found the approved **Launch** organization empty. Supabase quoted the Free project at **$0/month** before creation; this is the provisioning quote, not a promise about future pricing or capacity. The user approved creating Lucid on Free in Singapore and initializing only that fresh project.

| Item | Verified value |
| --- | --- |
| Project | Lucid |
| Organization | Launch, `qsevggeoigiivpmxxgmu` |
| Project reference | `eaorljzxspmiexlmlfvb` |
| Region | Singapore, `ap-southeast-1` |
| Provider status after creation | `ACTIVE_HEALTHY` |
| Database | PostgreSQL 17.11 |
| Dashboard | [Lucid project](https://supabase.com/dashboard/project/eaorljzxspmiexlmlfvb) |
| API origin | `https://eaorljzxspmiexlmlfvb.supabase.co` |
| Applied migration | `20261022151015_lucid_initial_shared_schema` |
| Application attempts | One; provider returned success and migration history was verified |

The applied artifact is a single atomic DO statement containing the guarded fresh-project initialization and these exact source bodies, in order:

1. `supabase/migrations/202609140001_lucid_accounts.sql`
2. `supabase/proposals/202609140002_lucid_payload_validation.sql`
3. `supabase/proposals/202610140001_lucid_shared_progress.sql`

Artifact: `.build/qa/2026-10-22-signin-idioms/new-project-bootstrap-migration.sql`, **584,341 bytes**, SHA-256 `1157356f60b72d95a3d66a9e411459c19f007c9b29967495b3c8d95f421ec178`. It refuses existing public Lucid relations, routines or types. Do not rerun this non-idempotent initialization against an existing project.

The preflight confirmed Auth UUID/role prerequisites, zero Lucid objects and zero Auth users with full count visibility. The six standard provider DDL triggers were preserved. The two unfiltered PostgREST watcher definitions were inspected and only notify PostgREST to reload its schema; the other four triggers are restricted to extension operations absent from this bootstrap.

## Hosted database verification

All **16 metadata and privilege checks passed** after application. All **11 hosted function-definition hashes matched** the locally reviewed definitions.

| Area | Hosted result |
| --- | --- |
| Inventory | Exactly six Lucid tables and eleven functions; no missing or unexpected objects |
| Authored lookups | 2,181 expression phrases; 745 scenarios; 731 course senses; eight paths |
| Initial learner/Auth records | Zero, verified before the separately approved email tests |
| Ownership | RLS on `lucid_state` and `lucid_activity`; two authenticated own-row SELECT policies |
| Ownership references | Two validated cascading FKs to Auth user UUIDs |
| Anonymous access | No access to Lucid tables or functions |
| Authenticated access | SELECT on the two learner tables and EXECUTE on `lucid_save_state(bigint,jsonb)` only |
| Client writes | Direct table/column DML and schema CREATE denied |
| Helpers | Private helpers/base function are not client-executable; fixed safe search paths |
| Triggers | No custom learner/Auth table triggers introduced |

The four authored lookup tables are private through revoked client privileges; RLS is enabled on the two learner tables. A privileged inspection connection bypassing RLS does not mean client RLS is disabled.

Local evidence remains ignored under `.build/qa/2026-10-22-signin-idioms/`: `supabase-hosted-schema-receipt.json`, the fixed-hash preflight/post-application SQL, and the bootstrap artifact. The initial zero-user receipt predates the approved test-account creation below.

## Verified email-test checkpoint

The user approved verified email signup, obtaining the existing publishable key, and delivery to an owner-controlled Gmail mailbox. The existing key was retrieved through the official filtered `get_publishable_keys` tool; no new key was created and no service-role key was used. The recipient, message identifiers and verification values are deliberately excluded from repository records.

Actual public Auth settings reported:

- `disable_signup=false`
- `mailer_autoconfirm=false`
- `external.email=true`

One real signup request returned HTTP 200 and its confirmation email arrived. It used Supabase's **default confirmation-link template**, showed **no numeric OTP**, and pointed its completion redirect at **`http://localhost:3000`**. This is direct evidence that the provider's current template/URL configuration does not yet match Lucid's code-entry flow.

The legitimate delivered confirmation was verified through the provider API, and the resulting provider session was logged out. Six provider checks passed:

| Request | Actual result |
| --- | --- |
| Anonymous state SELECT | HTTP 401, PostgreSQL `42501` |
| Anonymous activity SELECT | HTTP 401, PostgreSQL `42501` |
| Anonymous save RPC | HTTP 401, PostgreSQL `42501` |
| Verified account's own empty state | HTTP 200, empty result |
| Verified direct state INSERT | HTTP 403, PostgreSQL `42501` |
| Provider session logout | Successful |

These are real provider checks using the approved test identity, **not** accepted canonical web OTP, browser-cookie restoration or account-switching journeys. The second approved Gmail-alias signup email also arrived and its legitimate confirmation link was successfully verified. Its own empty-state GET returned HTTP 200 with an empty result, and provider logout returned HTTP 204. Both owner-controlled test Auth accounts are verified and both resulting sessions were logged out. No learning records were written. Cross-account reads/writes, saved-state/CAS checks and canonical web session acceptance remain unperformed.

Ignored evidence in `.build/qa/2026-10-22-signin-idioms/` includes `provider-owner-checks.json` (six checks), `provider-second-account-checks.json` (two checks) and `public-auth-settings.json`.

## Remaining provider configuration

The user authorized the necessary setup and reuse of the existing SMTP sender. The remaining blocker is tool capability: the current official MCP groups expose account, database and development tools, but no Auth-settings or SMTP mutation. No authenticated Dashboard control or separately authenticated Management API client was available for those settings. The signed-in Dashboard's existence alone does not provide programmatic control. An isolated fresh headless Chrome profile completed 12 live version-8 desktop/mobile catalog checks. It did not use the existing signed-in browser or inherit the owner's Supabase login; these reference-browsing checks do not provide authenticated Dashboard control.

Apply these exact settings through an authorized Auth-settings connection or the project Dashboard:

| Setting | Exact target |
| --- | --- |
| Canonical Site URL | [URL configuration](https://supabase.com/dashboard/project/eaorljzxspmiexlmlfvb/auth/url-configuration): `https://learnwithlucid.com` |
| Email confirmation | Keep verified email required; do not enable mailer autoconfirm |
| New-user email | [Confirm signup template](https://supabase.com/dashboard/project/eaorljzxspmiexlmlfvb/auth/templates/confirm-sign-up): use [confirm-sign-up.html](supabase/templates/confirm-sign-up.html) |
| Existing-user email | [Magic Link/OTP template](https://supabase.com/dashboard/project/eaorljzxspmiexlmlfvb/auth/templates/magic-link-or-otp): use [sign-in.html](supabase/templates/sign-in.html) |
| Production delivery | [SMTP](https://supabase.com/dashboard/project/eaorljzxspmiexlmlfvb/auth/smtp): reuse the existing authorized sender and store its password only in provider configuration |

Both reviewed templates display `{{ .Token }}` for code entry. The app uses relative account APIs and does not implement a Supabase magic-link/password-reset callback. Do not route provider verification links to the gateway's existing unrelated `/callback` route or claim that route has passed Supabase acceptance.

Supabase's built-in sender is intended for restricted testing; receiving the two approved test messages does not establish production delivery to all learners. See the official [SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp), [email OTP guide](https://supabase.com/docs/guides/auth/auth-email-passwordless) and [production URL configuration](https://supabase.com/docs/guides/auth/redirect-urls).

## Web activation and acceptance

The locally verified guest-first source keeps catalog browsing public and new practice in a temporary tab session. Its initial product assumption is five distinct learning items per tab, configurable in the policy/controller from 1–20; this is not a security or billing boundary. Durable saving requires verified sign-in, legacy source bytes remain preserved, and guest/legacy import is explicit and privacy-limited.

The prepared source permits initial account creation only when shared auth, email and the explicit signup switch are enabled. Reverification always selects the signed-in account's server-verified email and retains `create_user:false`. An email code must establish a confirmed provider UUID before learning access. Guest records remain separate until an explicit, non-destructive import.

The exact eventual bindings are:

| Binding | Prepared value or source |
| --- | --- |
| `LUCID_SUPABASE_URL` | `https://eaorljzxspmiexlmlfvb.supabase.co` |
| `LUCID_SUPABASE_PUBLISHABLE_KEY` | Existing retrieved publishable key; value excluded here |
| `LUCID_SHARED_AUTH_ENABLED` | `true` only for accepted activation |
| `LUCID_SHARED_EMAIL_ENABLED` | `true` only when matching email configuration/delivery is verified |
| `LUCID_SHARED_SIGNUP_ENABLED` | Explicit `true` for the approved verified-email signup feature |

The current public version 8 has shared auth/email disabled and does not contain the later signup-switch or guest-first implementation. The follow-up passed 414/414 Node checks, production build/typecheck/lint and 64/64 actual local HTTP checks. Actual local Chrome guest/catalog verification passed 79/79 checks; its receipt is tracked in the October 22 QA record. A final CSS-only layout adjustment was rebuilt and passed 56 focused checks. GitHub follow-up: the source is tested locally; the verified implementation receipt is added below after push. Public follow-up deployment awaits fresh scoped source-access approval. Publishing that tested source and enabling auth flags remain separate from the completed version-8 UI release. Keep local-test and Sites identity-trust flags absent/off; never bind a secret/service-role key.

Before claiming public sign-in complete, verify real code-entry signup/sign-in on the canonical domain, session restoration/refresh/logout, same-account reverification, Alice→Bob→Alice switching, saved progress, direct unauthorized reads/writes between two real test identities, CAS conflict handling and consented guest import. Live version-8 and local guest-first desktop/mobile Chrome results are tracked separately in the October 22 QA record. Provider-only confirmation/logout and local fixture success do not satisfy that complete matrix.

The new project creates new Auth UUIDs. Matching email labels cannot restore records from the old project. Native configuration and the owner's installed phone app were not changed. Daily idiom schedules and private originals remain local or in explicit private backups; ordinary account sync does not cover every saved field.
