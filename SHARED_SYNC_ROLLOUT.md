# Lucid shared-sync rollout approval

Status: **not applied; public guest release remains unchanged**. This plan targets the documented existing Supabase project and reuses the existing Supabase/Resend integration. No new provider, account, credential creation, paid plan, purchase or contract is proposed by the rollout. Current provider sign-in may present terms or other acceptance choices that the owner must review.

## Existing project and actual access gap

Documented in `ios/AppStore/AUTH_SETUP.md` lines 3–5: **lucid-vocabulary**, project `idhnrnqrpyimknakpyrn`, Singapore, endpoint `https://idhnrnqrpyimknakpyrn.supabase.co`.

The actual read-only Chrome dashboard check redirected to sign-in with a return destination for this project. No authentication or agreement was completed. The sign-in UI includes Terms/Privacy and periodic-email acceptance language when continuing. Current project ownership, schema, configuration, plan and free-tier capacity remain unverified; old limits are not current cost guarantees.

**Smallest owner action:** sign in to the existing project's dashboard, reviewing any presented terms/choices. No new account or credentials are requested. The dedicated dashboard tab is available for this handoff; the live `/en` deliverable remains available.

## First approval: inspect, back up, migrate and privately accept

After dashboard access confirms the destination, approve the following exact scope. Approval is needed because this changes the live learning RPC and permits hosted acceptance with isolated test identities. Public OTP/shared-auth activation is a later gate.

1. Inspect existing migration history, original account schema, RPC definitions, tables, grants/RLS and triggers. Verify current Supabase/Resend settings and capacity without printing credentials or learner content. Both proposals are **non-idempotent**; do not rerun blindly or assume prerequisite migrations already exist.
2. Take an owner-only backup of learning rows, functions, grants and configuration. Preserve existing learner UUIDs and source records. Apply the two reviewed proposals in order, transactionally, without rewriting learning rows during installation: [`202609140002_lucid_payload_validation.sql`](supabase/proposals/202609140002_lucid_payload_validation.sql), then [`202610140001_lucid_shared_progress.sql`](supabase/proposals/202610140001_lucid_shared_progress.sql). Reload the PostgREST schema cache and verify grants/ownership/revisions. Resolve prerequisite mismatches before applying the approved files.
3. Use explicitly approved disposable test accounts for real SMTP/Supabase OTP, hosted CAS, simultaneous clients, offline resume, account/role isolation, old-client compatibility, explicit guest/legacy import consent and account deletion. Retain test results and remove only the approved test records. Local PGlite/synthetic gateway results remain supporting evidence, not hosted acceptance.
4. Complete a private web account-deletion path before public signup. The current public web UI provides sign-out only. Reuse the existing `delete-account` function with fresh verification and confirmation, and pass hosted deletion/recovery checks before exposing public account creation.

Shared metadata includes profile/course placement, checkpoints, bookmarks, review evidence, exact authored saved phrasing, text-free practice history and guidance exposure. Personal original/retry sentences, private situations, freeform writing and voice remain local. Never join Sites/D1 and Supabase accounts by email; imports require explicit consent and preserve their source.

## Later approval: activate public web auth

Only after deletion and hosted acceptance pass, approve these exact web settings using the existing project's public/publishable key. No service-role key may reach the client or public configuration.

| Setting | Intended value |
| --- | --- |
| `LUCID_SHARED_AUTH_ENABLED` | `true` |
| `LUCID_SHARED_EMAIL_ENABLED` | `true` |
| `LUCID_SUPABASE_URL` | `https://idhnrnqrpyimknakpyrn.supabase.co` |
| `LUCID_SUPABASE_PUBLISHABLE_KEY` | Existing project public/publishable key; no value copied into this document |
| `LUCID_SHARED_ALLOW_LOCAL_TEST` | Off/absent in public deployment |

Do not change `LUCID_TRUST_SITES_IDENTITY` as part of this approval. Public-gateway spoof stripping was verified, but any future trust change needs a verified-request acceptance case and its own authorization. Validate real OTP delivery and synced metadata only with approved identities before wider availability.

Native public sync also requires separately approved `LUCID_CLOUD_AUTH_ENABLED=YES`, `LUCID_EMAIL_DELIVERY_READY=YES` and a native release/install. Both flags remain **NO/NO** now; web activation alone does not update the owner's installed app.

## Reversible compatibility pause

Disable web shared-auth/email flags and pause shared clients first. Apply [`202610140001_lucid_shared_progress.rollback.sql`](supabase/proposals/202610140001_lucid_shared_progress.rollback.sql). This compatibility pause preserves shared snapshots and legacy writes while visibly blocking new shared payloads; it does not delete learner history. Restore the backed-up forward RPC to resume, reload the schema cache, re-run acceptance and then re-enable approved clients.

## Remaining PWA acceptance

Hosted online cache readiness passed. Hosted cold network-offline launch remains unrun: available Chrome controls expose viewport and the existing Person 1 profile; In-app Browser exposes visibility and viewport. There is no isolated-profile creation or per-tab offline/network simulation API. No operating-system, network or security settings were changed. Earlier local server-stop offline proof is retained in `IMPLEMENTATION_QA.md`; it does not establish hosted offline behavior or physical iPhone installation.
