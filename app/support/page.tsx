import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support — Lucid",
  description: "Help with Lucid for iPhone and iPad, including lessons, speech practice, reminders, and learning data.",
};

export default function SupportPage() {
  return (
    <main className="legal-shell">
      <div className="legal-wrap">
        <Link className="legal-brand" href="/"><span>L</span> Lucid</Link>
        <header className="legal-hero">
          <small>iPHONE &amp; iPAD SUPPORT</small>
          <h1>How can we help?</h1>
          <p>Lucid is beginning its iOS beta. Report a problem, suggest vocabulary for your role, or use the quick answers below.</p>
          <div className="legal-actions">
            <a className="legal-action" href="https://github.com/sunilnjc/Lucid/issues/new" target="_blank" rel="noreferrer">Open a support request</a>
            <Link className="legal-action secondary" href="/privacy">Read the privacy policy</Link>
          </div>
        </header>

        <article className="legal-content">
          <section className="legal-callout">
            <h2>Before you send a request</h2>
            <p>Please include your iPhone or iPad model, iOS version, Lucid version, what you expected, and what happened. Never include confidential workplace, customer, patient, password, or financial information. Support requests opened on GitHub are public.</p>
          </section>

          <section>
            <h2>Why do I receive only three new words?</h2>
            <p>Lucid is designed for active use, not list collection. Three words leave enough time to hear each word, understand its workplace context, write or speak a real sentence, and retrieve it again over 1, 3, 7, 14, and 30 days.</p>
          </section>

          <section>
            <h2>Why does spoken practice need two permissions?</h2>
            <p>The microphone captures your sentence and Apple speech recognition converts it into text. Both permissions are optional. Written practice, pronunciation playback, lessons, and review continue to work without them.</p>
          </section>

          <section>
            <h2>How do I change my role or goals?</h2>
            <p>Open Settings, then choose “Change role, situations, or goals.” Lucid keeps your existing review history while personalising future lessons to the new choices.</p>
          </section>

          <section>
            <h2>Why did no review prompt appear?</h2>
            <p>iOS decides whether the App Store rating prompt is shown. Lucid asks only after a meaningful learning milestone; it never interrupts your first launch or withholds a feature based on your rating.</p>
          </section>

          <section>
            <h2>How do I erase my data?</h2>
            <p>Open Settings → Erase learning data. This removes your profile, lessons, favourites, streak, and review history from the device. For optional beta-feedback deletion, open a support request with the approximate submission date and the text you submitted.</p>
          </section>

          <section>
            <h2>Can I use Lucid offline?</h2>
            <p>Lessons, the 64-word catalogue, local usage checks, pronunciation playback, progress, and spaced review are bundled with the app. Speech recognition availability can depend on the language resources installed on your device. Sending beta feedback and opening support pages require internet access.</p>
          </section>

          <section>
            <h2>Current beta scope</h2>
            <p>Lucid 1.0 supports Finance &amp; Accounting, Project &amp; Product, Technology &amp; Engineering, Sales &amp; Business Development, HR &amp; People Leadership, Consulting &amp; Strategy, Operations &amp; Supply Chain, and Healthcare.</p>
          </section>
        </article>
        <footer className="legal-footer">Lucid iOS beta · Support documentation updated 18 August 2026.</footer>
      </div>
    </main>
  );
}
