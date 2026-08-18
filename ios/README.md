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

- Profile, learning progress, favourites, streak, reminder preferences, and spaced-review state are stored with `UserDefaults` on the device.
- Written practice is checked locally and is not persisted.
- Spoken practice uses `SFSpeechRecognizer` only after the learner taps the microphone.
- Pronunciation uses `AVSpeechSynthesizer`.
- Daily reminders use local `UNUserNotificationCenter` scheduling.
- Optional beta feedback is posted to the public Lucid feedback endpoint.
- StoreKit's native `requestReview` environment action is used only after meaningful lesson milestones.

See [AppStore/APP_STORE_SUBMISSION.md](AppStore/APP_STORE_SUBMISSION.md) for the release checklist.
