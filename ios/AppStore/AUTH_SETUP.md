# Email accounts — Resend connected, private native preview

Updated 14 September 2026. The user created the separate `lucid-vocabulary` Supabase project and purchased `learnwithlucid.com` on Cloudflare. Lucid now uses a dedicated sending domain and restricted Resend key within the existing free services. No paid-plan upgrade, subscription or additional purchase was activated during setup. JobPursuit's project, sender and key were not changed.

Development project: `idhnrnqrpyimknakpyrn`, Singapore; public endpoint `https://idhnrnqrpyimknakpyrn.supabase.co`. Its public publishable key and URL are in ignored `ios/Lucid/Config.local.xcconfig`. No administrative or email credential is in the app or Git.

Debug enables both cloud authentication and email delivery for the owner's private preview. Defaults remain `NO`, including Release. The account screen explicitly discloses preview cloud/email processing and the guest-only status of the public privacy page. Guest learning remains available offline; importing guest history is unchecked by default. Native configuration contains only the Supabase public URL/client key, never the SMTP credential.

## Email delivery configured and tested

- Resend domain: `auth.learnwithlucid.com`, Ireland (`eu-west-1`), verified 14 September 2026. Domain ID `f2b543b5-1deb-4db6-912d-c0bf02396fb5`.
- Cloudflare DNS: DKIM TXT at `resend._domainkey.auth`, MX priority 10 at `send.auth` pointing to `feedback-smtp.eu-west-1.amazonses.com`, and SPF TXT at `send.auth` containing `v=spf1 include:amazonses.com ~all`. Public and authoritative DNS checks passed.
- Auth-only DMARC TXT at `_dmarc.auth`: `v=DMARC1; p=none;`. No root-wide policy, reporting mailbox, receiving service or website records were added. This initial policy does not reject spoofed mail; tighten only after delivery/alignment checks.
- Supabase SMTP: sender `Lucid <login@auth.learnwithlucid.com>`, host `smtp.resend.com`, port 465, username `resend`, 60-second per-user interval. SMTP password is the dedicated **Lucid — Supabase Auth** sending-access key restricted to this domain (key ID `01f85440-9a5a-40f6-b7e4-9268972481e6`). Its value is stored only in Supabase's encrypted SMTP settings, not source, logs or native configuration.
- Both hosted templates saved: `supabase/templates/confirm-sign-up.html` (subject **Confirm your email for Lucid**) and `sign-in.html` (subject **Your Lucid sign-in code**). Each has exactly one `{{ .Token }}`, no sign-in URL, trackers or remote assets, and instructions to enter the code in Lucid. No web callback/deep-link flow is claimed. Previous default bodies are recorded in `dashboard-defaults-20260914.json` for rollback, not deployment.
- Real owner-account signup email delivered at 18:56 Dubai time (Resend email `34043be8-3939-443b-8ec4-8ccac3e4cf39`). Returning-user email delivered at 18:59 (`9c5925f4-2965-4106-9c3b-9c8ae3aa2343`). Both had the correct Lucid sender, subject and rendered code; codes/tokens were not logged. Delivery status is provider evidence, not a claim of testing every mailbox/client.
- Native returning-user verification and Keychain persistence succeeded in the normally signed, isolated **Lucid Launch QA** simulator. Relaunch retained the account. Guest history was not imported; the empty account correctly offered personalisation. The final build's pre-onboarding sign-out action returned to the separate original Finance guest plan, and Home again offered sign-in.
- The first unsigned simulator run verified the signup code but could not store the session: securityd reported `-34018`, missing app/Keychain identity. Normal simulator signing fixed it. `npm run ios:build` no longer disables signing. Do not work around Keychain by saving tokens in ordinary files or adding unrelated access groups.
- Post-verification persistence failures now require a fresh code and clear the entered code while preserving the resend cooldown. Two mocked regression groups cover Keychain/disk failures for guest and existing users plus wrong/offline pre-verification controls.

The services retain their free-tier limits. Resend's allowance is shared with other applications in this team; this is not unlimited production capacity. Supabase's initial custom-SMTP limit remains 30 emails/hour. No quota was raised or load-tested by sending bursts.

## Completed in the development project

