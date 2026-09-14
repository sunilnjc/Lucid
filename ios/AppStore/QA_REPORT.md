# Lucid UI and account QA — 14 September 2026

## Outcome and scope

**Latest update — email setup at 19:04 Dubai:** Resend/Supabase email delivery is connected and both real owner-account signup and returning-user messages were delivered. The normally signed QA simulator verified login and retained it after relaunch; guest import remained off. The signed Debug app installed in place and launched on the connected iPhone at 19:04. Physical sign-in/restore acceptance is still pending. Public/Release auth remains off. The chronological sections below describe earlier builds and their then-current limits.

The native iOS app is safer and easier to navigate, but it is **not yet signed off for App Store release**. Three parallel audits covered learning/persistence, account protocol/backend boundaries, and usability/accessibility. Root integrated the fixes below and ran local verification.

The initial QA pass changed local source and an isolated simulator. The subsequent role-switch correction below also targets the connected iPhone. Neither pass published the website, deployed SQL/functions, sent real email/feedback, deleted real accounts, committed/pushed Git changes, or activated paid services. Existing user work and signing configuration were preserved. Sites safeguards kept the shared web project unpublished.

## Role-switch correction — 14 September follow-up

The earlier installation did not include the main role-switch fix. The old `prepareToday` returned as soon as the calendar day matched, even after the profile's role changed. Finance → Technology therefore kept `reconcile`, `discrepancy`, and `outstanding` under the Technology label.

- Saving a different role immediately creates/restores that role's daily cards and opens the root Today screen. Cancel leaves the current plan unchanged; failed saves keep the editor open and show an error beside its action.
- Optional local-only `lessonRoleId` and `dailyRolePlans` preserve each visited role's cards across same-day switching and relaunch. Older valid same-role plans retain their original order/pace; off-role, malformed and empty-but-not-exhausted plans are repaired.
- Completion credit remains day-wide. Drafts, favourites, introduced words, reviews and XP survive role changes. Shared vocabulary keeps its prior credit; the 20 XP lesson bonus is awarded only once a day, even after restoring an event without a session.
- Active-card completion is separate from earning the day's bonus. A new role no longer appears finished simply because another role was completed. Returning opens the first unfinished card.
- Merge associates same-day cards with the selected profile's role and normalizes before upload and after raced edits. A newer remote role selection can intentionally replace a conflicting older local daily plan for cross-device consistency; earned work is retained. Ordinary local A → B → A returns remain stable. Explicit guest import carries visited plans; non-consented account changes do not.
- Both new metadata fields are stripped from cloud v2 payloads. No backend schema change or authentication activation is required.
- Non-Finance roles display their actual active starter-collection counts and state that a chapter-by-chapter course is not available. Finance remains the only complete 90-word course. Reviews explain that learned words from previous roles still return.

Verification: **107 native groups passed** (the prior 86 plus 12 role-switch and 9 edge groups), including all 56 ordered changes between different roles. The initial role harness reproduced 10 failures out of 12 groups before correction. All 9 mocked deletion cases, 3 repository checks and **8 UI source contracts** pass. Final Debug simulator and signed Debug physical-device builds pass; strict code-signature verification and exact native-source copy comparison pass.

The updated simulator launched and displayed dark Welcome/Today with the expected Finance cards. Tap automation failed with `noWindowsAvailable`; full sheet dismissal/tab navigation is not claimed as interaction-tested. No real cloud/email/account tests were run by these regressions.

**Physical delivery:** the corrected signed app installed in place on the connected iPhone 14 Pro Max at 17:23 Dubai time on 14 September 2026 and launched successfully at 17:23:50. The existing app was not uninstalled or reset. This verifies installation/launch, not hands-on acceptance of every interaction or the contents of the user's private learning record.

## Review relevance and Home correction — later 14 September follow-up

The 17:23 build still deliberately displayed reviews from every role, which did not match the learner's expectation after changing roles. Welcome also had no return route from the main tabs. These are corrected in the later build:

- Review defaults to **My role**; **All roles** is explicit opt-in. Changing roles, opening Review from a shortcut, or returning Home resets that opt-in. The tab badge, Today shortcut, celebration shortcut, remaining count and next-review message use the relevant scope. An empty new-role queue never falls back silently to Finance.
- Old reviews and schedules remain stored. Shared words are matched using role tags, not identifier prefixes. Unpractised words are not manufactured as reviews.
- Review presents one question at a time. Revealing does not finish the review: the learner selects a rating to save and advance. The next question scrolls into view; headings have accessibility focus. Save failure announcements no longer claim success.
- A stale due date plus an existing same-day review event or legacy `lastReviewedOn` no longer renders an unfinishable repeated card. Both display and mutation guards prevent duplicate review credit.
- Six curated role-specific contexts correct five shared words: Consulting material/substantiate, Operations variance, Sales run rate, and Technology/Operations triage. Meanings, examples, pairings, usage warnings and missions update together. Word IDs/history stay shared; original Finance/Healthcare wording is preserved. Lookup applies to Today, Review, Library and usage checks.
- **Home** is available in all five main-tab navigation bars. It returns to Welcome without signing out or resetting learning/drafts. Welcome always reopens root Today rather than the last-selected tab or nested lesson.

