import Foundation

enum ReminderScheduler { static func cancel() {} }
struct DailyTestFailure: Error, CustomStringConvertible { let description: String }
func dailyRequire(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
    if try !condition() { throw DailyTestFailure(description: message) }
}
@MainActor final class DailyTestClock { var date: Date; init(_ date: Date) { self.date = date } }

@main @MainActor struct NativeDailyVocabularyTests {
    static var directories: [URL] = []
    static func makeStore(_ catalog: ProfessionalCatalog, _ idioms: DailyIdiomCatalog, _ now: Date,
                          _ initial: LearnerData) throws -> (LearningStore, DailyTestClock, LearningPersistence) {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("lucid-daily-fixture-\(UUID())", isDirectory: true)
        directories.append(directory)
        let persistence = LearningPersistence(directory: directory)
        try persistence.save(initial, scope: "guest")
        let clock = DailyTestClock(now)
        return (LearningStore(catalog: catalog, idiomCatalog: idioms, persistence: persistence, now: { clock.date }, accountService: nil), clock, persistence)
    }
    static func main() throws {
        guard CommandLine.arguments.count == 2 || (CommandLine.arguments.count == 3 && CommandLine.arguments[2] == "--parity") else { throw DailyTestFailure(description: "Pass the canonical professional-content.json resource, optionally --parity with JSON requests on stdin") }
        let catalogURL = URL(fileURLWithPath: CommandLine.arguments[1])
        let catalog = try JSONDecoder().decode(ProfessionalCatalog.self, from: Data(contentsOf: catalogURL))
        let idioms = try JSONDecoder().decode(DailyIdiomCatalog.self, from: Data(contentsOf: catalogURL.deletingLastPathComponent().appendingPathComponent("daily-idioms.json")))
        if CommandLine.arguments.count == 3 {
            struct Request: Codable { let day: String; let roleId: String; var excluded: [String]? }
            struct Response: Codable { let wordIds: [String]; let idiomId: String? }
            let requests = try JSONDecoder().decode([Request].self, from: FileHandle.standardInput.readDataToEndOfFile())
            let result = requests.map { request in Response(wordIds: DailyVocabularyEngine.wordIds(catalog: catalog, roleId: request.roleId, day: request.day, excluding: request.excluded ?? []), idiomId: DailyVocabularyEngine.idiomId(day: request.day, catalog: idioms)) }
            print(String(decoding: try JSONEncoder().encode(result), as: UTF8.self)); return
        }
        let today = ContextEvidence.localCalendarDay("2026-10-15")!
        let role = catalog.roles.first { $0.id == "finance-accounting" }!
        let otherRole = catalog.roles.first { $0.id == "technology-engineering" }!
        func profile(_ role: ProfessionalRole) -> LearnerProfile {
            .init(roleId: role.id, seniorityId: catalog.seniorityLevels[0].id, situationIds: [role.situations[0].id], goalIds: [role.defaultGoalIds[0]])
        }
        func record(_ role: ProfessionalRole = role, goal: Int = 2) -> LearnerData {
            var value = LearnerData(); value.profile = profile(role); value.dailyWordGoal = goal; return value
        }
        defer { for directory in directories { try? FileManager.default.removeItem(at: directory) } }
        var tests: [(String, () throws -> Void)] = []

        tests.append(("daily discovery adds an optional v1 sidecar without changing legacy v2 goals or progress", {
            let old = record(); let bytes = try JSONEncoder().encode(old)
            let decoded = try JSONDecoder().decode(LearnerData.self, from: bytes)
            try dailyRequire(decoded.dailyVocabulary == nil && decoded.dailyWordGoal == 2, "Legacy data must decode without daily metadata")
            let (store, _, _) = try makeStore(catalog, idioms, today, decoded)
            store.prepareToday(); let course = store.data.currentWordIds; let before = store.data
            store.prepareDailyVocabulary()
            try dailyRequire(store.data.schemaVersion == 2 && store.data.dailyVocabulary?.version == 1 && store.dailyGoal == 2, "Daily sidecar must not convert the course goal or schema")
            try dailyRequire(store.data.currentWordIds == course && store.data.contextEvidence == before.contextEvidence && store.data.progressByWordId == before.progressByWordId, "Selection may not introduce or complete a word")
            try dailyRequire(store.dailyVocabularyWords.count == 5 && store.dailyVocabularyCollection?.wordIds.count == 8, "Daily discovery must show five and pin eight")
        }))
        tests.append(("all eight roles choose unique useful role-context words and exclude current course IDs", {
            for role in catalog.roles {
                let (store, _, _) = try makeStore(catalog, idioms, today, record(role))
                store.prepareDailyVocabulary()
                let collection = store.dailyVocabularyCollection!
                try dailyRequire(collection.wordIds.count == 8 && Set(collection.wordIds).count == 8, "A real role must have eight distinct IDs")
                let selected = collection.wordIds.map { id in catalog.words.first { $0.id == id }!.contextualized(for: role.id) }
                try dailyRequire(Set(selected.map { $0.term.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }).count == 8, "Terms cannot repeat within a daily set")
                try dailyRequire(Set(collection.wordIds).isDisjoint(with: Set(store.data.currentWordIds)), "Daily words must not repeat today's course words")
                let advanced = catalog.words.filter { $0.learningMode == "active" && $0.roles.contains(role.id) && $0.contextualized(for: role.id).difficulty == "c1" && !store.data.currentWordIds.contains($0.id) }
                if Set(advanced.map { $0.term.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }).count >= 8 {
                    try dailyRequire(selected.allSatisfy { $0.difficulty == "c1" }, "The editorial advanced pool should have priority")
                }
            }
        }))
        tests.append(("deterministic rotation uses strict day ordinal and FNV role salt", {
            try dailyRequire(DailyVocabularyEngine.dayOrdinal("1970-01-01") == 0 && DailyVocabularyEngine.dayOrdinal("1969-12-31") == -1, "Day ordinal must be UTC-based even before epoch")
            try dailyRequire(DailyVocabularyEngine.dayOrdinal("2026-02-30") == nil && DailyVocabularyEngine.dayOrdinal("2026-2-03") == nil, "Invalid calendar keys must not select content")
            try dailyRequire(DailyVocabularyEngine.adding(days: 1, to: "2026-12-31") == "2027-01-01", "Rollover must preserve exact calendar days")
            try dailyRequire(DailyVocabularyEngine.dayOrdinal("0000-01-01") == -719_528 && DailyVocabularyEngine.dayOrdinal("0099-01-01") == -683_368, "Low ISO years must use proleptic Gregorian arithmetic rather than platform calendar cutovers")
            try dailyRequire(DailyVocabularyEngine.adding(days: 1, to: "2000-02-28") == "2000-02-29" && DailyVocabularyEngine.adding(days: 1, to: "1900-02-28") == "1900-03-01", "Gregorian leap-year rules must match web")
            let first = DailyVocabularyEngine.wordIds(catalog: catalog, roleId: role.id, day: "2026-10-15", excluding: [])
            let same = DailyVocabularyEngine.wordIds(catalog: catalog, roleId: role.id, day: "2026-10-15", excluding: [])
            let next = DailyVocabularyEngine.wordIds(catalog: catalog, roleId: role.id, day: "2026-10-16", excluding: [])
            try dailyRequire(first == same && first != next && first.count == 8, "Rotation must be stable within day and change at a date boundary")
            let negative = DailyVocabularyEngine.wordIds(catalog: catalog, roleId: role.id, day: "1969-12-31", excluding: [])
            try dailyRequire(negative.count == 8 && Set(negative).count == 8, "Negative offsets must remain safe")
        }))
        tests.append(("fallback selects other vetted role words and deduplicates lowercased trimmed terms", {
            var words = catalog.words.filter { $0.learningMode == "active" && $0.roles.contains(role.id) }.prefix(12).map { source -> ProfessionalWord in
                var word = source; word.difficulty = "upper-b2"; word.roleContexts = nil; return word
            }
            var duplicate = words[0]; duplicate = ProfessionalWord(id: "zz-duplicate", term: "  " + words[0].term.uppercased() + "  ", partOfSpeech: duplicate.partOfSpeech, pronunciation: duplicate.pronunciation, meaning: duplicate.meaning, difficulty: duplicate.difficulty, usefulness: duplicate.usefulness, learningMode: duplicate.learningMode, roles: duplicate.roles, situations: duplicate.situations, seniority: duplicate.seniority, goals: duplicate.goals, collocations: duplicate.collocations, example: duplicate.example, whenToUse: duplicate.whenToUse, avoidOrMisuse: duplicate.avoidOrMisuse, mission: duplicate.mission)
            words.append(duplicate)
            let small = ProfessionalCatalog(schemaVersion: 1, roles: catalog.roles, seniorityLevels: catalog.seniorityLevels, goals: catalog.goals, words: words)
            let result = DailyVocabularyEngine.wordIds(catalog: small, roleId: role.id, day: "2026-10-15", excluding: [])
            try dailyRequire(result.count == 8 && !result.contains("zz-duplicate"), "Fallback must remain useful and deduplicate aliases")
        }))
        tests.append(("optional three unlock once and survive reload without reshuffling", {
            let (store, clock, persistence) = try makeStore(catalog, idioms, today, record())
            store.prepareDailyVocabulary(); let ids = store.dailyVocabularyCollection!.wordIds
            try dailyRequire(store.unlockDailyVocabularyExtra(token: store.dailyVocabularyToken), "Optional three should unlock")
            try dailyRequire(store.dailyVocabularyWords.map(\.id) == ids, "Unlock must expose the preselected three")
            let before = store.data
            try dailyRequire(store.unlockDailyVocabularyExtra(token: store.dailyVocabularyToken) && store.data == before, "Second unlock must not mutate or add another set")
            let reloaded = LearningStore(catalog: catalog, idiomCatalog: idioms, persistence: persistence, now: { clock.date }, accountService: nil)
            reloaded.prepareDailyVocabulary()
            try dailyRequire(reloaded.dailyVocabularyWords.map(\.id) == ids && reloaded.dailyVocabularyCollection?.extraUnlocked == true, "Relaunch must retain eight and their order")
        }))
        tests.append(("same-day pins survive course preference changes and role round trips", {
            let (store, _, _) = try makeStore(catalog, idioms, today, record())
            store.prepareDailyVocabulary(); let original = store.dailyVocabularyCollection!
            store.data.dailyWordGoal = 3; store.prepareDailyVocabulary()
            try dailyRequire(store.dailyVocabularyCollection == original, "A changed course pace cannot reshuffle discovery")
            store.data.profile = profile(otherRole); store.prepareDailyVocabulary()
            try dailyRequire(store.dailyVocabularyCollection?.roleId == otherRole.id, "Each role needs its own collection")
            store.data.profile = profile(role); store.prepareDailyVocabulary()
            try dailyRequire(store.dailyVocabularyCollection == original, "Returning to a role must retain the same day's pins")
        }))
        tests.append(("date role and account generations reject stale daily actions", {
            let (store, clock, _) = try makeStore(catalog, idioms, today, record())
            store.prepareDailyVocabulary(); let token = store.dailyVocabularyToken; let wordId = store.dailyVocabularyWords[0].id
            clock.date = today.lucidAdding(days: 1)
            try dailyRequire(!store.revealDailyVocabularyWord(wordId: wordId, token: token), "The clock boundary must reject old content before a screen refresh")
            store.prepareDailyVocabulary(); let nextToken = store.dailyVocabularyToken
            try dailyRequire(store.dailyVocabularyCollection?.day == clock.date.lucidDayKey && !store.unlockDailyVocabularyExtra(token: token), "New date must pin a new five and reject old tokens")
            let idiomToken = store.dailyIdiomToken; let idiomId = store.dailyIdiom!.id
            store.data.profile = profile(otherRole); store.prepareDailyVocabulary()
            try dailyRequire(!store.revealDailyIdiom(id: idiomId, token: idiomToken), "Role changes must reject stale idiom screens without changing the global idiom")
            try dailyRequire(!store.unlockDailyVocabularyExtra(token: nextToken), "Role changes must reject old tokens")
            let roleToken = store.dailyVocabularyToken; store.accountGeneration = UUID()
            try dailyRequire(!store.unlockDailyVocabularyExtra(token: roleToken), "Verified account generation changes must reject old tokens")
        }))
        tests.append(("guest and two account files retain separate daily private drafts", {
            let (store, _, persistence) = try makeStore(catalog, idioms, today, record())
            store.prepareDailyVocabulary(); let id = store.dailyVocabularyWords[0].id
            try dailyRequire(store.saveDailyVocabularyDraft(wordId: id, text: "Synthetic guest recall", token: store.dailyVocabularyToken), "Guest draft should save")
            let guest = store.data; let alice = UUID().uuidString.lowercased(); let bob = UUID().uuidString.lowercased()
            try persistence.save(record(otherRole), scope: alice); try persistence.save(record(), scope: bob)
            let a = try persistence.load(scope: alice).data; let b = try persistence.load(scope: bob).data
            try dailyRequire(a.dailyVocabulary == nil && b.dailyVocabulary == nil, "Other identities must not receive a guest daily sidecar")
            try dailyRequire(try persistence.load(scope: "guest").data.dailyVocabulary == guest.dailyVocabulary, "Account storage cannot overwrite guest work")
        }))
        tests.append(("exploring words records exposure only and explicit review scheduling awards no success", {
            let (store, _, _) = try makeStore(catalog, idioms, today, record())
            store.prepareDailyVocabulary(); let id = store.dailyVocabularyWords[0].id; let token = store.dailyVocabularyToken
            let xp = store.totalXP; let activities = store.activities; let evidence = store.data.contextEvidence
            try dailyRequire(store.revealDailyVocabularyWord(wordId: id, token: token), "Word guidance should open")
            try dailyRequire(store.contextWasExposed(wordId: id) && !store.dailyVocabularyWordIsInReview(id), "Opening guidance must only record exposure")
            try dailyRequire(store.totalXP == xp && store.activities == activities && store.data.contextEvidence == evidence && store.data.progressByWordId[id] == nil, "Exposure cannot grant learning success")
            try dailyRequire(store.addDailyVocabularyWordToReview(wordId: id, token: token), "Explicit add should schedule review")
            let schedule = store.reviewSchedule(for: id)!
            try dailyRequire(store.dailyVocabularyWordIsInReview(id) && schedule.nextReviewOn.lucidDayKey == today.lucidAdding(days: 1).lucidDayKey && schedule.reviewCount == 0 && !schedule.mastered && schedule.successfulReviewDates.isEmpty, "Added review needs tomorrow's zero-evidence schedule")
            try dailyRequire(store.totalXP == xp && store.activities == activities && store.data.contextEvidence == evidence && store.data.completedWordIdsToday.isEmpty, "Review opt-in cannot inflate course completion, XP or mastery")
            let before = store.data
            try dailyRequire(store.addDailyVocabularyWordToReview(wordId: id, token: token) && store.data == before, "Repeated review opt-in must preserve existing schedule")
        }))
        tests.append(("daily word draft freezes at reveal without claiming an assessment", {
            let (store, _, _) = try makeStore(catalog, idioms, today, record())
            store.prepareDailyVocabulary(); let id = store.dailyVocabularyWords[0].id; let token = store.dailyVocabularyToken
            try dailyRequire(store.saveDailyVocabularyDraft(wordId: id, text: "An original synthetic recall", token: token), "Private original should save")
            try dailyRequire(store.revealDailyVocabularyWord(wordId: id, token: token), "Reveal should save")
            try dailyRequire(!store.saveDailyVocabularyDraft(wordId: id, text: "Edited after guidance", token: token), "Later edits cannot replace original recall")
            try dailyRequire(store.dailyVocabularyDraft(wordId: id) == "An original synthetic recall", "The original must stay stable")
        }))
        tests.append(("one idiom rotates globally by day, persists and does not displace daily words", {
            let (store, clock, persistence) = try makeStore(catalog, idioms, today, record())
            store.prepareDailyVocabulary(); let id = store.dailyIdiom!.id; let words = store.dailyVocabularyWords.map(\.id)
            let ordinal = DailyVocabularyEngine.dayOrdinal(today.lucidDayKey)!
            try dailyRequire(id == idioms.idioms[DailyVocabularyEngine.positiveModulo(ordinal, idioms.idioms.count)].id, "Daily idiom must use canonical ordered rotation")
            store.data.profile = profile(otherRole); store.prepareDailyVocabulary()
            try dailyRequire(store.dailyIdiom?.id == id && store.dailyVocabularyWords.count == 5, "Role switching cannot add another idiom or remove a word")
            let restored = LearningStore(catalog: catalog, idiomCatalog: idioms, persistence: persistence, now: { clock.date }, accountService: nil)
            restored.prepareDailyVocabulary(); try dailyRequire(restored.dailyIdiom?.id == id, "Same-day idiom must survive reload")
            clock.date = today.lucidAdding(days: 1); restored.prepareDailyVocabulary()
            try dailyRequire(restored.dailyIdiom?.id != id && words.count == 5, "The next local learning day must rotate one idiom")
        }))
        tests.append(("idiom exposure and same-day repetitions cannot advance spacing or award word credit", {
            let (store, _, _) = try makeStore(catalog, idioms, today, record())
            store.prepareDailyVocabulary(); let id = store.dailyIdiom!.id; let token = store.dailyIdiomToken; let xp = store.totalXP
            try dailyRequire(store.revealDailyIdiom(id: id, token: token) && store.addDailyIdiomToReview(id: id, token: token), "Opt-in should schedule idiom recall")
            let scheduled = store.dailyIdiomReview(id)!
            try dailyRequire(!store.completeDailyIdiomReview(id: id, remembered: true, token: token), "Introduction-day repetition cannot advance review")
            try dailyRequire(store.dailyIdiomReview(id) == scheduled && store.totalXP == xp && store.activities.isEmpty && store.data.contextEvidence == nil && store.dailyVocabularyWords.count == 5, "Idiom exposure must not mutate word success")
        }))
        tests.append(("delayed idiom self-check uses the first original and the existing interval ladder", {
            let (store, clock, _) = try makeStore(catalog, idioms, today, record())
            store.prepareDailyVocabulary(); let id = store.dailyIdiom!.id
            _ = store.revealDailyIdiom(id: id, token: store.dailyIdiomToken); _ = store.addDailyIdiomToReview(id: id, token: store.dailyIdiomToken)
            clock.date = today.lucidAdding(days: 1); store.prepareDailyVocabulary(); let token = store.dailyIdiomToken
            try dailyRequire(store.dueDailyIdioms.contains { $0.id == id }, "Delayed idiom must become due")
            try dailyRequire(store.saveDailyIdiomDraft(id: id, text: "An original fictional recall before guidance", token: token), "Original delayed recall should save")
            try dailyRequire(store.revealDailyIdiom(id: id, token: token), "Comparison may follow the frozen original")
            try dailyRequire(!store.saveDailyIdiomDraft(id: id, text: "Retry after guidance", token: token), "Original idiom response must stay frozen")
            try dailyRequire(store.completeDailyIdiomReview(id: id, remembered: true, token: token), "A delayed first-response self-check should save")
            let review = store.dailyIdiomReview(id)!
            try dailyRequire(review.intervalIndex == 1 && review.reviewCount == 1 && review.nextReviewOn == clock.date.lucidAdding(days: 3).lucidDayKey, "Successful self-assessment should use existing 1/3/7/14/30 ladder")
            try dailyRequire(!store.completeDailyIdiomReview(id: id, remembered: true, token: token), "A second same-day self-check must not repeat credit")
            try dailyRequire(store.data.contextEvidence == nil && store.totalXP == 0 && store.data.progressByWordId.isEmpty, "Idiom self-assessment remains separate from word evidence")
        }))
        tests.append(("revealed empty original remains supported and cannot be converted by a retry", {
            let (store, clock, _) = try makeStore(catalog, idioms, today, record())
            store.prepareDailyVocabulary(); let id = store.dailyIdiom!.id
            _ = store.revealDailyIdiom(id: id, token: store.dailyIdiomToken); _ = store.addDailyIdiomToReview(id: id, token: store.dailyIdiomToken)
            clock.date = today.lucidAdding(days: 1); store.prepareDailyVocabulary(); let token = store.dailyIdiomToken
            _ = store.revealDailyIdiom(id: id, token: token)
            try dailyRequire(!store.saveDailyIdiomDraft(id: id, text: "After seeing the answer", token: token), "Supported retry cannot change first response")
            try dailyRequire(store.completeDailyIdiomReview(id: id, remembered: true, token: token), "Supported comparison can still be saved honestly")
            try dailyRequire(store.dailyIdiomReview(id)?.intervalIndex == 0 && store.dailyIdiomReview(id)?.nextReviewOn == clock.date.lucidAdding(days: 1).lucidDayKey, "Supported response must return tomorrow rather than lengthen spacing")
        }))
        tests.append(("ordinary cloud records strip the sidecar and cloud merges preserve only this device's copy", {
            let (store, _, _) = try makeStore(catalog, idioms, today, record()); store.prepareDailyVocabulary()
            let local = store.data
            var remote = record(); remote.dailyVocabulary = DailyVocabularyEngine.prepared(nil, catalog: catalog, idioms: idioms, roleId: role.id, day: "2026-10-14", excluding: [])
            let cloud = LearningMerge.cloudRecord(local)
            let encoded = String(decoding: try JSONEncoder().encode(cloud), as: UTF8.self)
            try dailyRequire(cloud.schemaVersion == 2 && cloud.dailyVocabulary == nil && !encoded.contains("dailyVocabulary"), "No private daily fields may enter the deployed v2 cloud contract")
            try dailyRequire(LearningMerge.combine(local: local, remote: remote).dailyVocabulary == local.dailyVocabulary, "Cloud merge must retain the live local sidecar")
            try dailyRequire(LearningMerge.combine(local: record(), remote: local).dailyVocabulary == nil, "An untrusted remote sidecar must not enter a clean local identity")
        }))
        tests.append(("private backup round trip preserves sidecar and explicit restore merges without reshuffling", {
            let (store, _, _) = try makeStore(catalog, idioms, today, record()); store.prepareDailyVocabulary()
            let id = store.dailyVocabularyWords[0].id; _ = store.saveDailyVocabularyDraft(wordId: id, text: "Synthetic private backup draft", token: store.dailyVocabularyToken)
            let document = try LucidBackupDocument(data: store.data)
            let envelope = try JSONDecoder().decode(LearningPersistence.Envelope.self, from: document.content)
            try dailyRequire(envelope.learner.dailyVocabulary == store.data.dailyVocabulary, "Explicit private backup must retain daily sidecar")
            try dailyRequire(DailyVocabularyEngine.isValid(envelope.learner.dailyVocabulary!, catalog: catalog, idioms: idioms), "Canonical sidecar must pass backup validation")
            let merged = LearningMerge.restoringBackup(local: record(), incoming: envelope.learner, restoreProfile: false)
            try dailyRequire(merged.dailyVocabulary == store.data.dailyVocabulary, "Explicit restore must import private sidecar")
            var own = store.data; own.dailyVocabulary?.collections["2026-10-15:\(role.id)"]?.drafts[id] = "This device's original"
            let preserved = LearningMerge.restoringBackup(local: own, incoming: envelope.learner, restoreProfile: false)
            try dailyRequire(preserved.dailyVocabulary?.collections["2026-10-15:\(role.id)"]?.drafts[id] == "This device's original", "Backup cannot overwrite current private original")
            let invalidURL = FileManager.default.temporaryDirectory.appendingPathComponent("lucid-daily-invalid-\(UUID()).json")
            defer { try? FileManager.default.removeItem(at: invalidURL) }
            var invalid = envelope.learner; invalid.dailyVocabulary?.version = 99
            try JSONEncoder().encode(LearningPersistence.Envelope(version: 2, learner: invalid)).write(to: invalidURL)
            let before = store.data
            do { try store.importBackup(from: invalidURL); throw DailyTestFailure(description: "Unknown daily version must be rejected") }
            catch is DailyTestFailure { throw DailyTestFailure(description: "Unknown daily version was accepted") }
            catch { try dailyRequire(store.data == before, "Rejected sidecar must preserve current data") }
        }))
        tests.append(("backup merging preserves known supported idiom originals conservatively", {
            var own = DailyVocabularyLocal(); var saved = DailyVocabularyLocal()
            let key = "2026-10-15:\(idioms.idioms[0].id)"
            own.idiomPractice[key] = DailyIdiomPractice(draft: "A later response", originalResponse: "A later response", revealed: true)
            saved.idiomPractice[key] = DailyIdiomPractice(draft: "", originalResponse: "", revealed: true)
            let merged = DailyVocabularyEngine.restoringBackup(local: own, incoming: saved)!
            let reverse = DailyVocabularyEngine.restoringBackup(local: saved, incoming: own)!
            try dailyRequire(merged.idiomPractice[key]?.originalResponse == "" && reverse.idiomPractice[key]?.originalResponse == "", "Known guidance-first exposure must not become independent after explicit backup merging")
        }))
        tests.append(("oversized valid private daily backups fail honestly without pruning local data", {
            var large = record(); var local = DailyVocabularyLocal()
            for offset in 0..<150 {
                let day = DailyVocabularyEngine.adding(days: -offset, to: today.lucidDayKey)!
                let ids = DailyVocabularyEngine.wordIds(catalog: catalog, roleId: role.id, day: day, excluding: [])
                var collection = DailyVocabularyCollection(day: day, roleId: role.id, wordIds: ids)
                collection.extraUnlocked = true
                collection.drafts = Dictionary(uniqueKeysWithValues: ids.map { ($0, String(repeating: "x", count: 2_000)) })
                local.collections[DailyVocabularyEngine.collectionKey(day: day, roleId: role.id)] = collection
            }
            large.dailyVocabulary = local
            try dailyRequire(DailyVocabularyEngine.isValid(local, catalog: catalog, idioms: idioms), "The oversized fixture must be otherwise valid, not a malformed backup")
            let before = large
            do { _ = try LucidBackupDocument(data: large); throw DailyTestFailure(description: "Unrestorable oversized backup must not be exported") }
            catch let error as LucidBackupDocument.BackupError {
                guard case .tooLarge = error else { throw DailyTestFailure(description: "Export must report the actual current size limit") }
                try dailyRequire(error.localizedDescription.contains("2 MB"), "The limit must be understandable")
            }
            try dailyRequire(large == before && large.dailyVocabulary?.collections.count == 150, "Size guard must not prune or rewrite private learning")
        }))
        tests.append(("future daily primary files block downgrade before unknown fields can be lost", {
            let (store, clock, persistence) = try makeStore(catalog, idioms, today, record())
            store.prepareDailyVocabulary()
            var envelope = try JSONSerialization.jsonObject(with: JSONEncoder().encode(LearningPersistence.Envelope(version: 2, learner: store.data))) as! [String: Any]
            var learner = envelope["learner"] as! [String: Any]
            learner["dailyVocabulary"] = ["version": 2, "futureState": ["preserve": "unknown fields remain byte-for-byte"]]
            envelope["learner"] = learner
            let future = try JSONSerialization.data(withJSONObject: envelope, options: [.sortedKeys])
            try future.write(to: persistence.file(for: "guest"))
            do { _ = try persistence.load(scope: "guest"); throw DailyTestFailure(description: "Future daily primary must not fall back to an older backup") }
            catch LearningPersistence.PersistenceError.newerVersion {}
            let blocked = LearningStore(catalog: catalog, idiomCatalog: idioms, persistence: persistence, now: { clock.date }, accountService: nil)
            try dailyRequire(blocked.storageBlocked && blocked.storageNeedsUpdate, "The older app must block saving a newer sidecar")
            blocked.prepareDailyVocabulary()
            try dailyRequire(!blocked.finishOnboarding(profile: profile(role)), "Unrelated course edits cannot down-convert newer private fields")
            try dailyRequire(try Data(contentsOf: persistence.file(for: "guest")) == future, "Future bytes must stay unchanged")
        }))
        tests.append(("future daily backup blocks damaged-primary recovery and explicit archive downgrade", {
            let (store, _, persistence) = try makeStore(catalog, idioms, today, record())
            store.prepareDailyVocabulary()
            var envelope = try JSONSerialization.jsonObject(with: JSONEncoder().encode(LearningPersistence.Envelope(version: 2, learner: store.data))) as! [String: Any]
            var learner = envelope["learner"] as! [String: Any]
            learner["dailyVocabulary"] = ["version": 2, "unknownFutureShape": true]
            envelope["learner"] = learner
            let future = try JSONSerialization.data(withJSONObject: envelope)
            let primary = persistence.file(for: "guest"); let backup = primary.appendingPathExtension("backup")
            try Data("damaged fixture".utf8).write(to: primary); try future.write(to: backup)
            do { _ = try persistence.load(scope: "guest"); throw DailyTestFailure(description: "A future daily backup cannot be silently ignored") }
            catch LearningPersistence.PersistenceError.newerVersion {}
            do { _ = try persistence.archiveForRecovery(scope: "guest"); throw DailyTestFailure(description: "Archive recovery cannot downgrade a future daily backup") }
            catch LearningPersistence.PersistenceError.newerVersion {}
            try dailyRequire(try Data(contentsOf: backup) == future, "Future backup bytes must remain unchanged")
        }))
        tests.append(("failed local writes keep recoverable state and block dependent daily actions", {
            let (store, _, persistence) = try makeStore(catalog, idioms, today, record()); store.prepareDailyVocabulary()
            let moved = persistence.directory.appendingPathExtension("saved"); directories.append(moved)
            try FileManager.default.moveItem(at: persistence.directory, to: moved)
            try Data("fixture prevents directory writes".utf8).write(to: persistence.directory)
            let token = store.dailyVocabularyToken
            try dailyRequire(!store.unlockDailyVocabularyExtra(token: token) && store.hasUnsavedChanges, "Failed save must be reported rather than advancing")
            try dailyRequire(store.dailyVocabularyCollection?.extraUnlocked == true, "Recoverable attempted state must remain in memory")
            let snapshot = store.data
            try dailyRequire(!store.revealDailyVocabularyWord(wordId: store.dailyVocabularyWords[0].id, token: token) && store.data == snapshot, "Unresolved write must block another daily action")
        }))
        tests.append(("canonical idiom content has meaning example context register and plain alternative", {
            try dailyRequire(idioms.schemaVersion == 1 && idioms.idioms.count == 14 && Set(idioms.idioms.map(\.id)).count == 14, "Expected fourteen authored stable idioms")
            for idiom in idioms.idioms {
                try dailyRequire([idiom.phrase, idiom.meaning, idiom.example, idiom.register, idiom.context, idiom.plainEnglish].allSatisfy { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }, "No invented fallback fields or missing learning guidance")
            }
        }))
        for (name, test) in tests { try test(); print("PASS \(name)") }
        print("\(tests.count) daily-vocabulary behavior groups passed")
    }
}
