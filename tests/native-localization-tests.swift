import Foundation

enum ReminderScheduler { static func cancel() {} }
struct LocalizationTestFailure: Error, CustomStringConvertible { let description: String }
func localeRequire(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
    if try !condition() { throw LocalizationTestFailure(description: message) }
}

@main @MainActor struct NativeLocalizationTests {
    static func main() throws {
        guard CommandLine.arguments.count == 2 else { throw LocalizationTestFailure(description: "Pass the canonical professional-content resource") }
        let catalogURL = URL(fileURLWithPath: CommandLine.arguments[1])
        let catalog = try JSONDecoder().decode(ProfessionalCatalog.self, from: Data(contentsOf: catalogURL))
        let resourceURL = catalogURL.deletingLastPathComponent().appendingPathComponent("learning-locales.json")
        let localization = try LearningLocalization.load(url: resourceURL)
        let suiteName = "lucid-localization-tests-\(UUID())"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }
        var passed = 0
        func test(_ title: String, _ body: () throws -> Void) throws { try body(); passed += 1; print("PASS \(title)") }
        try test("language defaults to English and unsupported preferences use a safe English fallback") {
            try localeRequire(learningLanguage(defaults: defaults) == .en, "Fresh installation must preserve English default")
            defaults.set("ja", forKey: LearningLanguage.preferenceKey)
            try localeRequire(learningLanguage(defaults: defaults) == .en, "Future unsupported locale cannot silently claim localization")
            defaults.set("ko", forKey: LearningLanguage.preferenceKey)
            try localeRequire(learningLanguage(defaults: defaults) == .ko, "Explicit Korean preference must persist")
            defaults.set("en", forKey: LearningLanguage.preferenceKey)
            try localeRequire(learningLanguage(defaults: defaults) == .en, "Explicit English choice must remain available")
        }
        try test("shared resource loads supported English and Korean without altering source copy") {
            try localeRequire(localization.schemaVersion == 1 && localization.locales == ["en", "ko"], "Only approved locales may be delivered")
            try localeRequire(localization.text("Today’s Words", language: .en) == "Today’s Words", "English must retain source copy")
            try localeRequire(localization.text("Today’s Words", language: .ko) != "Today’s Words", "Daily navigation needs Korean copy")
            try localeRequire(localization.text("Untranslated fixture label", language: .ko) == "Untranslated fixture label", "Missing keys must preserve an honest English fallback")
        }
        try test("dynamic localized labels preserve named placeholders and never reinterpret learner writing") {
            for (key, value) in localization.koreanUI {
                try localeRequire(LearningLocalization.placeholders(key) == LearningLocalization.placeholders(value), "Placeholder mismatch: \(key)")
            }
            let result = localization.format("{count}/{total} explored", values: ["count": "3", "total": "8"], language: .ko)
            try localeRequire(result.contains("3") && result.contains("8") && !result.contains("{count}"), "Dynamic Korean counts must interpolate")
            let synthetic = "A private draft {count} stays literal"
            try localeRequire(localization.text(synthetic, language: .ko) == synthetic, "User writing must not be translated as a UI key")
            let invalid = LearningLocalization(schemaVersion: 1, locales: ["en", "ko"], koreanUI: ["{count} due": "누락된 자리표시자"], koreanWords: [:], koreanIdioms: [:])
            try localeRequire(invalid.text("{count} due", language: .ko) == "{count} due", "Malformed translated templates must use English")
        }
        try test("every canonical role and word has Korean meaning and usage support while IDs and examples stay English") {
            for role in catalog.roles {
                for word in catalog.words where word.roles.contains(role.id) {
                    let contextual = word.contextualized(for: role.id)
                    let support = localization.word(id: word.id, roleID: role.id, language: .ko)
                    try localeRequire(support?.meaning.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false, "Missing Korean meaning: \(role.id)/\(word.id)")
                    try localeRequire(support?.usage?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false, "Missing Korean usage: \(role.id)/\(word.id)")
                    try localeRequire(!contextual.term.isEmpty && !contextual.example.isEmpty, "English term and example remain canonical")
                    try localeRequire(localization.word(id: word.id, roleID: role.id, language: .en) == nil, "English mode must not insert Korean support")
                }
            }
            try localeRequire(localization.word(id: "missing", roleID: "missing", language: .ko) == nil, "Unknown content must not manufacture a translation")
        }
        try test("every daily idiom has Korean sense, register and usage support with canonical English source retained") {
            let idioms = try JSONDecoder().decode(DailyIdiomCatalog.self, from: Data(contentsOf: catalogURL.deletingLastPathComponent().appendingPathComponent("daily-idioms.json")))
            for idiom in idioms.idioms {
                let support = localization.idiom(id: idiom.id, language: .ko)
                try localeRequire(support != nil && !support!.meaning.isEmpty && !support!.context.isEmpty && !support!.register.isEmpty && !support!.plainEnglish.isEmpty, "Incomplete idiom support: \(idiom.id)")
                try localeRequire(!idiom.phrase.isEmpty && !idiom.example.isEmpty, "English source cannot be replaced")
                try localeRequire(localization.idiom(id: idiom.id, language: .en) == nil, "Korean guidance is optional")
            }
        }
        try test("switching language cannot reset learner progress, private drafts, daily cards or account boundaries") {
            var guest = LearnerData(); guest.displayName = "Synthetic guest"; guest.dailyWordGoal = 2
            guest.profile = LearnerProfile(roleId: catalog.roles[0].id, seniorityId: catalog.seniorityLevels[0].id, situationIds: [catalog.roles[0].situations[0].id], goalIds: [catalog.roles[0].defaultGoalIds[0]])
            guest.practiceDrafts = ["synthetic-recall": "The review draft stays exactly as typed."]
            let day = "2026-10-15", roleID = catalog.roles[0].id
            let pinnedIDs = DailyVocabularyEngine.wordIds(catalog: catalog, roleId: roleID, day: day, excluding: [])
            guest.dailyVocabulary = DailyVocabularyLocal(collections: [DailyVocabularyEngine.collectionKey(day: day, roleId: roleID): DailyVocabularyCollection(day: day, roleId: roleID, wordIds: pinnedIDs, extraUnlocked: true, revealedWordIds: [pinnedIDs[0]], drafts: [pinnedIDs[0]: "A private daily recall stays untouched."])])
            var account = guest; account.displayName = "Synthetic account"; account.dailyWordGoal = 1
            let guestBefore = guest; let accountBefore = account
            let directory = FileManager.default.temporaryDirectory.appendingPathComponent("lucid-locale-progress-\(UUID())")
            defer { try? FileManager.default.removeItem(at: directory) }
            let persistence = LearningPersistence(directory: directory)
            let accountScope = UUID().uuidString
            try persistence.save(guest, scope: "guest"); try persistence.save(account, scope: accountScope)
            let guestFile = try Data(contentsOf: persistence.file(for: "guest"))
            let accountFile = try Data(contentsOf: persistence.file(for: accountScope))
            let guestBytes = try JSONEncoder().encode(guest)
            let accountBytes = try JSONEncoder().encode(account)
            for code in ["ko", "en", "ko"] {
                defaults.set(code, forKey: LearningLanguage.preferenceKey)
                _ = localization.text("Review", language: learningLanguage(defaults: defaults))
                try localeRequire(guest == guestBefore && account == accountBefore, "Language is a presentation preference, never a learner mutation")
                try localeRequire(try persistence.load(scope: "guest").data == guestBefore && persistence.load(scope: accountScope).data == accountBefore, "Saved guest and account records must stay separate")
                try localeRequire(try Data(contentsOf: persistence.file(for: "guest")) == guestFile && Data(contentsOf: persistence.file(for: accountScope)) == accountFile, "Language switches cannot rewrite persisted learner bytes")
            }
            try localeRequire(try JSONDecoder().decode(LearnerData.self, from: guestBytes) == guestBefore, "Guest Codable remains unchanged")
            try localeRequire(try JSONDecoder().decode(LearnerData.self, from: accountBytes) == accountBefore, "Account Codable remains separate")
            try localeRequire(guest.practiceDrafts?["synthetic-recall"] == "The review draft stays exactly as typed." && guest.dailyWordGoal == 2 && account.dailyWordGoal == 1, "Private writing and each course pace must survive")
        }
        try test("unknown resource versions fail safely rather than accepting partial future content") {
            let directory = FileManager.default.temporaryDirectory.appendingPathComponent("lucid-locale-schema-\(UUID())")
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            defer { try? FileManager.default.removeItem(at: directory) }
            let url = directory.appendingPathComponent("future.json")
            try Data("{\"schemaVersion\":2,\"locales\":[\"en\",\"ko\"],\"koreanUI\":{},\"koreanWords\":{},\"koreanIdioms\":{}}".utf8).write(to: url)
            do { _ = try LearningLocalization.load(url: url); throw LocalizationTestFailure(description: "Future version should fail") }
            catch LearningLocalization.LocalizationError.unsupportedSchema { }
        }
        print("Native localization: \(passed) groups passed")
    }
}
