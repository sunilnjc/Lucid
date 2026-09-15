# Local development

The working project is `/Users/Sunil/Developer/Lucid`, outside iCloud Drive. The former Documents checkout must not be used for ongoing development.

Open `ios/Lucid/Lucid.xcodeproj` from this directory in Xcode. Open this same local folder in your coding assistant; do not use a stale Documents project entry. `CLAUDE.md` contains the current implementation, test and release handoff.

Recreate dependencies locally with `npm ci` using the same Node runtime you use to build. The system Node on this Mac runs as x64; mixing it with an arm64 app-bundled runtime can install incompatible native dependencies.

Build the web project with `npm run build`, then run `npm run typecheck`. Type checking regenerates the ignored Worker runtime declarations from the build's local configuration, with no deployment or cloud database changes. Generate the native vocabulary bundle with `npm run ios:content`, and run native regression checks with `npm run ios:test`.

Use ignored `.build/` output or local Xcode DerivedData. Do not place dependencies or build caches in cloud-synchronised folders. iCloud is not required to build or run Lucid.

This workspace change does not change Supabase authentication, email delivery, the public website, or learning data stored by the installed iPhone app. Private local configuration and the local development database are preserved separately from Git-tracked source.
