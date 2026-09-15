# Tap-first daily practice

The native daily lesson no longer requires typing or recording. Each course word has a deterministic, role-contextualized recognition challenge: choose a word, complete an example sentence with a meaning cue, or identify a deliberately mismatched definition. Formats follow course position, including at a one-word pace. Options come from the selected role. Known near-synonym groups are excluded, sentence distractors share a coarse grammatical category, and examples without an exact whole-term match fall back to meaning questions. These are guided learning checks, not a language-proficiency or grammar assessment. Professional editorial/pilot review remains necessary.

## Learner journey

1. Open Today to see a compact progress summary and a quick challenge.
2. Tap an answer. Incorrect answers save feedback and invite another attempt; no penalty or XP is applied. A correct answer and its guided practice credit save atomically before Continue can advance.
3. Help me learn this reveals an explanation without credit. Continue then explicitly completes that guided learning step.
4. Pause returns Home; Skip for now moves to another unfinished word, or Home when none remains. The role-specific cursor and submitted feedback resume on this device. Skipping never completes a word.
5. After all words, Continue saves the daily completion bonus once and opens the celebration. Returning to a finished card offers Back to Home. An optional stretch offers Write, Speak, or Help me start. Existing writing is never replaced by the starter; all drafts remain autosaved. No microphone or writing is required for daily completion.
6. Bookmark is separate from practice credit. Reviews still determine independent recall and long-term mastery.

## Persistence and migration

Optional `tapPracticeAttempts` and `practiceCursors` decode alongside existing v2 records without resetting them. Attempts are keyed by day/role/word, include a content signature, and store choice IDs rather than option indexes. Mutations verify the current account generation, role, plan and calendar day. Rollover drops expired tap state while retaining history, bookmarks, written drafts and review schedules. Starting-point checks cannot replace a plan with tap activity or a paused cursor.

Answers, introductions, initial review scheduling and rewards are one local write. A failed write retains the in-memory state, reports Waiting to save, blocks Continue/Finish and allows retry. Guided success never adds successful-review dates or changes an existing review schedule/mastery record.

Tap feedback/cursors stay device-local and are stripped from cloud v2 payloads. Ordinary sync retains the current device's private state. Only an explicit guest-import choice transfers guest drafts to an account. Portable backups include these fields; valid current-content feedback can replace obsolete signatures for active or inactive same-day role plans.

## Boundaries

This delivery changes native iOS practice, not the website's practice UI. Existing account security and public Release authentication gates remain unchanged. The source tests cover data behavior; physical-device, accessibility, permission/interruption and editorial acceptance remain separate from unit-test success.
