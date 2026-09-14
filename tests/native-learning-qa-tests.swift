import Foundation

enum ReminderScheduler { static func cancel() {} }
struct AuditFailure: Error, CustomStringConvertible { let description: String }
func check(_ value: @autoclosure () -> Bool, _ message: String) throws {
    if !value() { throw AuditFailure(description: message) }
}

@main @MainActor struct LearningAuditTests {
    static var ownedDirectories: [URL] = []
    static func persistence() throws -> LearningPersistence {
        let path = FileManager.default.temporaryDirectory.appendingPathComponent("lucid-learning-audit-fixture-\(UUID())")
        try FileManager.default.createDirectory(at: path, withIntermediateDirectories: true)
        ownedDirectories.append(path)
        let result = LearningPersistence(directory: path)
        try result.save(LearnerData(), scope: "guest")
        return result
    }
    static func main() throws {
        let catalog = try JSONDecoder().decode(ProfessionalCatalog.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
        let now = Calendar.current.date(from: DateComponents(year: 2026, month: 9, day: 14, hour: 9))!
        let word = catalog.words.first { $0.term == "reconcile" }!
        func snapshot(quality: Int, hourOffset: Double) -> LearnerData {
            var data = LearnerData()
            let date = now.addingTimeInterval(hourOffset * 3600)
            let index = quality == 0 ? 0 : 4
            data.progressByWordId[word.id] = WordProgress(introducedOn: now.lucidAdding(days: -40), intervalIndex: index,
                nextReviewOn: now.lucidAdding(days: quality == 0 ? 1 : 30), lastReviewedOn: date,
                reviewCount: 1, successfulReviewDates: quality == 0 ? [] : [date], lapses: quality == 0 ? 1 : 0)
            data.activities = [LearningActivity(id: UUID(), kind: .review, wordId: word.id, date: date,
                dayKey: now.lucidDayKey, quality: quality, productive: quality >= 2)]
            return data
        }
        defer { for directory in ownedDirectories { try? FileManager.default.removeItem(at: directory) } }
        let tests: [(String, () throws -> Void)] = [
            ("same-day conflicting devices schedule the harder answer", {
                let hard = snapshot(quality: 0, hourOffset: 0)
                let strong = snapshot(quality: 3, hourOffset: 1)
                for merged in [LearningMerge.combine(local: hard, remote: strong), LearningMerge.combine(local: strong, remote: hard)] {
                    let actual = merged.progressByWordId[word.id]!
                    try check(actual.intervalIndex == 0 && actual.nextReviewOn == now.lucidAdding(days: 1),
                        "Again + later Strong must return tomorrow; got interval \(actual.intervalIndex), date \(actual.nextReviewOn)")
                    let repeated = LearningMerge.combine(local: merged, remote: strong)
                    try check(repeated.progressByWordId[word.id] == actual, "Replaying a stale optimistic device changed the conservative schedule")
                }
            }),
            ("conflicting same-day review XP uses the harder result regardless of ordering", {
                for events in [snapshot(quality: 3, hourOffset: 0).activities! + snapshot(quality: 0, hourOffset: 1).activities!,
                               snapshot(quality: 0, hourOffset: 0).activities! + snapshot(quality: 3, hourOffset: 1).activities!] {
                    let saved = try persistence()
                    var initial = LearnerData(); initial.activities = events
                    try saved.save(initial, scope: "guest")
                    let store = LearningStore(catalog: catalog, persistence: saved, now: { now }, accountService: nil)
                    try check(store.totalXP == 5, "A helped same-day review must earn 5 XP, got \(store.totalXP)")
                }
            }),
            ("ordinary plurals of professional phrases can complete practice and independent recall", {
                for (term, sentence) in [("run rate", "Our run rates are consistent with the forecast."),
                                         ("executive summary", "We wrote two executive summaries for the directors.")] {
                    let target = catalog.words.first { $0.term == term }!
                    let saved = try persistence()
                    var initial = LearnerData()
                    initial.currentLessonDate = now.lucidStartOfDay
                    initial.lessonDayKey = now.lucidDayKey
                    initial.currentWordIds = [target.id]
                    initial.practiceDrafts = [target.id: sentence, "recall:\(now.lucidDayKey):\(target.id)": sentence]
                    try saved.save(initial, scope: "guest")
                    let store = LearningStore(catalog: catalog, persistence: saved, now: { now }, accountService: nil)
                    try check(store.containsTerm(sentence, word: target), "Valid plural of \(term) was rejected")
                    try check(store.markTodayWord(target.id, quality: .good), "Valid plural sentence could not complete \(term)")
                    store.data.progressByWordId[target.id]?.nextReviewOn = now.lucidStartOfDay
                    store.revealReview(wordId: target.id, usingHint: false)
                    try check(store.reviewAttempt(for: target.id)?.independent == true, "Valid plural recall was incorrectly classified as helped")
                }
            }),
            ("future-version backup blocks recovery when the primary is damaged", {
                let saved = try persistence()
                let primary = saved.file(for: "guest")
                try Data("damaged primary".utf8).write(to: primary)
                try Data(#"{"version":3,"learner":{"newFields":true}}"#.utf8).write(to: primary.appendingPathExtension("backup"))
                let store = LearningStore(catalog: catalog, persistence: saved, now: { now }, accountService: nil)
                try check(store.storageBlocked && store.storageNeedsUpdate, "Future backup was reported as ordinary corruption, permitting a downgrade restore")
            }),
            ("archive recovery cannot downgrade a future-version backup", {
                let saved = try persistence()
                let primary = saved.file(for: "guest")
                try Data("damaged primary".utf8).write(to: primary)
                try Data(#"{"version":3,"learner":{"newFields":true}}"#.utf8).write(to: primary.appendingPathExtension("backup"))
                do {
                    _ = try saved.archiveForRecovery(scope: "guest")
                    throw AuditFailure(description: "Recovery accepted a backup created by a newer app")
                } catch LearningPersistence.PersistenceError.newerVersion {}
            }),
            ("failed disk saves still advance the in-memory sync revision", {
                let saved = try persistence()
                let store = LearningStore(catalog: catalog, persistence: saved, now: { now }, accountService: nil)
                let before = store.dataRevision
                let held = saved.directory.appendingPathExtension("held")
                try FileManager.default.moveItem(at: saved.directory, to: held)
                defer {
                    try? FileManager.default.removeItem(at: saved.directory)
                    try? FileManager.default.moveItem(at: held, to: saved.directory)
                }
                try Data("deterministic disk-save obstruction".utf8).write(to: saved.directory)
                store.saveDraft("A newer local draft must survive the pending cloud response.", wordId: word.id)
                try check(store.hasUnsavedChanges, "Fixture failed to obstruct disk persistence")
                try check(store.dataRevision > before, "Unsaved memory mutation did not invalidate the in-flight cloud snapshot")
            }),
            ("a genuinely later review day retains its new interval", {
                let earlier = snapshot(quality: 0, hourOffset: 0)
                var later = snapshot(quality: 3, hourOffset: 24)
                later.activities = later.activities?.map { LearningActivity(id: $0.id, kind: $0.kind, wordId: $0.wordId,
                    date: $0.date, dayKey: $0.date.lucidDayKey, quality: $0.quality, productive: $0.productive) }
                let merged = LearningMerge.combine(local: earlier, remote: later)
                try check(merged.progressByWordId[word.id]?.intervalIndex == 4, "An earlier day's lapse reset a genuinely later review")
            }),
            ("a conflicted review day cannot reappear as a mastery success on the next review", {
                let saved = try persistence()
                var initial = LearnerData()
                let previous = now.lucidAdding(days: -20)
                let conflicted = now.lucidAdding(days: -1)
                initial.progressByWordId[word.id] = WordProgress(introducedOn: now.lucidAdding(days: -40),
                    nextReviewOn: now, lastReviewedOn: conflicted, reviewCount: 2)
                initial.activities = [
                    LearningActivity(id: UUID(), kind: .review, wordId: word.id, date: previous,
                        dayKey: previous.lucidDayKey, quality: 2, productive: true),
                    LearningActivity(id: UUID(), kind: .review, wordId: word.id, date: conflicted,
                        dayKey: conflicted.lucidDayKey, quality: 3, productive: true),
                    LearningActivity(id: UUID(), kind: .review, wordId: word.id, date: conflicted.addingTimeInterval(3600),
                        dayKey: conflicted.lucidDayKey, quality: 0, productive: false)
                ]
                initial.practiceDrafts = ["recall:\(now.lucidDayKey):\(word.id)": "We will reconcile the records before the meeting."]
                try saved.save(initial, scope: "guest")
                let store = LearningStore(catalog: catalog, persistence: saved, now: { now }, accountService: nil)
                store.revealReview(wordId: word.id, usingHint: false)
                try check(store.review(wordId: word.id, quality: .good, productive: true), "Could not perform the next due independent review")
                try check(store.masteredCount == 0, "One earlier success, one conflicting day, and today were incorrectly counted as three successful days")
            })
        ]
        var failures = 0
        for (name, run) in tests {
            do { try run(); print("PASS: \(name)") }
            catch { failures += 1; print("FAIL: \(name): \(error)") }
        }
        print("\(tests.count - failures)/\(tests.count) audit regression groups passed")
        if failures != 0 { throw AuditFailure(description: "\(failures) reproducible regressions") }
    }
}
