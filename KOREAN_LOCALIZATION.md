# Korean learning support

This local implementation adds an English/Korean choice to web and native Lucid. English remains the default. Only `en` and `ko` are supported learning locales; the architecture can accept future locales without adding Japanese or Chinese translations now.

## Coverage

The shared catalogue contains **614 Korean UI strings**, **731 role-specific word senses across all 472 canonical word IDs and all 8 roles**, and support for **all 14 daily idioms**. A role sense has its own Korean meaning and short usage note, including shared words whose meanings change by profession.

Korean supports navigation, onboarding choices and instructions, Today, Today’s Words, Today’s Idiom, and Review instructions. Daily word and Review meanings/usage support appears after the learner reveals guidance. The shared `WordGuidance` component can also show Korean support in course previews. Idioms include Korean meanings, register, context, plain-English alternative explanations and applicable cautions.

**English terms, idioms and example sentences remain visible.** Korean is supplementary learning support; switching languages does not translate private writing or alter the answer being assessed.

This is partial interface localization. Course questions and narratives, Express scenarios, Library/Progress details, detailed settings, account controls, policies, support, and PWA installation messages remain in English. Local disclosures identify these boundaries. Catalogue coverage does not mean every screen is translated.

## Implementation and learner data

Five TypeScript sources are canonical:

- `lib/learning-locale-copy.ts`: exact English UI source strings mapped to Korean.
- `lib/korean-idioms.ts`: idiom support keyed by stable idiom ID.
- `lib/korean-words-business.ts`, `lib/korean-words-people.ts`, and `lib/korean-words-health.ts`: meanings and usage keyed by role ID and word ID.

`lib/learning-locales.ts` combines these sources for web. `npm run ios:content` exports the same content to `ios/Lucid/Lucid/Resources/learning-locales.json`; native helpers in `LearningLanguage.swift` consume that resource. Do not edit the generated JSON independently.

UI lookup falls back to the original English source when a key is missing or a translation has incompatible interpolation placeholders. Missing word support shows an explicit notice with the original English guidance. Keep named placeholders such as `{count}`, `{total}`, `{date}` and `{role}` intact.

The preference is device-only under `lucid.learning-language`: web uses browser storage and an optional `lang=en`/`lang=ko` query choice; native uses `AppStorage`. Language switching does not change learner schemas, IDs, account boundaries, plans, schedules, progress, or private drafts. Existing original-response capture, reveal guards, self-assessment and scoring rules remain in force. Viewing a translation creates no extra mastery or review success.

## Editorial maintenance

Translations are original editorial copy authored by parallel Codex agents and reviewed by other agents, including full review of role-specific meanings/usage, UI copy and all idioms. This is an independent agent review, not a claim of human or professional certification. Specialist primary-source references used for sense checks are recorded in the author files; dictionary definitions were not copied wholesale.

For content changes, compare the actual canonical `roleContexts` meaning and usage before using a base meaning. Preserve distinctions such as customer versus employee retention, service capacity versus clinical decision-making capacity, qualifying an opportunity versus limiting a statement, and recognition-only clinical terms. Add matching web/native keys, regenerate native resources, and recheck exact role-sense coverage and placeholder parity. A new locale requires explicit content and interface coverage rather than silently reusing another language.

## Validation and release status

Final verification passed 277 Node entries, all 264 native behavior groups across 16 suites, production web build, TypeScript and repository ESLint. Actual web and isolated simulator acceptance checked language switching, private draft/progress persistence and bilingual guidance. The final native guidance/large-text checkpoint passed. KOREAN_LOCALIZATION_QA.md records the precise partial-journey versus passing-checkpoint scope, screenshots, Library identities and remaining physical-device/VoiceOver/human-editorial limits.

This batch is local only. It makes no public deployment, phone installation, hosted Supabase migration, backend activation, or provider/credential change.
