import type { Metadata } from "next";
import LandingPage from "../landing/LandingPage";
import { getLandingCopy, landingLanguageAlternates, PUBLIC_LUCID_ORIGIN } from "../../lib/landing-locales";
const copy = getLandingCopy("ko");
export const metadata: Metadata = { title: copy.title, description: copy.description, alternates: { canonical: `${PUBLIC_LUCID_ORIGIN}/ko`, languages: landingLanguageAlternates }, openGraph: { title: copy.title, description: copy.description, url: `${PUBLIC_LUCID_ORIGIN}/ko`, locale: "ko_KR", alternateLocale: ["en_US"] } };
export default function KoreanLandingPage() { return <LandingPage locale="ko" />; }
