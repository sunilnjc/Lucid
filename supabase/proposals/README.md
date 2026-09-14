# Pending payload-validation hardening

Status: source-reviewed proposal only, 14 September 2026. **Not executed against PostgreSQL and not deployed.** These files intentionally sit outside `supabase/migrations` so a routine migration push cannot apply unverified SQL.

The current RPC enforces ownership and top-level shapes, but malformed nested progress/profile/events can poison the sender's own cloud record. No cross-account bypass was found in this audit. The proposed v2 validator adds nested type/range/field checks before writes and normalizes device preferences. It preserves CAS and immutable activities and does not rewrite existing records.

Before promotion:

1. Use a disposable Supabase-compatible PostgreSQL database. Apply the existing account migration and then the proposed migration there.
2. Run the complete `account-payload-security.sql` script. It checks collisions/triggers, creates only synthetic accounts inside a transaction, and ends with ROLLBACK. If execution stops on an assertion, explicitly roll back before retrying.
3. Verify the real Swift-encoded fixture is accepted, all 38 malformed variants return PT400 atomically, and isolation/CAS/immutable-event cases pass. All final synthetic-row counts must be zero.
4. Review compatibility limits: native Foundation dates, 128-character identifiers, 512-codepoint names, 1–3-word daily plans, interval 0–4, integer counters, and settings bounds. Future schemas need an explicit migration. Existing invalid history needs a deliberate repair decision, never silent deletion.
5. After successful isolated tests, promote the migration and tests to their normal directories. Inspect existing state safely before any intended backend rollout.

No local PostgreSQL runtime or usable Docker server was available during this pass. No database, SMTP, real account or paid service was changed. Real email, two-device recovery and deletion acceptance are separate release gates.
