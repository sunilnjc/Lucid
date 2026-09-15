# Isolated native journey test

Requires Xcode, an installed iOS simulator runtime, and XcodeGen. This uses the exact native sources but a separate `com.sunilnjc.lucid.uiqa` bundle with auth/email disabled and no private configuration. Never run these tests against the user's installed main app or physical phone. No real accounts, email, microphone, or backend are used.

Create or choose a dedicated Lucid QA simulator, then set its UDID below. The uninstall resets **only the disposable QA app** to repeat first-time onboarding; it never touches `com.sunilnjc.lucid`.

Run from the repository root:

```sh
lucid_qa_simulator=YOUR_DEDICATED_SIMULATOR_UDID
lucid_qa_output=$(mktemp -d /tmp/lucid-ui-journey.XXXXXX)
xcodegen --spec tests/ios-ui/project.yml --project "$lucid_qa_output"
xcrun simctl uninstall "$lucid_qa_simulator" com.sunilnjc.lucid.uiqa
xcodebuild -project "$lucid_qa_output/LucidJourneyQA.xcodeproj" -scheme LucidJourneyQA -destination "platform=iOS Simulator,id=$lucid_qa_simulator" -derivedDataPath "$lucid_qa_output/DerivedData" -resultBundlePath "$lucid_qa_output/Journey.xcresult" test
```

On the first run, uninstall may report that the QA app is not installed; proceed with the test. All generated projects, build products, screenshots and test results stay in the temporary local output directory, not iCloud or the source checkout. Inspect the `.xcresult` before deleting disposable results.

Coverage: first-user setup, center-of-card answer taps, wrong feedback, pause and relaunch resume, all three challenge formats, once-daily 50 XP, optional writing, completed-card Back to Home, starting-check close/resume/application without extra credit. Screenshot attachments document the optional stretch and branded Welcome. Unit tests separately cover all roles, migrations, account isolation, midnight and real local write failures.

This does not replace VoiceOver, maximum Dynamic Type, physical-device permissions/storage or live-account acceptance.