- Applied `202609140001_lucid_accounts.sql`: isolated state/activity tables, RLS, authenticated own-row reads, compare-and-swap RPC, immutable activity UUIDs, private draft/review-attempt rejection and deletion cascades.
- Deployed `delete-account`; legacy-only JWT gateway verification is OFF. The function performs live `Auth.getUser` validation plus matching subject, authenticated role, session ID and a recent session-bound OTP check before deletion. Administrative credentials stay in Supabase's function environment.
- Verified anonymous table/RPC requests and missing/invalid deletion bearers return 401.
- Ran a transaction-scoped live SQL smoke test: own read, two-account isolation, direct-update denial, stale CAS rejection/atomicity, both private-field rejections, immutable event preservation and omitted-history retention. The final query confirmed zero synthetic users, states or events remained after rollback. The more extensive reusable `supabase/tests/account-security.sql` suite is prepared but has not itself been run end-to-end.
- Added 12 mocked Auth protocol groups, 11 mocked account lifecycle groups and 9 mocked deletion-authorization tests. They do not send emails or use the user's Keychain.

## Remaining launch gates

Email delivery is no longer the setup blocker. Second-device restore/conflicts, expired sessions, physical-iPhone acceptance, guest-import consent, and real account deletion still need end-to-end acceptance. Do not delete the owner's account for a test; use an explicitly approved disposable account. Do not describe accounts as launch-ready.

The native privacy manifest now declares account-linked email for app functionality, with no tracking. Before enabling Release, update and publish the public privacy policy and App Store privacy answers. The public website remains unchanged and guest-only; the new domain is configured for sending email, not website hosting or a receiving mailbox.

## Prepared integration

- Supabase email one-time-code request/verification via native HTTPS.
- Keychain session storage and token refresh.
- Separate account UUID storage scopes; guest learning is imported only when explicitly selected.
- Per-user Postgres RLS, compare-and-swap state revisions, immutable UUID activity records, and cascades on deletion.
- Offline local persistence first; retry on foreground and manual sync. Drafts and local reminders are excluded from upload.
- In-app account deletion after fresh session-bound email verification.

This is passwordless email login, not enterprise SAML SSO. Google/Apple sign-in has not been configured.

## Finish authentication without a paid plan

1. Keep the existing separate Lucid development project; do not reuse Job Search tables or create a duplicate project.
2. Review/run the full rollback-only SQL test if needed. Do not rerun the non-idempotent initial migration against existing tables.
3. The deletion function is deployed. Re-deploy reviewed source only when changing it, retaining live bearer and recent OTP validation.
4. Keep both tested OTP templates aligned with source. Verify real wrong/reused/expired-code recovery and rate-limit messaging without exhausting the email allowance.
5. Keep Resend/Supabase free plans and existing rate controls. If launch volume needs a paid plan, report the constraint before any upgrade.
6. Keep the existing ignored local connection config. Debug delivery is now enabled; do not enable Release merely because SMTP works. Use only the public publishable client key in the app.
7. Verify actual two-device restore, offline merge, expired sessions, guest import, account switching, and deletion while another device is offline.
8. Update and publish the public privacy page, App Privacy questionnaire and privacy manifest to include email and account-linked learning activity before enabling cloud accounts in a release build. The current public page still describes the guest-only release and was not deployed in this session.

## Essential negative tests before activation

- Anonymous requests and account A cannot read/write account B.
- Direct table inserts/updates are denied; RPC derives ownership from auth.uid().
- Simultaneous writes: one succeeds, the stale one receives 409 and merges.
- Repeating an event UUID does not duplicate activity/rewards.
- A deleted user's old JWT and offline queue cannot recreate data.
- Another device's recent login does not authorise an old token to delete.
- Lost connection after deletion, Keychain failure, and cleanup failure have recoverable states.
- Cloud restore does not overwrite a draft made while an upload was in flight.
- Verify actual provider refresh/logout behavior.

## References

- [Resend SMTP with Supabase](https://resend.com/docs/send-with-supabase-smtp)
- [Resend DMARC setup](https://resend.com/docs/dashboard/domains/dmarc)
- [Supabase email OTP](https://supabase.com/docs/reference/swift/auth-signinwithotp)
- [Apple privacy data types](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacycollecteddatatypes/nsprivacycollecteddatatype)
- [Email delivery restrictions](https://supabase.com/docs/guides/auth/auth-smtp)
- [Row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Apple account deletion requirement](https://developer.apple.com/support/offering-account-deletion-in-your-app)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
