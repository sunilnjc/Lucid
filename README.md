# Lucid Vocabulary Coach

## Live app and engineering overview

**Live app:** https://lucid-vocabulary-sunil.sunilkumar-kalabandi.chatgpt.site · **Stage:** deployed learning application.

Lucid turns vocabulary practice into short lessons, usage exercises, spaced review and periodic quizzes. The React/TypeScript application persists progress in Cloudflare D1 and caches recently used content and unsynchronised progress on-device for offline continuity. Visitor identity determines progress isolation; see the implementation notes below.


Lucid is a mobile-first advanced English learning app. It delivers ten words per lesson across emotional expression, intellectual conversation, and leadership, with usage exercises, spaced review, and every-fifth-day quizzes.

## Local development

- `npm run dev` starts the development server.
- `npm run lint` checks code quality and accessibility rules.
- `npm test` builds the app and runs the product/data acceptance suite.
- `npm run db:generate` creates D1 migrations from `db/schema.ts`.

Progress is stored in Cloudflare D1. Authenticated Sites visitors are isolated by their OpenAI user ID; local or anonymous visitors use a generated device ID. Recently opened content and unsynchronised progress are cached on-device for offline continuity.
