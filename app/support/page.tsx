import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support — Lucid",
  description: "Help with Lucid on web and iOS, including guest progress, installation, offline practice and portable backups.",
};

export default function SupportPage() {
  return (
    <main className="legal-shell">
      <div className="legal-wrap">
        <Link className="legal-brand" href="/"><span>L</span> Lucid</Link>
        <header className="legal-hero">
          <small>WEB &amp; iOS SUPPORT</small>
          <h1>How can we help?</h1>
          <p>Get help with courses, practice and review. Report a problem or suggest useful language for your role.</p>
          <div className="legal-actions">
            <a className="legal-action" href="https://github.com/sunilnjc/Lucid/issues/new" target="_blank" rel="noreferrer">Open a support request</a>
            <Link className="legal-action secondary" href="/privacy">Read the privacy policy</Link>
          </div>
        </header>

        <article className="legal-content">
          <section className="legal-callout">
            <h2>Before you send a request</h2>
            <p>Please include your device model, operating system, browser or Lucid version, whether you used the browser or installed app view, what you expected, and what happened. Never include confidential workplace, customer, patient, password, or financial information. Support requests opened on GitHub are public.</p>
          </section>

          <section>
            <h2>What is available in English and Korean?</h2>
            <p>The introduction pages are available in English and Korean. The learning app offers an English/Korean choice for navigation, onboarding, daily Words/Idiom and Review instructions. Korean meanings and short usage notes support every role-word sense and all daily idioms; original English terms and examples remain visible. Course narratives, Express scenarios, Library/Progress details, account help, detailed settings, feedback forms, privacy policy and this support page remain in English.</p>
          </section>

          <section>
            <h2>Why is daily learning limited to one to three words?</h2>
            <p>Lucid is designed for active use, not list collection. One to three words leave time to understand the context, practise a response, and retrieve it again over 1, 3, 7, 14, and 30 days. Ten-word discovery collections let you browse without marking every word learned or mastered.</p>
          </section>

          <section>
            <h2>Why does spoken practice on iOS need two permissions?</h2>
            <p>The microphone captures your sentence and Apple speech recognition converts it into text. Both permissions are optional on iOS. Web practice is text only and requests neither permission.</p>
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
            <p>For guest iOS learning, open Settings → Erase learning data. A signed-in iOS account has a separate deletion flow that requires fresh verification and confirmation. Signing out or clearing browser site data does not delete saved cloud progress. Export a private backup before removing local data you want to keep. For optional beta-feedback deletion, request help with the approximate submission date; do not repost private feedback in a public GitHub issue.</p>
          </section>

          <section>
            <h2>Can I use Lucid offline?</h2>
            <p>The iOS app bundles eight courses and 472 terms, local checks, progress and spaced review. Once web offline setup finishes during an online visit, its public app shell and courses can open offline. Guest progress stays saved in that browser. In builds with shared sign-in enabled, an already verified open account session can save edits during a connection loss; a cold offline start opens guest storage until the account can be verified online. Speech recognition availability can depend on installed language resources. Beta feedback and support pages need internet access.</p>
          </section>

          <section>
            <h2>How do I keep web and mobile progress together?</h2>
            <p>This public release uses guest learning and portable backups. Shared-account sign-in is not enabled, so automatic web and mobile progress synchronization is unavailable. Use Settings → Learning backup to export a private backup and explicitly import it on another device. Browser and installed-app storage may differ; keep your backup private because it can include personal writing.</p>
            <p>In builds with shared sign-in enabled, the same verified Lucid account can synchronize course progress, bookmarks, checkpoints, selected authored phrasing and practice history. Personal situations, original sentences and retries stay on their originating device. Guest or earlier web work joins an account only through an explicit merge.</p>
          </section>

          <section>
            <h2>How do I install Lucid as a web app?</h2>
            <p>Choose Install app inside Lucid. Supported browsers may open their own installation prompt. On iPhone or iPad, open Lucid in Safari, tap Share, then Add to Home Screen. Keep Open as Web App on if offered, then tap Add. On older iOS versions, use Safari. The browser completes installation; Lucid cannot add an iPhone icon with one tap.</p>
            <p>Open Lucid from the new Home Screen icon or app launcher for the standalone app view. Browser and installed-app storage may differ. In this guest release, keep a private learning backup before changing browsers or app views. When Update app appears, finish or save current work before choosing to refresh.</p>
          </section>

          <section>
            <h2>Why did a saved phrase arrive without my sentence?</h2>
            <p>When shared sign-in is enabled, ordinary sync shares the authored phrase you selected and text-free practice history. Your personal situation and original response stay private on their originating device. You can write a fresh response on this device or explicitly transfer a private learning backup.</p>
          </section>

          <section>
            <h2>Current beta scope</h2>
            <p>Lucid 1.0 supports Finance &amp; Accounting, Project &amp; Product, Technology &amp; Engineering, Sales &amp; Business Development, HR &amp; People Leadership, Consulting &amp; Strategy, Operations &amp; Supply Chain, and Healthcare.</p>
          </section>
        </article>
        <footer className="legal-footer">Lucid · Professional English on web and iOS.</footer>
      </div>
    </main>
  );
}
