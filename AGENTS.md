# Lucid workspace rules

- Work from `/Users/Sunil/Developer/Lucid` on this Mac. The user explicitly requested local-only project storage.
- Do not recreate or edit the former project at `/Users/Sunil/Documents/ChatGPT/Glossary`, and do not place source, dependencies, build output, or working backups in iCloud Drive, Documents, or Desktop.
- Keep generated build output in the ignored local `.build/` directory, Xcode's local DerivedData directory, or a task-specific temporary directory.
- Keep private configuration ignored. Never include credentials, `Config.local.xcconfig`, local databases, or Xcode user state in commits or public artifacts.
- The shared course source is `lib/professional-content.ts`; regenerate the native resource with `npm run ios:content` after catalogue changes.
- Preserve existing learner IDs, history, role-specific plans, and review schedules. A chosen course starting point does not imply mastery.
- Follow the user's priority order: professional courses first, tap-first daily practice second, logo and app icon third.
