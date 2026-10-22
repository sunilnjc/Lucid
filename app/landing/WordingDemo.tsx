"use client";
import { useState } from "react";
import { getLandingCopy, type LandingLocale } from "../../lib/landing-locales";
import { getPracticeExpression } from "../../lib/expression-content";

type Tone = "plain" | "precise" | "diplomatic";
const example = getPracticeExpression("explain-the-reason");
export default function WordingDemo({ locale }: { locale: LandingLocale }) {
  const copy = getLandingCopy(locale), [tone, setTone] = useState<Tone>("plain");
  if (!example) return null;
  return <div className="landing-wording-demo">
    <div className="landing-demo-top"><span className="landing-demo-dot" aria-hidden="true" /><span>Lucid · Express</span><span className="landing-demo-counter" aria-hidden="true">0{(["plain", "precise", "diplomatic"] as const).indexOf(tone) + 1} / 03</span></div>
    <p className="landing-demo-situation"><small>{copy.demoSituationLabel}</small>{copy.demoSituation}</p>
    <div className="landing-tone-options" role="group" aria-label={copy.demoHeading}>{(["plain", "precise", "diplomatic"] as const).map((item) => <button type="button" key={item} aria-pressed={tone === item} onClick={() => setTone(item)}>{copy.demoLabels[item]}</button>)}</div>
    <div className="landing-demo-result" aria-live="polite" aria-atomic="true"><blockquote lang="en">{example[tone]}</blockquote><p>{copy.demoNotes[tone]}</p></div>
    <small className="landing-demo-footnote">{copy.demoFootnote}</small>
  </div>;
}
