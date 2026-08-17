# Lucid Vocabulary Coach

Lucid is a mobile-first advanced English learning app. It delivers ten words per lesson across emotional expression, intellectual conversation, and leadership, with usage exercises, spaced review, and every-fifth-day quizzes.

## Local development

- `npm run dev` starts the development server.
- `npm run lint` checks code quality and accessibility rules.
- `npm test` builds the app and runs the product/data acceptance suite.
- `npm run db:generate` creates D1 migrations from `db/schema.ts`.

Progress is stored in Cloudflare D1. Authenticated Sites visitors are isolated by their OpenAI user ID; local or anonymous visitors use a generated device ID. Recently opened content and unsynchronised progress are cached on-device for offline continuity.
