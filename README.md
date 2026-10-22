# Lucid Vocabulary Coach

## Live app and current work

**Live app:** [learnwithlucid.com](https://learnwithlucid.com) · **Verified public release:** version **8**, including [Korean idiom browsing](https://learnwithlucid.com/?lang=ko&view=idioms) and A–Z dictionary pagination.

Lucid helps professionals turn English they recognise into language they can use at work. Eight professional courses share 472 words, with a one-to-three-word course pace, spaced review, Library/bookmarks and Express rehearsal. Daily Words adds five role-based words and three optional extras; the daily idiom includes register guidance and plain-English alternatives. Guided recognition, unaided recall, self-assessed production and retained recall remain distinct.

English/Korean introductions and partial Korean learning support are published. English terms/examples remain visible alongside Korean support for 731 role-specific senses and 14 idioms. This is partial localization; some course narratives, questions and detailed settings remain English.

Version 8 exposes the 14 authored idioms through a dedicated destination and Today shortcut. Library/idiom lists apply search/filter → English A–Z sort → pages of at most 20, with Previous/Next and count controls. Daily curated assignments are preserved. All 29 hosted public assets match the tested build, 47 logical HTTP checks passed, and isolated Chrome desktop/mobile catalog checks passed **12/12**. See [PUBLICATION_2026_10_22.md](PUBLICATION_2026_10_22.md).

**The guest-first follow-up is locally verified and prepared for release; the public site is still version 8.** Public sign-in/email remain disabled. Guest and earlier Sites/D1 records remain separate from Supabase UUID accounts. GitHub follow-up: the source is tested locally; the verified implementation receipt is added below after push.

## Guest-first follow-up

The locally verified web source lets visitors browse words/idioms freely and try practice before personalizing a course or opening account options. New guest work stays in the current tab's temporary session, with an in-memory fallback when storage is unavailable. Durable saving of words, review schedules and progress requires a verified account.

The initial product assumption is **five distinct learning items per tab**, consistent with the five-word daily introduction. The policy/controller accepts a cap from 1–20; five is the fallback. Reference browsing and planning do not consume this allowance, and revisiting an admitted item remains possible. This is a product allowance, not an anonymous security or billing boundary.

Earlier durable local records remain byte-preserved and separate. Downloading their original backup and importing eligible guest/legacy learning into an account are explicit actions; signing in does not automatically join or upload records. The import uses the privacy-limited account projection and retains its source. Private original writing and daily sidecars are not promised full account portability.

Verified email signup is prepared behind explicit auth, email and signup flags. Initial OTP requests permit account creation only with all required server opt-ins; same-account reverification keeps `create_user:false`. No billing, subscription entitlement or public price promise is implemented.

## Backend and acceptance status

The user-approved **Lucid** Supabase project is `eaorljzxspmiexlmlfvb` in Launch, Singapore. Its guarded initial migration succeeded once; **16/16 hosted metadata/grant checks** passed and all 11 function hashes matched the reviewed definitions. Two approved test accounts were verified and their sessions logged out. No learning records were written by the provider tests.

The existing provider email template still sends a confirmation link to `localhost:3000`, without the numeric code the app expects. SMTP, canonical URL and code-template configuration remain a tool-capability blocker, not missing user authorization. Public sign-in is gated until configuration and canonical hosted acceptance are complete. See [SUPABASE_SETUP_2026_10_22.md](SUPABASE_SETUP_2026_10_22.md) for exact verified setup and remaining targets.

The final guest-first JavaScript/TypeScript source passed **414/414 Node checks**, zero failures/skips, with the existing isolated PostgreSQL runtime configured. Production build, TypeScript and repository ESLint passed. The final CSS-only mobile-button correction passed its asset rebuild and **56/56 focused checks**; these overlap the full suite. Actual local HTTP checks passed **64/64**, including all 29 public precache files and denied anonymous/cross-origin writes. Actual local Chrome verification passed **79/79 checks**. The prepared hosting candidate passed **260/260 curated checks** plus build/typecheck/lint. The latest unchanged native regression passed **264/264 groups across 16 suites**. Full evidence and release boundaries are in [SIGNIN_IDIOMS_PAGINATION_2026_10_22.md](SIGNIN_IDIOMS_PAGINATION_2026_10_22.md).

## Engineering and data boundaries

- Web: React/TypeScript with Vinext on Cloudflare. D1 retains earlier guest/Sites records; prepared new durable saves require verified Supabase ownership and exact-revision CAS.
- Native: SwiftUI with shared authored content. Web publication does not change native configuration or install anything on the owner's phone.
- Content: `lib/professional-content.ts`, `lib/expression-content.ts` and `lib/daily-idioms.ts` are shared sources. `npm run ios:content` regenerates native resources; preserve IDs and review history.
- Privacy: personal situations, original/retry sentences and freeform drafts stay local during ordinary account sync. Explicit private backups can contain them. Feedback uses authored examples and local pattern checks, not AI semantic grading. Web has no speech controls; native speech remains available.
- Identity: matching email labels never join different UUID accounts or restore old-project records. Domain/mail DNS, the canonical gateway and the owner's installed app remain preserved.

## Local development

- `npm run dev` starts the development server.
- `npm run build`, `npm run typecheck` and `npm run lint` verify web integration.
- `npm test` builds and runs the acceptance suite. Set the documented existing `PGLITE_MODULE_PATH` for PostgreSQL-dependent checks; inspect skips rather than treating them as full acceptance.
- `npm run ios:content` regenerates native content; `npm run ios:test` runs native regressions.
- `npm run db:generate` creates D1 migrations; it does not approve a live migration.

Follow `AGENTS.md` and `CLAUDE.md` for local storage, private configuration and release gates. Keep credentials, learner backups, databases and generated output out of commits. Historical release records remain in [PUBLICATION_2026_10_15.md](PUBLICATION_2026_10_15.md), `LAUNCH_QA.md` and `IMPLEMENTATION_QA.md`.