Verification: **122 native groups passed** (107 previous plus 15 review/navigation groups), **9 mocked deletion cases**, **3 repository checks**, and **10 UI source contracts**. Exported iOS words/paths now deep-compare to the canonical TypeScript catalogue; all six context payloads validate. Isolated catalogue TypeScript check: zero diagnostics. Final Debug simulator and signed Debug iPhone builds and strict code-signature/source-copy verification pass. No website, backend, live account or email changes were made.

Simulator interaction used a temporary three-word fixture in the agent-owned Lucid Launch QA simulator, never the user's phone data. Observed Welcome → Today → Home → Welcome → Today; Technology's one relevant review with technical triage wording; reveal → Again → current-role queue empty with tomorrow's next date; explicit inclusion of two older Finance reviews; rating an older review replaces it with the next question and decreases the badge. The simulator's original guest record and recovery copy were restored after testing. Full VoiceOver, all device sizes and physical-device interactions still require hands-on acceptance.

**Physical delivery:** the final Review/Home build installed in place on the connected iPhone 14 Pro Max at 17:39 Dubai time on 14 September 2026; launch succeeded. The phone app was not uninstalled or reset, and no test fixture was written to it.

## Library relevance correction — later 14 September follow-up

The Library's original role predicate was correct, but the surrounding screen state was not. Local All words/search/saved filters survived a role switch, an empty-state Clear filters action switched to all roles, and a retained navigation stack could reopen an old contextual word-detail snapshot. None of these behaviors should be inferred as actions the user necessarily took; they are the confirmed code paths behind the reported symptom.

- Store-owned Library scope, search and saved-only filters reset on actual role changes, account scope changes, entry from another tab, Home and the Today Library shortcut. In-Library detail/back browsing preserves intentional filters.
- Library defaults to **My role**; **All roles** requires explicit selection. **Reset to my role** restores the current-role catalogue, never an automatic all-role fallback. Empty saved results explain how to browse and that earlier-role bookmarks remain stored.
- Role changes/reset entry replace the Library navigation identity, discarding stale detail pages. Search matches the displayed role-contextualized meaning. Shared vocabulary is matched by role tags, not word identifier prefixes.
- The heading names the active role, reports the filtered count and explains that Library is the role's full collection, not only today's cards or previously introduced words. Shared words are labelled; explicit All roles lists each word's role labels.
- Library browsing/reset remains ephemeral: no new practice credit, rewards, learning-record writes, bookmark deletion or catalogue mutation.

Verification: **138 native groups passed**, including **16 new Library groups** and all 56 ordered role switches. Cases cover combined search/saved/scope filtering, role and same-role account resets, remote profile updates, no-profile/no-results behavior, shared contextual search, full unlearned/recognition catalogue inclusion, navigation resets and persistence purity. **9 mocked deletion cases, 3 repository checks and 11 UI source contracts** pass. Final Debug simulator and signed Debug iPhone builds, strict signature verification and exact native-source-copy comparison pass.

An isolated Technology exhausted-collection fixture in **Lucid Launch QA** verified Welcome → Today → Open my word library, the 22-word Technology header and list, Saved words only → empty, Reset to my role → the same 22 words, word-detail/back, and saving a word → one matching saved result. The original simulator primary and recovery records were restored afterwards. No test fixture was written to the phone. Coordinate clicks still failed with `noWindowsAvailable`, so actual All roles picker/tab switching is covered by native state tests, not signed off as UI interaction. No website, backend, live email or account changes were made.

**Physical delivery:** the final Library build installed in place on the connected iPhone 14 Pro Max at 17:53 Dubai time on 14 September 2026. Automatic launch at 17:54 was refused because the phone was locked; the learner must unlock and open Lucid. Installation succeeded, but this is not a verified physical-device launch or interaction pass. The app was not uninstalled or reset. The final simulator build launched successfully with its original guest records restored.

## Reproduced learning and account defects fixed locally

### Email activation follow-up

