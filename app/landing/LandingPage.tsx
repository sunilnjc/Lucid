import { availableLandingLocales, getLandingCopy, type LandingLocale } from "../../lib/landing-locales";
import WordingDemo from "./WordingDemo";
import "./landing.css";

export default function LandingPage({ locale }: { locale: LandingLocale }) {
  const copy = getLandingCopy(locale);
  const appEntry = locale === "ko" ? "/start?lang=ko" : "/start?lang=en";
  return <div className="lucid-landing" lang={locale}>
    <a className="landing-skip" href="#landing-content">{copy.skip}</a>
    <header className="landing-header"><a className="landing-brand" href={`/${locale}`} aria-label="Lucid"><span className="landing-brand-mark" aria-hidden="true" /><strong>Lucid</strong></a>
      <nav className="landing-nav" aria-label={locale === "ko" ? "주요 메뉴" : "Main navigation"}><a href="#demo">{copy.navDemo}</a><a href="#how">{copy.navHow}</a><a className="landing-nav-app" href={appEntry}>{copy.navStart}<span aria-hidden="true"> ↗</span></a></nav>
      <nav className="landing-language" aria-label={copy.languageLabel}>{availableLandingLocales.map((entry) => <a key={entry.locale} href={`/${entry.locale}`} hrefLang={entry.locale} lang={entry.locale} aria-current={entry.locale === locale ? "page" : undefined}>{entry.label}</a>)}</nav>
    </header>
    <main id="landing-content">
      <section className="landing-hero"><div className="landing-hero-copy"><span className="landing-eyebrow">{copy.eyebrow}</span><h1>{copy.heading}<br /><em>{copy.headingAccent}</em></h1><p className="landing-introduction">{copy.introduction}</p><a className="landing-cta" href={appEntry}>{copy.cta}<span aria-hidden="true"> →</span></a><p className="landing-cta-note">{copy.ctaNote}</p><p className="landing-coverage">{copy.coverage}</p></div>
        <div className="landing-hero-art" aria-hidden="true"><div className="landing-art-orbit"><span className="landing-art-mark" /><span className="landing-art-word landing-art-word-one">clarity</span><span className="landing-art-word landing-art-word-two">rationale</span><span className="landing-art-word landing-art-word-three">perspective</span><span className="landing-art-caption">a thought → the right words</span></div></div>
      </section>
      <div className="landing-facts"><div><strong>{copy.dailyValue}</strong><span>{copy.dailyLabel}</span></div><div><strong>{copy.rolesValue}</strong><span>{copy.rolesLabel}</span></div><div><strong>{copy.practiceValue}</strong><span>{copy.practiceLabel}</span></div></div>
      <section className="landing-demo-section" id="demo" aria-labelledby="demo-heading"><div><span className="landing-eyebrow">{copy.demoEyebrow}</span><h2 id="demo-heading">{copy.demoHeading}</h2><p>{copy.demoIntro}</p></div><WordingDemo locale={locale} /></section>
      <section className="landing-how" id="how" aria-labelledby="how-heading"><span className="landing-eyebrow">{copy.howEyebrow}</span><h2 id="how-heading">{copy.howHeading}</h2><div className="landing-steps">{copy.steps.map((step, index) => <article key={step.title}><span className="landing-step-number">0{index + 1}</span><h3>{step.title}</h3><p>{step.body}</p></article>)}</div></section>
      <section className="landing-roles" aria-labelledby="roles-heading"><div><span className="landing-eyebrow">{copy.rolesEyebrow}</span><h2 id="roles-heading">{copy.rolesHeading}</h2><p>{copy.rolesIntro}</p></div><ul>{copy.roles.map((role) => <li key={role}><span aria-hidden="true">↗</span>{role}</li>)}</ul></section>
      <section className="landing-care" aria-labelledby="care-heading"><span className="landing-care-symbol" aria-hidden="true">✳</span><div><span className="landing-eyebrow">{copy.careEyebrow}</span><h2 id="care-heading">{copy.careHeading}</h2><p>{copy.careBody}</p><p className="landing-care-note">{copy.careNote}</p></div></section>
      <section className="landing-faq" aria-labelledby="faq-heading"><h2 id="faq-heading">{copy.faqHeading}</h2><div>{copy.faq.map((item) => <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div></section>
      <section className="landing-final"><h2>{copy.finalHeading}</h2><p>{copy.finalBody}</p><a className="landing-cta" href={appEntry}>{copy.cta}<span aria-hidden="true"> →</span></a></section>
    </main>
    <footer className="landing-footer"><a className="landing-brand" href={`/${locale}`}><span className="landing-brand-mark" aria-hidden="true" /><strong>Lucid</strong></a><p>{copy.footerTagline}</p><nav aria-label={locale === "ko" ? "도움말" : "Help"}><a href="/privacy">{copy.privacy}</a><a href="/support">{copy.support}</a><a href={appEntry}>{copy.openApp}</a></nav></footer>
  </div>;
}
