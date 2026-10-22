import type { Metadata } from "next";
import LandingPage from "../landing/LandingPage";
import { getLandingCopy, landingLanguageAlternates, PUBLIC_LUCID_ORIGIN } from "../../lib/landing-locales";
const copy = getLandingCopy("en");
export const metadata: Metadata = { title: copy.title, description: copy.description, alternates: { canonical: `${PUBLIC_LUCID_ORIGIN}/en`, languages: landingLanguageAlternates }, openGraph: { title: copy.title, description: copy.description, url: `${PUBLIC_LUCID_ORIGIN}/en`, locale: "en_US", alternateLocale: ["ko_KR"] } };
export default function EnglishLandingPage() { return <LandingPage locale="en" />; }
