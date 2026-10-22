# Daily vocabulary and idioms

Local feature implementation notes, 15 October 2026; **pending publication**. Public version 5 is unchanged. This document describes the source behavior; it does not certify physical-device acceptance or hosted sync activation.

## Learning experience

Today offers **Today’s Words**, **Today’s Idiom** and **Review**. The daily collection adds five words by default, with **Add 3 more words** unlocking the remaining three. The idiom is additional and never replaces one of the words.

The existing course pace of one, two or three words remains the learner’s saved setting. Existing course placement, lesson cards, schedules, history and bookmarks are retained. There is no silent migration of that setting to five or eight, and the earlier optional ten-word discovery remains separate.

Word cards use the canonical professional catalog, including the selected role’s meaning and work example. They show existing written pronunciation guidance when supplied, plus usage, common combinations and cautions. No missing pronunciation or level claim is generated. Web speech stays removed; native retains its existing speech behavior.

Learners can try a private meaning or sentence before revealing guidance. The response becomes read-only after reveal. Exploring, writing or revealing earns no mastery, successful review or points. **Add to spaced review** explicitly starts an unintroduced role context for tomorrow. Existing role/sense review evidence counts as already in review even if a legacy introduction anchor is missing; adding it again does not manufacture an anchor or reset its schedule. Later word reviews use the established review and evidence rules.

## Daily selection

`lib/daily-vocabulary.ts` and native `DailyVocabularyEngine` use the same catalog IDs, ID ordering, role hash and calendar-day arithmetic. Selection prefers active role entries carrying the existing editorial `c1` catalog tag, using other active role entries if that pool is small. This tag is not a validated learner proficiency level. “Advanced” here means useful, precise professional language.

The first eight selected IDs are saved for each day and role. Only five are initially visible. Unlocking the extra three, reloading or returning to that role does not redraw the collection. Terms and IDs are unique within it, and the saved course cards for that day are excluded. Rotation may revisit vocabulary on later days; seeing a term again is not new mastery.

The day comes from the client’s existing learning-day rules: the selected web time zone or native local calendar. Rotation converts that resolved `YYYY-MM-DD` key to a UTC ordinal, so it is calendar-based rather than a rolling 24-hour timer. Invalid dates are rejected. A new day gets a new collection; yesterday’s saved work is retained. Stale day, role or account UI actions are guarded before saving.

## One useful idiom

`lib/daily-idioms.ts` is the canonical source for 14 common expressions. Each includes an original meaning, natural example, register, context, plain-English alternative and an optional caution. Dictionary sense-check links are retained as editorial metadata; there is no runtime dictionary or AI request. Use `npm run ios:content` to regenerate `ios/Lucid/Lucid/Resources/daily-idioms.json` rather than editing that JSON separately.

There is one pinned idiom ID per day across roles. Selection uses the positive UTC-day ordinal modulo the fixed catalog order; the catalog repeats after 14 days. Switching roles does not create another daily idiom. Previously queued idioms may also appear when due, clearly labeled as reviews.

Revealing an idiom freezes the original private response, including an empty response. Review is opt-in through **Add idiom to spaced review**, first due tomorrow. A due self-check asks the learner to recall before revealing and then compare their original answer. **I remembered it** requires a nonempty original captured before reveal; **Practise again** remains available if no original was captured. Only one assessment per idiom per day advances the schedule.

Idiom self-checks reuse the 1, 3, 7, 14 and 30-day interval ladder. A remembered original advances one step, capped at 30 days; practice again resets to tomorrow. These are ungraded self-reports, kept separate from word recall evidence, word mastery, course completion and points.

## Persistence and privacy

The additive optional sidecar is version 1. Native stores it at `LearnerData.dailyVocabulary`; web stores it at `learningV3.dailyVocabulary`. Its maps are:

- `collections`: day-and-role word IDs, optional-extra state, revealed IDs and private drafts.
- `idiomsByDay`: one pinned idiom ID per day.
- `idiomPractice`: day-and-idiom private draft, frozen original, reveal and assessment state.
- `idiomReviews`: local idiom introduction and self-check schedule.

Private drafts are bounded to 2,000 characters. Sidecar validation checks canonical active role-word IDs, unique normalized terms, known idiom IDs and valid calendar keys. Unsupported future daily-sidecar versions require an update and must be rejected before replacing saved records. Existing account-scoped storage and save-failure handling apply. The daily sidecar, its responses and idiom schedules are excluded from ordinary web guest/D1 and shared-account projections. Existing safe word-guidance exposure and explicit word introductions still use the established learning metadata flow. No raw daily response is part of that flow.

An explicit private portable backup includes the sidecar, allowing a deliberate restore between current web/native clients. Normal remote pulls retain the current device’s daily work rather than importing another device’s private sidecar. Backup merges preserve locally pinned collections and original responses; matching collections can union unlocked extras and reveal state. If either saved idiom attempt was already revealed with an empty or whitespace-only original, the merged original stays empty. Importing a nonempty response cannot turn that known supported attempt into remembered recall. Idiom schedule conflicts use conservative earlier due dates/lower intervals, retain the greatest review count and never add the counts together. Keep these backups private.

Portable exports on both clients are capped at **2,000,000 encoded bytes**. Daily work is retained without automatic pruning; a long history or large private sidecar can therefore reach that limit. Export fails without deleting local learning. Native shows a clear message that learning is still saved and asks the learner to contact support before moving or clearing the device. Do not silently trim history or drafts to make an export fit.

This feature requires no hosted database migration, authentication flag, new provider, new service, subscription or notification permission. It does not activate production sync, create reminders or revive an earlier vocabulary chat schedule.

## Source and verification boundaries

- Web selection/actions: `lib/daily-vocabulary.ts`; sidecar types, validation and explicit merge: `lib/daily-vocabulary-state.ts`.
- Web UI: `app/DailyVocabulary.tsx`, integrated with `app/VocabularyApp.tsx`.
- Native behavior/models: `ios/Lucid/Lucid/DailyVocabulary.swift`; UI: `DailyVocabularyViews.swift`.
- Idiom content/export: `lib/daily-idioms.ts`, `scripts/export-ios-content.mjs` and the generated native resource.
- The actual native Codable regression harness includes the production daily declarations, so the optional model dependency is compiled rather than mocked.

Focused automated checks cover content parity, daily rotation and date validation; feature integration checks should additionally cover optional extras, reload/backup preservation, account isolation, save failure, stale actions and review credit. Record final test totals and hands-on acceptance in the current task’s completion evidence. This document makes no runtime or full-suite pass claim.
