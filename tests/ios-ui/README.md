# Isolated native journey test

Requires Xcode, an installed iOS simulator runtime, and XcodeGen. This uses the exact native sources but a separate `com.sunilnjc.lucid.uiqa` bundle with auth/email disabled and no private configuration. Never run these tests against the user's installed main app or physical phone. No real accounts, email, microphone, or backend are used.

Create or choose a dedicated Lucid QA simulator, then set its UDID below. The uninstall resets **only the disposable QA app** to repeat first-time onboarding; it never touches `com.sunilnjc.lucid`.

Run from the repository root:

```sh
lucid_qa_simulator=YOUR_DEDICATED_SIMULATOR_UDID
lucid_qa_output=$(mktemp -d /tmp/lucid-ui-journey.XXXXXX)
xcodegen --spec tests/ios-ui/project.yml --project "$lucid_qa_output"
cp tests/ios-ui/Info.plist "$lucid_qa_output/Info.plist"
xcrun simctl uninstall "$lucid_qa_simulator" com.sunilnjc.lucid.uiqa
xcodebuild -project "$lucid_qa_output/LucidJourneyQA.xcodeproj" -scheme LucidJourneyQA -destination "platform=iOS Simulator,id=$lucid_qa_simulator" -derivedDataPath "$lucid_qa_output/DerivedData" -resultBundlePath "$lucid_qa_output/Journey.xcresult" test
```

On the first run, uninstall may report that the QA app is not installed; proceed with the test. All generated projects, build products, screenshots and test results stay in the temporary local output directory, not iCloud or the source checkout. Inspect the `.xcresult` before deleting disposable results.

Coverage: first-user setup, center-of-card answer taps, wrong feedback, pause and relaunch resume, all three challenge formats, once-daily 50 XP, optional writing, completed-card Back to Home, starting-check close/resume/application without extra credit. Screenshot attachments document the optional stretch and branded Welcome. Unit tests separately cover all roles, migrations, account isolation, midnight and real local write failures.

This does not replace VoiceOver, maximum Dynamic Type, physical-device permissions/storage or live-account acceptance.


The separate `LucidSharedJourneyQA` scheme enables an explicitly guarded DEBUG
simulator override for this QA bundle only. Start `scripts/shared-backend-harness.mjs`
with its disposable PostgreSQL fixture on `127.0.0.1:4777`, reserve synthetic Bob
for the native journey, and run with
`-scheme LucidSharedJourneyQA -only-testing:LucidJourneyTests/LucidSharedAccountJourneyTests`.
The provider accepts only `lucid-alice@example.invalid` and
`lucid-bob@example.invalid`, code `123456`, and the synthetic publishable key.
No email is sent. Account credentials live in memory only; the shipping bundle,
Release, phones, private configuration and Keychain are excluded. The QA-only
plist permits local networking so the isolated HTTP fixture is reachable.

The shared journey signs in through actual app fields, restores authored notebook
and response-free history, writes a bookmark and supported lesson completion,
checks the actual database row for privacy and safe checkpoint fields, observes
an externally written note through foreground polling, and switches through guest
to a second account. These are local protocol/database integration checks, not
hosted Supabase delivery, physical-device or public Release acceptance.

## Daily words and idioms UI acceptance

`LucidDailyDiscoveryJourneyTests` is opt-in so the original fresh-app journey stays independent. Regenerate the QA project after adding the daily schemes. Create a new simulator whose name starts with `Lucid Daily Discovery QA`, using an installed iOS runtime; do not reuse an owner simulator. Keep its UUID in `lucid_qa_simulator` and generated output under `.build/qa/` or `/tmp`.

1. Run the `LucidDailyJourneyQA` scheme with `-only-testing:LucidJourneyTests/LucidDailyDiscoveryJourneyTests/testDailyDiscoveryAndReturn`. It expects a fresh **QA bundle only**, then checks first-screen discoverability and minimum targets (0.01-point rounding tolerance), five stable words plus optional three, original private recall, explicit review enrollment, idiom guidance, Back/Review and persistence after relaunch. It does not claim retained mastery or physical-device acceptance.
2. To exercise a delayed idiom without altering the clock, boot only that simulator, then run `python3 tests/ios-ui/seed-daily-due-fixture.py --simulator "$lucid_qa_simulator" --output .build/qa/YOUR_RUN`. The helper requires the exact nameless synthetic guest response from step 1 and the separate QA bundle. It changes only that synthetic idiom's due date and clears that synthetic daily recall checkpoint. Run `LucidDailyDueJourneyQA` with `-only-testing:LucidJourneyTests/LucidDailyDiscoveryJourneyTests/testDueIdiomReviewEntry`.
3. Run `LucidDailyJourneyQA` with `-only-testing:LucidJourneyTests/LucidDailyDiscoveryJourneyTests/testLargeTextDailyNavigation` for maximum Dynamic Type layout/navigation in this QA process only.

Use `test-without-building` after the app and test sources are frozen and built once. Retain screenshot attachments/results, then shut down and delete only the newly created disposable simulator. These synthetic due-date and font checks do not replace real calendar rollover, VoiceOver or physical iPhone acceptance.
