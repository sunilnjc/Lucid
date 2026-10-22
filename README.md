# Lucid Vocabulary Coach

## Live app and engineering overview

**Live app:** [learnwithlucid.com](https://learnwithlucid.com) · **Current verified public release:** version 7, guest learning and portable backups.

Lucid helps professionals turn English they recognise into language they can use at work. Eight professional courses share 472 words, with a one-to-three-word course pace, spaced review, Library/bookmarks and Express rehearsal. Daily Words adds five role-based words and three optional extras; the daily idiom includes register guidance and plain-English alternatives. Guided recognition, unaided recall, self-assessed production and retained recall remain distinct.

English/Korean introductions and partial Korean learning support are published. Korean navigation, onboarding and daily guidance accompany preserved English terms/examples and Korean support for 731 role-specific senses and 14 idioms. Course narratives/questions, Express scenarios, detailed Library/Progress, account/settings, PWA installation and legal/support areas remain English where disclosed. English is the default; this is not complete Korean localization.

The current live release has shared sign-in/email disabled, so automatic native/web account sync is inactive. Guest and earlier Sites/D1 web records remain separate from native Supabase UUID accounts. Explicit private backups are the current transfer path and can include personal writing. Browser and installed-app storage can differ. No Supabase setting, mail/DNS configuration or owner-phone installation has been changed by the current local work.

## October 22 work and release status

This source includes searchable idiom discovery and Library/idiom A–Z pagination: filter/search first, then sort, then show up to 20 entries per page. They also improve existing-account sign-in/reverification, stale-response handling and durable saves across account changes. OTP requests use `create_user:false`; public signup and a new account-deletion product feature are outside this scope.

The isolated release passed its production build, TypeScript, repository ESLint and **337/337 Node checks with zero failures/skips**. Local Wrangler HTTP checks passed **57/57**, including Korean/deep-link routes, expected account gates and all 29 public precache files. Native regression passed **264/264 groups across 16 suites**. Implementation commit `6cae19c9bbca457602fceaeec1bde3fefc83f576` was pushed to the existing GitHub `main` branch and its remote SHA verified; this is separate from website delivery. The current public Site remains version 7. Live sign-in activation is blocked by the unresolved documented Supabase hostname and unverified project/schema access. Publishing requires restored existing Site source-write authorization or a narrowly approved exception for the official short-lived repository credential; no such credential has been created. See [SIGNIN_IDIOMS_PAGINATION_2026_10_22.md](SIGNIN_IDIOMS_PAGINATION_2026_10_22.md) for exact scope, results and pending approvals. Do not infer that these local changes are deployed from their presence in this checkout.

The version-6 daily/Korean publication and version-7 PWA language-query follow-up remain recorded in [PUBLICATION_2026_10_15.md](PUBLICATION_2026_10_15.md). Earlier launch and local acceptance evidence is retained in `LAUNCH_QA.md` and `IMPLEMENTATION_QA.md`. Hosted online PWA cache readiness passed earlier; actual hosted network-offline/cold launch and physical installation remain unverified.

## Engineering and data boundaries

- Web: React/TypeScript with Vinext on Cloudflare; D1 stores existing guest/Sites learning records. Identity scopes, durable local storage and revision-aware merging protect progress.
- Native: SwiftUI with shared authored course/expression/idiom/localization resources. Canonical native work is separate from the owner's installed app; publishing web does not install native updates.
- Content: `lib/professional-content.ts`, `lib/expression-content.ts` and `lib/daily-idioms.ts` are shared sources. `npm run ios:content` regenerates native resources; preserve IDs and review history.
- Privacy: personal situations, original/retry sentences and freeform drafts stay local during ordinary sync. Explicit backups can include them. Feedback uses authored examples and local pattern checks, not AI semantic grading. Web has no speech controls; native speech remains available.
- Shared-account source: optional `sharedLearning` v1 inside native-compatible v2 records uses verified Supabase UUIDs and exact-revision CAS when enabled. Local tests use disposable PostgreSQL/PGlite and synthetic Auth/PostgREST, not a hosted-provider acceptance result. Daily idiom schedules and private originals remain device-local or in explicit private backups; not every saved field is included in ordinary sync. See `supabase/proposals/README.md` and the October 22 record before activation.

## Local development

- `npm run dev` starts the development server.
- `npm run build`, `npm run typecheck` and `npm run lint` verify web integration.
- `npm test` builds and runs the product/data acceptance suite. Engine-dependent PostgreSQL checks need an already available temporary PGlite runtime, as documented in `supabase/proposals/README.md`.
- `npm run ios:content` regenerates native content resources; `npm run ios:test` runs native behavior regressions.
- `npm run db:generate` creates D1 migrations from `db/schema.ts`; it does not approve a live migration.

Follow `AGENTS.md` and `CLAUDE.md` for the canonical local checkout, private configuration, data preservation and release gates. Keep credentials, learner backups, databases and generated output out of commits. Preserve existing records; never join accounts just because email labels match.