- Verified `auth.learnwithlucid.com` with Cloudflare DKIM/SPF/return-path DNS and an auth-only initial DMARC policy. Saved a domain-restricted Resend sending key in Lucid's Supabase SMTP settings. Sender is `Lucid <login@auth.learnwithlucid.com>`. No paid upgrade, JobPursuit change, website publication or Git push.
- Replaced both signup and returning-user hosted templates with source-controlled, code-only Lucid emails. Three source-contract groups reject 13 regression examples including duplicate codes, old branding, links, remote assets, low contrast and ten-digit overflow at a 320px width estimate. Real mail-client rendering remains a separate acceptance check.
- Found and fixed a QA setup issue: `CODE_SIGNING_ALLOWED=NO` stripped the simulator's Keychain identity; securityd returned `-34018`. Normal signing allowed real session persistence. No insecure token-storage fallback was added.
- Found and fixed post-verification recovery: after an accepted OTP, local file or Keychain failure now requires a fresh code rather than inviting replay. The input clears but the email and resend cooldown remain. Two new mocked native groups cover guest/current-user failures plus wrong/offline pre-verification controls, proving no active scope/session replacement or upload.
- New users can see their signed-in email and sign out/change email from Welcome before completing onboarding. Authentication remains optional. The Debug preview explicitly explains Supabase/Resend processing; the native privacy manifest declares email collection, no tracking. Public privacy still needs updating before Release activation.
- Verification: **140 native groups**, **9 mocked deletion cases**, **3 repository checks**, **12 UI source contracts**, and **3 email-template groups** passed. Final Debug simulator, signed Debug iPhone and Release simulator builds passed. Device signature/native-source-copy checks passed; compiled Debug flags are YES/YES and Release flags NO/NO for cloud auth/email delivery. `plutil` validates the privacy manifest.
- Live scope: two owner emails delivered with correct branding; native verification/Keychain relaunch passed without guest import. Final simulator sign-out before onboarding restored the original Finance guest plan, and Home again offered sign-in. No real account was deleted, no synthetic learning fixture was uploaded, and no end-to-end two-device restore/conflict claim is made. See [AUTH_SETUP.md](AUTH_SETUP.md) for evidence and remaining gates.

P1 denotes risk of losing or overwriting learning data. P2 denotes broken recovery, inaccurate learning results, or a meaningful usability barrier.

| Priority | Reproduction / impact | Fix and regression evidence |
| --- | --- | --- |
| P1 | A draft changes while upload waits, its disk write fails, and sync treats the old snapshot as current. | Advance the memory revision even when persistence fails; merge newer memory after upload. Learning QA + failed-final-save negative control. |
| P1 | Same-account email verification fetches cloud data while a new draft/review attempt is edited, or starts with memory-only work. | Reconnect from live account state and re-merge after the await; preserve private drafts and hint evidence. Account QA also verifies guest drafts never cross accounts without consent. |
| P1 | Sign-out saves, waits for remote logout, then discards a newer memory-only draft. | Save again after the await; refuse the scope switch if that save fails. Two logout race tests. |
| P1 | An older client fetches a future cloud schema and writes it back as v2. | Reject unsupported schema, negative revision and duplicate-record responses before merge/upload. Tests prove no upload or local replacement. |
| P2 | Two devices review the same word on the same day: Again followed by Strong could delay it 30 days, inflate XP, or later count toward mastery. | Conservative per-day schedule, XP and independent-success rules; retain legitimate later-day advancement. |
| P2 | “Run rates” and “executive summaries” fail target-word validation. | Accept regular noun-phrase plural forms, with practice and independent-recall regression coverage. This is still a limited pattern checker, not semantic grading. |
| P2 | Damaged primary data plus a newer-version backup permits downgrade recovery. | Check both versions and block recovery/archive downgrade. |
| P2 | An expired session keeps retrying but offers no useful reconnect route. | Pause automatic sync, expose Verify email to reconnect in Settings and the restore gate; respect email availability. |
| P2 | Deletion explicitly refused with HTTP 403 is treated like a lost response: learner is signed out with a pending-deletion receipt. | Keep the account and remove the uncertainty receipt; request fresh verification. Timeout handling remains conservative. |
| P2 | Successful retry leaves stale disk/cloud errors, or guest mode inherits an account's unsaved flag. | Clear recovery status only after confirmed durable save; failed persistence retains work and warnings. |

## UI fixes implemented

