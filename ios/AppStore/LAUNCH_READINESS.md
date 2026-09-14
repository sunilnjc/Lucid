# Lucid — October 2026 launch preparation

Updated 14 September 2026. Native learning-path development plus a separate free Supabase backend. Resend email delivery and private Debug sign-in are now connected; no paid plans activated. The latest UI/account QA findings, verified fixes and remaining gates are recorded in [QA_REPORT.md](QA_REPORT.md). Public/Release authentication remains disabled.

## What a professional should experience

Open Lucid and feel recognised. See a realistic amount of work, practise words that fit the job, recall them later, and see evidence of progress. A short session should be useful even without a perfect streak. Work should survive interruption, a bad connection, or an app update.

## Experience changes implemented locally

| User need | Product response |
| --- | --- |
| Remember what I was doing | Saved drafts, atomic durable records, recovery backup, visible save failures |
| Let me choose a manageable pace | One, two, or three words; role/seniority/situations/goals; optional name |
| Keep my work when I change jobs | Save and open Today updates cards for the selected role immediately; same-day return restores that role's plan, with all earned work retained |
| Make the next step obvious | One focused learning card, word steps, progress ring, next-word and completion actions |
| Help me recall, not only recognise | Attempt before reveal; sentence practice; independent recall distinguished from using a hint |
| Make progress rewarding | Activity streak, weekly practice, XP, milestones, completion sheet and restrained haptics |
| Don't punish a missed day | Supportive copy; review-only days count; learning history remains |
| Let me leave and return | Draft persistence, same-day progress, foreground/midnight refresh, no duplicate rewards |
| Protect my data without a subscription | Guest use, iOS-protected local saves, portable backup/restore from Welcome or Settings |
| Keep it readable | Dark teal palette, scalable headings, adaptive controls, accessibility labels, Reduce Motion |
| Handle my phone properly | Stop recording on leaving/backgrounding; guard late permissions; restore audio; cancel reminders on reset |
| Be honest about the collection | Remaining one/two words served; exhausted role collections become review days |
| Review language for my current work | My role queue by default, explicit All roles opt-in, scoped counts/dates, six corrected shared-word contexts |
| Leave practice without losing my place | Home on every main tab returns to Welcome; re-enter opens Today with existing drafts/progress |
| Browse vocabulary relevant to my role | Library opens on the full selected-role collection; All roles is explicit, stale filters/detail pages reset, and saved words stay scoped |

## Bugs addressed

- Silent reset after unreadable data; corrupt/newer-version evidence is preserved.
- Sentence drafts lost after restart.
- Duplicate same-day practice/review rewards and interval advancement.
- Yesterday's lesson completed under today's date.
- Words marked introduced simply by viewing Today.
- Last unseen words skipped and familiar words labelled new.
- Profile discarded before editing was confirmed.
- Reveal treated as demonstrated recall.
- Hinted review becoming independent recall after closing and reopening the app.
- Restore requiring a new profile first; explicit choice now restores the backup profile or keeps the current one.
- Damaged files blocking all recovery; an explicit backup restore now preserves protected copies before recovery, without downgrading newer-version data.
- Substring matches such as material inside immaterial.
- Overconfident usage claims from mechanical pattern matching.
- Recording left alive after switching screens; late permission callbacks.
- Typing during dictation being overwritten by the next transcript update.
- Racing reminders and notifications surviving erasure.
- Feedback double submission.
- Role label changed while the previous role's three cards stayed visible; same-day role plans now change immediately and restore on return without duplicate rewards.
- Daily bonus incorrectly made a newly selected role appear complete; active practice and once-daily bonus now have separate states.
- Review kept showing a global Finance-heavy queue after role changes; default scope now follows the selected role, with prior roles kept separately.
- Restored already-reviewed words could remain stuck as due cards; queues and save guards now both exclude same-day completed reviews.
- Library retained All words after a role switch, its empty-state reset widened to every role, and an earlier word-detail page could remain open. Role/account/tab-entry resets now restore My role without deleting learning or bookmarks.

## Finance learning path

- Six chapters, 30 lessons, 90 active words: close reporting → performance → forecasting → evidence → stakeholder decisions → executive communication.
- 79 new entries plus 11 reused entries; 143 words across the shared catalogue (134 active, 9 recognition).
- Three target words per lesson, workplace challenge, example answer and private saved draft. Learners select 1–3 words per day, so lessons can span days.
- Daily selection follows the path while preserving an existing same-day plan and progress. Other roles retain their smaller relevance-based starter collections.
- Roadmap previews never award practice credit. Words-started progress is separate from spaced-review mastery.
- Independent editorial pass corrected nine fields across six lessons; external professional/pilot review is still required.

## Authentication — private native preview connected

The separate Free Supabase project has the learning tables, security policies and verified-user deletion function. Live anonymous-denial and transaction-scoped two-account isolation/CAS/private-field tests passed, with all test records rolled back. Resend now sends Lucid-branded OTP emails from the verified `auth.learnwithlucid.com` subdomain. Both signup and returning-user email deliveries passed; real native login and Keychain relaunch passed on the normally signed isolated simulator without guest import. Debug sign-in is enabled and the new build installed/launched on the owner's iPhone at 19:04. Release authentication/email remain NO. Physical sign-in, second-device restore/conflicts, deletion and public privacy acceptance are still launch gates. See AUTH_SETUP.md.

