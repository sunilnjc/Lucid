# Validated, undeployed shared-progress proposals

Status: **executed locally on PostgreSQL 18.6 (PGlite 0.5.9) on 14 October 2026; not deployed.** These files remain outside `supabase/migrations` so a routine migration push cannot change the live backend.

`202609140002_lucid_payload_validation.sql` validates native v2 nested shapes, bounded authored identifiers (including colon-delimited IDs), and optional course/context metadata. `202610140001_lucid_shared_progress.sql` adds the optional `sharedLearning` v1 contract to the existing Supabase Auth UUID and `lucid_state` CAS storage. It keeps the September RPC as a private implementation; authenticated clients can execute only the new ownership-checking wrapper.

The shared contract contains lesson checkpoints, starting-check answers, authored notebook alternatives, text-free rehearsal/challenge history, and guidance exposure times. Strict nested field allowlists reject private situations, responses, retries and drafts. Authored phrase, scenario, course-word and starting-check tables are seeded from the checked-in native exports; clients cannot modify them. `tests/shared-sql.test.mjs` compares those rows with both client resources so curriculum changes cannot silently diverge from server validation.

Writes run in one transaction, derive ownership from `auth.uid()`, require a live `auth.users` row, and enforce an exact revision. Immutable activities and lesson sessions, context evidence, introduced words and shared metadata survive partial/older-client submissions. UUID casing and optional nil lesson word IDs do not create duplicates or false conflicts. Reused IDs cannot change their immutable meaning. A stale revision returns `PT409` and requires download/merge/retry.

Actual timestamps are limited to five minutes ahead of server time. Logical course/review days allow the next UTC day for timezone compatibility; due dates have a 45-day upper bound. Context days must agree with the actual evidence timestamp within the timezone allowance. Captured originals cannot occur after the recorded review. Same-day guidance exposure caps unsupported recall, quality merges use the weaker value, notebook due dates advance only from a later practice timestamp (ties keep the earlier due date), and mastered flags are derived from independent recall on three distinct dates with a 30-day context anchor and a successful latest day. Production self-assessments and aggregate counters cannot establish retained recall. This validates submitted evidence and merge integrity; it does not prove that a self-reported practice happened or semantically grade a sentence.

## Repeat the local checks

Use an existing PGlite module in a task-specific temporary directory. The checked-in runner never installs a package, reads live credentials, or connects to a hosted database.

```sh
PGLITE_MODULE_PATH=/tmp/lucid-pg-wasm/node_modules/@electric-sql/pglite/dist/index.js node scripts/shared-postgres-fixture.mjs
PGLITE_MODULE_PATH=/tmp/lucid-pg-wasm/node_modules/@electric-sql/pglite/dist/index.js node --test tests/shared-sql.test.mjs
```

The first command applies the original account migration and pending v2 validator, executes the entire original security suite, then applies the shared proposal and runs `shared-progress-security.sql`. The second also checks retention, UUID/nil-field compatibility, core omissions, authored-resource equality and the safe rollback path. Six test entries pass. The original suite rejects 38 malformed v2 payloads plus malformed course/evidence metadata. The shared suite rejects 16 malformed shapes and six malformed writes atomically, and covers RLS, CAS, concurrent-snapshot unions, exposure, old-client omission and account isolation. Every SQL security script ends with `ROLLBACK`; final synthetic user/state/activity counts are zero.

PGlite is a real PostgreSQL engine compiled to WebAssembly in single-user mode. The fixture supplies a minimal synthetic `auth.users` schema and a transaction-local `auth.uid()` claim shim. These checks exercise actual PostgreSQL grants, RLS, JSONB, functions and CAS. They **do not** verify hosted Supabase Auth, PostgREST JWT verification/email delivery, real simultaneous PostgreSQL connections, or production settings. The HTTP harness separately exercises both production client protocols against this isolated engine; its authentication gateway is synthetic.

Official runtime documentation: [PGlite API](https://pglite.dev/docs/api), [PGlite source](https://github.com/electric-sql/pglite).

## Approval and rollback prerequisites

Before any production deployment, obtain explicit approval for the destination project and exact migrations; take an owner-only backup of learning state/activity rows, configuration and existing RPC function definitions. Inspect enabled application triggers and existing malformed records without printing learner content. Apply the full proposals transactionally, retain the existing Supabase UUID identities, and reload the PostgREST schema cache. Existing Sites/D1 users must explicitly authenticate their Supabase account and choose whether to import guest/legacy progress. Never join accounts by a matching email.

`202610140001_lucid_shared_progress.rollback.sql` is a non-destructive RPC compatibility pause. It keeps existing shared snapshots during later legacy saves and visibly rejects new shared payloads instead of dropping their work. Private lookup tables and helpers remain available. Pause new shared clients before applying it; restore the saved forward RPC definition to resume. The actual PostgreSQL rollback test verifies retained rows, legacy compatibility, blocked new writes and transactional restoration of the original function. Installation never silently rewrites/deletes learning records.

Live migration, public auth enablement, real email/two-device acceptance and deployment remain separately approved production actions. No production database, learner data, SMTP setting or paid service was changed during these tests.
