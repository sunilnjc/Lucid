import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Lucid iOS",
  description: "How the Lucid iOS app handles learning data, spoken practice, notifications, and optional beta feedback.",
};

export default function PrivacyPage() {
  return (
    <main className="legal-shell">
      <div className="legal-wrap">
        <Link className="legal-brand" href="/"><span>L</span> Lucid</Link>
        <header className="legal-hero">
          <small>iOS APP · EFFECTIVE 18 AUGUST 2026</small>
          <h1>Privacy policy</h1>
          <p>Lucid is designed so you can learn without creating an account. Your professional profile and learning progress stay on your device.</p>
        </header>

        <article className="legal-content">
          <section>
            <h2>What stays on your iPhone or iPad</h2>
            <p>The iOS app stores your selected role, seniority, workplace situations, communication goals, lesson history, favourites, review schedule, streak, reminder preferences, and progress in Apple&apos;s local app storage. This information is not uploaded to Lucid.</p>
            <p>You can erase it at any time in Lucid under Settings → Erase learning data. Removing the app also removes its local data, subject to the normal behaviour of your own device backups.</p>
          </section>

          <section>
            <h2>Spoken practice</h2>
            <p>Microphone and speech-recognition access are optional and begin only after you tap the microphone button. Lucid uses Apple&apos;s speech-recognition service to turn your spoken sentence into text. Lucid does not receive or retain your audio recording.</p>
            <p>Apple determines whether recognition happens on-device or through its speech services. Apple&apos;s handling of that processing is governed by Apple&apos;s privacy terms and your device settings.</p>
          </section>

          <section>
            <h2>Optional beta feedback</h2>
            <p>If you choose to send beta feedback, Lucid receives your role identifier, rating, written responses, submission time, and a random installation identifier used to prevent anonymous abuse and group feedback from the same installation. Do not include confidential workplace, patient, customer, or personal information.</p>
            <p>This feedback is used only to improve lessons, usability, and role coverage. It is not sold, used for advertising, or used to track you across apps or websites. It is retained while it remains useful for beta evaluation and product improvement, then deleted or anonymised. You may request earlier deletion through the support page.</p>
          </section>

          <section>
            <h2>Notifications</h2>
            <p>If you enable a daily reminder, iOS schedules it locally at the time you choose. Lucid does not use push-notification tracking or upload your reminder time.</p>
          </section>

          <section>
            <h2>Advertising, analytics, and tracking</h2>
            <p>The iOS app contains no advertising SDK, third-party analytics SDK, or cross-app tracking. It does not request an advertising identifier. The app connects to Lucid&apos;s service only when you deliberately send beta feedback or open a public Lucid support or privacy page.</p>
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
              <li>Erase all learning data from the app&apos;s Settings screen.</li>
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
