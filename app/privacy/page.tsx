import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Lucid",
  description: "How Lucid handles learning progress, private practice text, backups and optional feedback.",
};

export default function PrivacyPage() {
  return (
    <main className="legal-shell">
      <div className="legal-wrap">
        <Link className="legal-brand" href="/"><span>L</span> Lucid</Link>
        <header className="legal-hero">
          <small>WEB &amp; iOS · UPDATED 14 OCTOBER 2026</small>
          <h1>Privacy policy</h1>
          <p>Lucid is designed so you can learn without creating an account. Private practice text stays on your device during ordinary progress synchronization. Portable backups may contain that text.</p>
        </header>

        <article className="legal-content">
          <section>
            <h2>Learning on your device</h2>
            <p>The iOS app stores your professional profile, learning history, favourites, review schedule, reminders and progress in local app storage. The web app keeps a local learning record in your browser. Guest iOS progress stays on the device. The web may save guest or earlier web progress to Lucid under a random device or platform identifier. Private situations and written practice responses are excluded from ordinary progress synchronization.</p>
            <p>Guest iOS learning can be erased under Settings → Erase learning data. Signed-in iOS learners use the separate, confirmed account-deletion flow to remove saved cloud progress. Clearing browser site data or removing an installed web app affects local storage; it does not delete an account&apos;s cloud record. Your own device backups may retain local data.</p>
          </section>

          <section>
            <h2>Optional shared learner account</h2>
            <p>When shared sign-in is enabled, web and iOS use the same verified Lucid account through our existing Supabase and email delivery services. Requesting a sign-in code sends your email address to those services. Web sign-in uses server-set HttpOnly session cookies; the iOS app stores its sign-in session in the device&apos;s Keychain.</p>
            <p>Account progress includes your professional profile, daily goal, course starting point, bookmarks, lesson and starting-check choices, saved checkpoints, review evidence, selected authored notebook phrasing, and practice history. It also records when guidance was shown so supported practice cannot be mistaken for unaided recall. Your personal situation text, original sentences, retries, freeform drafts and voice recordings are excluded from this progress sync.</p>
            <p>Guest or earlier web progress is imported only when you choose to merge it after signing in. Accounts are never joined just because their email labels match. Sign-out separates account and guest records; it does not delete saved progress.</p>
          </section>

          <section>
            <h2>Spoken practice on iOS</h2>
            <p>Microphone and speech-recognition access are optional and begin only after you tap the microphone button. The web app uses text only and does not request microphone access or play synthesized speech. On iOS, Lucid uses Apple&apos;s speech-recognition service to turn your spoken sentence into text. Lucid does not receive or retain your audio recording.</p>
            <p>Apple determines whether recognition happens on-device or through its speech services. Apple&apos;s handling of that processing is governed by Apple&apos;s privacy terms and your device settings.</p>
          </section>

          <section>
            <h2>Private writing and portable backups</h2>
            <p>Your personal “what I wanted to say” text, original responses and retries stay local during ordinary synchronization. Saved authored alternatives and text-free practice checkpoints or history can appear on your other signed-in device without that private writing. A portable learning backup can include private writing so that you can restore or transfer it. Keep backup files private and review them before sharing. Importing a backup merges earned history; replacing a profile requires your choice.</p>
            <p>Authored alternatives and phrase checks run locally. They are not semantic or AI grades, and no new external provider receives your text.</p>
          </section>

          <section>
            <h2>Optional beta feedback</h2>
            <p>If you choose to send beta feedback, Lucid receives your role identifier, rating, written responses, submission time, and a device or platform identifier used to associate feedback submissions from the same installation or platform account. Do not include confidential workplace, patient, customer, or personal information.</p>
            <p>This feedback is used only to improve lessons, usability, and role coverage. It is not sold, used for advertising, or used to track you across apps or websites. It is retained while it remains useful for beta evaluation and product improvement, then deleted or anonymised. You may request earlier deletion through the support page.</p>
          </section>

          <section>
            <h2>Notifications</h2>
            <p>If you enable a daily reminder, iOS schedules it locally at the time you choose. Web browser alerts work while Lucid is open. Lucid does not use push-notification tracking.</p>
          </section>

          <section>
            <h2>Advertising, analytics, and tracking</h2>
            <p>The iOS app contains no advertising SDK, third-party analytics SDK, or cross-app tracking. It does not request an advertising identifier. Shared-account progress uses Lucid&apos;s existing account service; guest and earlier web records use their separate storage identity. Neither client sends your practice text to an AI provider.</p>
          </section>

          <section>
            <h2>Installed web app and offline use</h2>
            <p>Installing Lucid adds an app view to your Home Screen or app launcher. The web app&apos;s offline cache holds only its public app shell, course assets and icons. It does not cache sign-in responses, account-specific pages or progress API responses. Learning records are stored separately in browser storage under their account or guest identity.</p>
            <p>Your browser and installed app may keep separate local storage. An already verified open account session can keep local edits during a connection loss. Starting the web app offline opens guest storage until the account can be verified online. Keep a portable backup of guest work before changing browsers or removing site data.</p>
          </section>

          <section>
            <h2>Children and sensitive information</h2>
            <p>Lucid is a professional-language learning product and is not directed to children under 13. The app is not intended for storing confidential employer information, patient information, financial records, or other sensitive personal data.</p>
          </section>

          <section>
            <h2>Your choices and requests</h2>
            <ul>
              <li>Use Lucid without an account.</li>
              <li>Decline microphone, speech-recognition, and notification permissions.</li>
              <li>Use written practice without sending it to Lucid.</li>
              <li>Erase guest iOS learning in Settings, or use the confirmed account-deletion flow for an enabled iOS account.</li>
              <li>Sign out or manage local browser site data without silently merging guest and account records.</li>
              <li>Ask a privacy question or request deletion of submitted beta feedback through support.</li>
            </ul>
            <div className="legal-actions">
              <Link className="legal-action" href="/support">Contact Lucid support</Link>
              <Link className="legal-action secondary" href="/">Return to Lucid</Link>
            </div>
          </section>

          <section>
            <h2>Changes to this policy</h2>
            <p>If the app begins collecting new categories of information or using data for a new purpose, this policy and the App Store privacy disclosure will be updated before that change is released.</p>
          </section>
        </article>
        <footer className="legal-footer">Lucid · Professional English for your role.</footer>
      </div>
    </main>
  );
}
