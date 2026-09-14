# Lucid for iOS

Lucid is a native SwiftUI app for iPhone and iPad. It is not a web wrapper. The app bundles the professional vocabulary catalogue, stores learning progress on-device, and uses native Apple frameworks for speech, pronunciation, notifications, and App Store review requests.

## Open and run

1. Open `Lucid/Lucid.xcodeproj` in Xcode 26 or later.
2. Select the `Lucid` scheme and an iPhone or iPad simulator.
3. Press Run.

The default bundle identifier is `com.sunilnjc.lucid` and the deployment target is iOS 17. Before archiving, choose the Apple Developer Team that owns the App Store Connect record. If that bundle identifier is unavailable in the team, change it in the Lucid target's Signing & Capabilities tab and use the same identifier in App Store Connect.

## Update the bundled vocabulary

The iOS catalogue is generated from the web app's canonical TypeScript catalogue:

```sh
npm run ios:content
```

Commit the regenerated `professional-content.json` whenever `lib/professional-content.ts` changes.

## Local build check

```sh
xcodebuild \
  -project ios/Lucid/Lucid.xcodeproj \
  -scheme Lucid \
  -configuration Debug \
  -sdk iphonesimulator \
  -derivedDataPath .build/ios \
  CODE_SIGNING_ALLOWED=NO \
  build
```

## Data flow

- Profile, activity, favourites, streak, reminder preferences, drafts, and spaced-review state are stored in a versioned file in Application Support, with atomic writes, iOS Data Protection, and a last-known-good backup. Existing UserDefaults data migrates on first open.
- Written practice is checked locally and saved on the device. Drafts are excluded from the prepared cloud payload.
- Settings → Export a learning backup saves a portable JSON copy, including drafts. Keep exported files private. Restore merges records rather than replacing newer work.
- No cloud service or paid plan is configured in this local development build. Email account code is prepared but disabled until public Supabase configuration is supplied. See [AppStore/AUTH_SETUP.md](AppStore/AUTH_SETUP.md).
- Spoken practice uses `SFSpeechRecognizer` only after the learner taps the microphone.
- Pronunciation uses `AVSpeechSynthesizer`.
- Daily reminders use local `UNUserNotificationCenter` scheduling.
- Optional beta feedback is posted to the public Lucid feedback endpoint.
- StoreKit's native `requestReview` environment action is used only after meaningful lesson milestones.

See [AppStore/APP_STORE_SUBMISSION.md](AppStore/APP_STORE_SUBMISSION.md) for the release checklist.

## Local behavioral tests

Run npm run ios:test on this Mac to exercise the actual Swift learning, persistence and merge code. Tests use isolated temporary folders, with no network calls or notification requests.

See [AppStore/LAUNCH_READINESS.md](AppStore/LAUNCH_READINESS.md) for the user-experience audit, implemented changes and remaining October launch work.
