# App Store submission checklist

The codebase is ready for signed device testing and TestFlight. Apple account ownership, signing, legal agreements, screenshots, and the final App Store Connect submission must be completed by the Apple Developer account holder.

## 1. Apple Developer setup

- Join or confirm an active Apple Developer Program membership.
- In Certificates, Identifiers & Profiles, register the explicit App ID `com.sunilnjc.lucid` or a replacement you control.
- In App Store Connect, create a new iOS app with the same bundle ID and a unique SKU.
- Accept current agreements and complete banking/tax information only if future paid features require it. Lucid 1.0 has no purchases.

## 2. Signing in Xcode

1. Open `ios/Lucid/Lucid.xcodeproj`.
2. Select the Lucid target → Signing & Capabilities.
3. Choose your Apple Developer Team.
4. Confirm the bundle identifier matches App Store Connect.
5. Run on at least one physical iPhone. Test permission denial as well as permission acceptance.

## 3. Release QA

- Complete onboarding for at least two roles.
- Confirm exactly three active words are selected and relevant to each role.
- Test Dynamic Type, VoiceOver labels, dark appearance, airplane mode, and an iPhone SE-sized screen.
- Test pronunciation, microphone denial, speech-recognition denial, local notifications, beta feedback, and data erasure.
- Advance device dates in a test build or use controlled test data to verify 1/3/7/14/30-day scheduling.
- Confirm privacy and support URLs are publicly reachable.
- Confirm the app icon and every screenshot match the shipping UI.
- Run a Release build and Xcode's Product → Analyze.

## 4. Screenshots and product page

- Capture clean screenshots from a simulator using the latest sizes offered by App Store Connect.
- Recommended sequence: role onboarding; three-word lesson hero; complete word card; spoken practice; review intervals; progress.
- Do not add claims such as “AI grammar correction” or “guaranteed fluency”; the shipping feedback is a transparent local pattern check.
- Use the copy in `METADATA.md`, then proofread it in App Store Connect.

## 5. Archive and upload

1. Increment `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` for every upload.
2. Choose Any iOS Device (arm64).
3. Product → Archive.
4. In Organizer, run Validate App.
5. Distribute App → App Store Connect → Upload.
6. Wait for build processing, then attach the processed build to the version.

## 6. App Store Connect declarations

- Complete the App Privacy questionnaire using `METADATA.md` as a conservative draft, verified against the exact shipping build.
- Set encryption to exempt/non-exempt encryption “No”; the app relies only on Apple's standard HTTPS implementation.
- Complete the age-rating questionnaire truthfully.
- Set the Support URL and Privacy Policy URL to the public Lucid pages.
- Add the App Review notes from `METADATA.md`.

## 7. Start with TestFlight

- Add internal testers first and collect crash/permission/usability feedback.
- For external testing, create a small 10–20 professional cohort across two or three roles and submit the beta build for TestFlight review.
- Ask what they used at work, not merely which words they liked.
- Fix release-blocking issues, upload a new build number, and keep the first public content set focused.

## 8. Submit the public version

- Select manual release for the first version so launch timing remains controlled.
- Submit for review.
- Respond to App Review in Resolution Center with specific reproduction steps if asked.
- After approval, release gradually or manually, monitor reviews, and respond without requesting personal or confidential information.