- Setup has Back to Welcome, a sticky completion action, and explicit missing-situation/goal guidance. Welcome spacing is reduced so the primary action is easier to reach.
- Unavailable email signup is no longer advertised. Account preview shows an honest unavailable state instead of an editable dead-end form.
- Recovery panels scroll at large text sizes. Catalogue failure no longer offers a storage Retry that cannot reload the catalogue.
- Workplace lessons and the empty Review screen provide Go to today's practice. This resets Today's navigation stack as well as selecting the tab.
- Review explains the minimum five-word requirement before reveal and disables premature Check. Helped/insufficient attempts are described without falsely claiming the learner tapped Hint.
- Check/Save are disabled during dictation or a pending microphone request. The pending request can be explicitly cancelled.
- Writing screens have an explicit keyboard dismissal action and interactive scroll dismissal. Headings/review focus/results have additional accessibility semantics; the audio-speed slider is labelled; metrics use scalable type; word selectors stack at accessibility text sizes.
- Library search trims whitespace and empty filters offer a clear reset across roles/search/saved words.
- Feedback clearly labels its required field and accepts a bug report there. In-flight dismissal and duplicate successful submission are blocked; stale status clears on a new form; the rating picker fits smaller layouts.
- Workplace drafts show Waiting to save after a failed write. Cloud deletion copy describes both local and cloud effects. Dictation discloses possible Apple online processing.

## Verification

### Automated

- `npm run ios:test`: **86 native groups passed** — 27 learning, 10 path, 12 auth protocol, 11 auth lifecycle, 8 new learning QA and 18 new account QA groups.
- `node --test tests/ios-app.test.mjs tests/ios-auth-delete.test.mjs tests/ios-usability.test.mjs`: **9 mocked deletion cases, 3 repository checks and 6 UI source contracts passed**. Source contracts verify wiring, not actual usability or VoiceOver behavior. The test runner uses Node's native TypeScript stripping, avoiding a stalled iCloud-backed dependency read.
- Debug simulator and unsigned Release device builds passed; code was copied outside the iCloud-backed workspace and the native source copy was compared with the checkout before building. Unsigned compilation does not verify distribution signing or App Store submission.
- `git diff --check` passed.

Native account tests use intercepted requests, memory-only session storage and isolated temporary records. They do not test the real email provider or change user Keychain/progress.

### Simulator interaction observed

On the isolated **Lucid Launch QA** iOS 26.5 simulator:

1. Updated app installs and launches to dark Welcome with Restore, without unavailable signup.
2. Personalise opens setup; Back returns to Welcome.
3. Selecting Month-end close changes the missing-selection guidance. Selecting Clarify a complex point enables Build my first lesson.
4. Completing setup opens Today with the expected three Finance path words and zero earned XP.
5. Today → professional path → lesson 1 → Go to today's practice returns to the root Today screen, not the old lesson stack.
6. Empty practice shows disabled Check/Save and explicit dictation/privacy guidance. Opening the editor exposes the software keyboard.

Input/screenshot control was intermittent, including a clipboard-conflict report; no text was observed in the editor after that operation, and no practice or feedback was submitted. Full typing/dismissal, Library filter interaction, feedback success/failure, screen-reader announcements and maximum text-size acceptance are **not signed off** by these observations.

## Open findings / release gates

| Priority | Remaining work | Acceptance needed |
| --- | --- | --- |
| P1 release gate | Real email delivery remains unavailable. Auth is off in Release. | Configure an approved free delivery option, then verify real OTP/resend/expiry, reconnect, offline return, two-device conflicts, and account deletion. |
| P2 backend | The existing SQL RPC validates top-level shapes, not all nested profile/progress/event values. Malformed client data can make the sender's own record unreadable; no ownership bypass was found. | Review and execute `supabase/proposals/` in a disposable database before promotion/deployment. The candidate includes 38 malformed-payload scenarios but SQL execution is unrun. |
| P2 audio | Pronunciation still silently returns on audio-session setup failure and has no in-place playback Stop state. | Add/test playback error and stop feedback, including interruptions, before broad device rollout. |
| P2 accessibility | Larger text, VoiceOver focus/announcements, keyboard dismissal, tab hit targets, filters and feedback journeys need hands-on acceptance. | Small phone + maximum Dynamic Type; VoiceOver headings, review reveal/rating, errors, slider; denied/interrupted dictation; successful/failed feedback. |
| P2 device/storage | Unit-tested failures are not physical-device acceptance. | Real low-storage/offline relaunch, backup export/restore, midnight/time-zone changes, permission changes and notification delivery. |
| Product gate | Finance is the only full 90-word path. Pattern feedback does not assess meaning/grammar. | Professional editorial/pilot review; honest feature scope; improve other roles before claiming equal coverage. |

No full website build or live backend penetration test is claimed for this native-focused audit. The next useful step is a supervised real-iPhone acceptance pass using the updated local build, then the free email/backend release gates above.