## Verification from this local development pass

- **140 native test groups passed**: 27 learning/persistence, 10 path progression, 12 mocked Auth protocol, 11 mocked account lifecycle, 8 learning QA, 20 account QA, 12 role-switch, 9 role-switch edge, 15 review/navigation and 16 Library groups. New cases cover post-OTP Keychain/disk failures and fresh-code recovery. Coverage also includes all 56 ordered role changes, queue scopes, shared-word contexts, opt-in previous-role review, stale reviewed-card guards, reversible navigation, persistence, reward guards and mocked sync races.
- **9 deletion authorization tests passed** against the source with a mocked Supabase client, including old-token, subject/role/session and cross-device reauthentication checks.
- **3 repository consistency checks and 12 UI source contracts passed** for catalogue/project, existing support/privacy routes, navigation, input gates, recovery affordances, role-save/completion, new-account welcome exit and review/Home/Library wiring. Canonical/exported words and paths deep-compare; all six role contexts validate. These are not a substitute for interaction or App Store review tests.
- **Debug simulator and unsigned Release device builds passed.** Signing, upload, and App Store review are not verified by an unsigned build.
- **Role-switch follow-up:** final Debug simulator and signed Debug iPhone builds passed, with strict code-signature and source-copy verification. This does not verify App Store distribution signing or real email delivery. Native cloud payloads remain v2; local role-plan caches are excluded.
- **Review/Home follow-up:** final Debug simulator and signed Debug iPhone builds passed. Agent-owned simulator interaction verified Home return/re-entry, current-role technical review, rating/advance, scope-aware empty state/date, and explicit older-role opt-in. Temporary fixture data never touched the user's phone.
- **Library follow-up:** final Debug simulator and signed Debug iPhone builds passed, with strict signature/source-copy checks. Isolated simulator interaction verified the 22-word Technology collection, saved-only empty state, Reset to my role staying at 22 words, word details/back, and saving/filtering one bookmark. Native tests cover explicit all-role browse and role/account/navigation resets; coordinate automation still blocks complete tab/picker interaction acceptance. Original simulator primary/recovery records were restored.
- **Latest email preview build inspected:** Debug authentication/email=YES/YES, Release=NO/NO; explicit dark interface style. Signed Debug device and simulator plus Release simulator builds pass. Twelve UI source contracts and three email-template groups pass. The native catalogue exports successfully and its 90-word path invariants pass.
- **Isolated canonical-catalogue TypeScript check passed with zero diagnostics.** This does not substitute for the stalled full web build below.
- **Current web validation limitation:** the full Sites build and TypeScript check stalled while reading existing `node_modules` files (including `vinext/dist/server/cache-control.js` and `@types/node/v8.d.ts`). The stalled checks were stopped without replacing dependencies. No successful full web build or website deployment is claimed for these changes.
- **Current simulator check:** dark Welcome with Restore and no unavailable signup; setup Back/selection guidance/completion; Today → path → lesson → direct return to Today passed on isolated Lucid Launch QA. Input/control remained intermittent. Full typing, dictation, file-picker, VoiceOver and maximum-text-size flows still need device acceptance.
- **Privacy manifest syntax and diff whitespace checks passed.** The new JavaScript test runner passed syntax checking. ESLint could not complete because an existing `node_modules` dependency read was cancelled; the dependency installation was not modified.
- The user created the Free development backend and purchased the domain. Its existing migration/deletion function are unchanged by email setup. No additional purchase, subscription, website deployment, Git commit or remote push was made. Email sign-in is activated only for private Debug testing.

## Highest-priority work still required before launch

1. **Professional content review.** Finance now has a complete first 90-word path. The other seven roles still have smaller starter collections; do not market those as equally complete paths. Pilot the Finance scenarios and outcomes before broad marketing.
2. **Live account verification.** Email delivery/native simulator sign-in now work. Verify physical-iPhone login, two-device restore/conflicts, expired sessions, guest-import consent and deletion on an approved disposable account. Keep free plans; no automatic upgrades.
   Validate the nested-payload SQL proposal in a disposable database before promoting it to migrations. It is intentionally excluded from automatic deployment and its tests have not been executed against PostgreSQL.
3. **Feedback quality.** Current checks detect word presence, length and reference phrases; they do not assess meaning or grammar. Keep this explicit. Use curated examples and self-comparison; do not advertise an AI tutor.
4. **Device acceptance.** Physical iPhone permissions, interruptions, VoiceOver, maximum Dynamic Type, Reduce Motion, offline relaunch, export/restore, and low-storage failures.
5. **Pilot with 10–20 professionals.** Ask whether they used a word at work, what felt difficult, whether the pace fit, and why they returned. Obtain consent before remote analytics.
6. **Release operations.** Verify signing, SDK, icons/screenshots, privacy answers, support contact and public policy against the exact enabled release capabilities.

## Four-week sequence

- Week 1: use the local build and fix usability/content issues in one or two target roles.
- Week 2: verify free-tier account infrastructure/recovery; complete privacy and support.
- Week 3: small professional pilot; refine content, accessibility and return habit from observed behaviour.
- Week 4: release candidate, real-device checks, screenshots, signing, review access and submission.

Passing a local build does not make the app ready for public release. Accounts, public disclosures, content review and a device pilot remain release gates.
