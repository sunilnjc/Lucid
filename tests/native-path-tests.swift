import Foundation

// Standalone behavior suite; no project-file or checkout edits are needed.
// Compile with Models.swift, LearningPersistence.swift, LearningStore.swift,
// AccountService.swift, and LocalBackup.swift; do not include Services.swift.
// Run with professional-content.json as the sole argument.
// Assumes pathLesson(for:) and nextPathLesson return an optional lesson with .id.
enum ReminderScheduler { static func cancel() {} }

struct PathTestFailure: Error, CustomStringConvertible {
    let description: String
}

func pathRequire(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
    if try !condition() { throw PathTestFailure(description: message) }
}

@MainActor
final class PathTestClock {
    var now: Date
    init(_ now: Date) { self.now = now }
}

@main
@MainActor
struct LucidPathBehaviorTests {
    static var directories: [URL] = []

    static func makeStore(catalog: ProfessionalCatalog, now: Date,
                          initial: LearnerData = LearnerData()) throws -> (LearningStore, PathTestClock, LearningPersistence) {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("lucid-path-behavior-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        directories.append(directory)
        let persistence = LearningPersistence(directory: directory)
        // A precreated guest file prevents migration from touching real UserDefaults.
        try persistence.save(initial, scope: "guest")
        let clock = PathTestClock(now)
        let store = LearningStore(catalog: catalog, persistence: persistence,
                                  now: { clock.now }, accountService: nil)
        return (store, clock, persistence)
    }

    static func practise(_ ids: [String], in store: LearningStore) throws {
        for id in ids {
            guard let word = store.word(id: id) else {
                throw PathTestFailure(description: "Missing fixture word \(id)")
            }
            store.saveDraft("Our finance team will discuss \(word.term) in tomorrow’s report.", wordId: id)
            try pathRequire(store.markTodayWord(id, quality: .good), "Could not practise fixture word \(id)")
        }
    }

    static func main() async throws {
        guard CommandLine.arguments.count == 2 else {
            throw PathTestFailure(description: "Usage: lucid-path-tests /absolute/path/professional-content.json")
        }
        let source = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
        var baseObject = try JSONSerialization.jsonObject(with: source) as! [String: Any]
        // This fixture deliberately ignores the shipping path's particular word count.
        baseObject.removeValue(forKey: "learningPaths")
        let oldCatalog = try JSONDecoder().decode(ProfessionalCatalog.self,
            from: JSONSerialization.data(withJSONObject: baseObject))
        guard let finance = oldCatalog.roles.first(where: { $0.id == "finance-accounting" }),
              let other = oldCatalog.roles.first(where: { $0.id != finance.id }),
              let seniority = oldCatalog.seniorityLevels.first,
              let financeSituation = finance.situations.first,
              let otherSituation = other.situations.first,
              let goal = oldCatalog.goals.first else {
            throw PathTestFailure(description: "Fixture requires Finance, another role, seniority, situations, and a goal")
        }
        let financeWords = oldCatalog.words.filter { $0.learningMode == "active" && $0.roles.contains(finance.id) }
            .sorted { $0.id > $1.id }
        try pathRequire(financeWords.count >= 7, "Fixture requires seven active Finance words")
        let ids = Array(financeWords.prefix(7).map(\.id))
        let profile = LearnerProfile(roleId: finance.id, seniorityId: seniority.id,
                                     situationIds: [financeSituation.id], goalIds: [goal.id])
        let otherProfile = LearnerProfile(roleId: other.id, seniorityId: seniority.id,
                                          situationIds: [otherSituation.id], goalIds: [goal.id])
        let lessonIDs = ["fixture-reconcile", "fixture-report", "fixture-recommend"]
        func lesson(_ index: Int, _ words: [String]) -> [String: Any] {
            ["id": lessonIDs[index], "title": "Finance scenario \(index + 1)",
             "situationId": financeSituation.id, "objective": "Explain a financial result and its next action.",
             "wordIds": words, "challenge": "Write an explanation for your finance manager.",
             "exampleResponse": "We will explain the result, its cause, and the action required."]
        }
        var pathObject = baseObject
        pathObject["learningPaths"] = [[
            "id": "fixture-finance-path", "roleId": finance.id,
            "title": "Finance from evidence to decisions", "description": "An ordered behavior-test path.",
            "modules": [
                ["id": "fixture-foundations", "title": "Build the evidence", "outcome": "Explain financial records.",
                 "lessons": [lesson(0, Array(ids[0..<2])), lesson(1, Array(ids[2..<5]))]],
                ["id": "fixture-decisions", "title": "Recommend action", "outcome": "Make a clear recommendation.",
                 "lessons": [lesson(2, Array(ids[5..<7]))]]
            ]
        ]]
        // Catalog storage order must not dictate curriculum order.
        pathObject["words"] = (baseObject["words"] as! [[String: Any]]).reversed().map { $0 }
        let catalog = try JSONDecoder().decode(ProfessionalCatalog.self,
            from: JSONSerialization.data(withJSONObject: pathObject))
        let baseline = Calendar.current.date(from: DateComponents(year: 2026, month: 9, day: 21, hour: 12))!
        func day(_ offset: Int) -> Date { baseline.lucidAdding(days: offset).addingTimeInterval(12 * 60 * 60) }

        defer {
            // Only UUID-named directories created by this process are removed.
            for directory in directories { try? FileManager.default.removeItem(at: directory) }
        }
        var tests: [(String, () throws -> Void)] = []

        tests.append(("older catalogs and learner records need no path migration", {
            try pathRequire(oldCatalog.learningPaths == nil, "A catalog without learningPaths failed backward compatibility")
            var oldLearner = LearnerData()
            oldLearner.profile = profile
            oldLearner.introducedWordIds = [ids[0]]
            oldLearner.progressByWordId[ids[0]] = WordProgress(introducedOn: day(-2), nextReviewOn: day(1))
            let decoded = try JSONDecoder().decode(LearnerData.self, from: JSONEncoder().encode(oldLearner))
            let (store, _, _) = try makeStore(catalog: catalog, now: baseline, initial: decoded)
            store.prepareToday()
            try pathRequire(store.pathCompletedWordCount == 1, "Adding a path forgot already-practised vocabulary")
            try pathRequire(store.data.progressByWordId[ids[0]] == oldLearner.progressByWordId[ids[0]], "Adding a path rewrote review history")
            try pathRequire(store.data.currentWordIds == Array(ids[1..<4]), "Migration restarted the path instead of skipping known words")
        }))

        tests.append(("path identity, lesson lookup, and zero-progress next lesson are role specific", {
            let (store, _, _) = try makeStore(catalog: catalog, now: baseline)
            store.finishOnboarding(profile: profile, goal: 3)
            try pathRequire(store.learningPath?.id == "fixture-finance-path", "Finance did not resolve its path")
            try pathRequire(store.pathLesson(for: ids[0])?.id == lessonIDs[0], "First word resolved to the wrong lesson")
            try pathRequire(store.pathLesson(for: ids[6])?.id == lessonIDs[2], "Last-module lookup failed")
            try pathRequire(store.pathLesson(for: "not-a-catalog-word") == nil, "Unknown word returned a path lesson")
            try pathRequire(store.nextPathLesson?.id == lessonIDs[0], "Next lesson skipped the first unfinished scenario")
            try pathRequire(store.pathCompletedWordCount == 0 && store.pathProgress == 0, "Opening a roadmap awarded completion")
        }))

        tests.append(("new Finance plans follow lesson order at all three daily paces", {
            for pace in 1...3 {
                let (store, _, _) = try makeStore(catalog: catalog, now: baseline)
                store.finishOnboarding(profile: profile, goal: pace)
                try pathRequire(store.data.currentWordIds == Array(ids.prefix(pace)), "Pace \(pace) ignored curriculum order or its word cap")
                try pathRequire(store.data.introducedWordIds.isEmpty && store.totalXP == 0, "Selecting a plan introduced words or awarded XP")
            }
        }))

        tests.append(("an unfinished earlier word carries forward before later scenarios", {
            let (store, clock, _) = try makeStore(catalog: catalog, now: baseline)
            store.finishOnboarding(profile: profile, goal: 3)
            // A learner can practise the second word before the first.
            try practise([ids[1]], in: store)
            clock.now = day(1); store.refreshDay()
            try pathRequire(store.data.currentWordIds == [ids[0], ids[2], ids[3]], "Rollover skipped an unfinished early word or repeated a completed one")
            try pathRequire(store.nextPathLesson?.id == lessonIDs[0], "Partially finished scenario was marked complete")
            try pathRequire(store.pathCompletedWordCount == 1, "Rollover changed path completion without practice")
            try pathRequire(store.data.completedWordIdsToday.isEmpty, "Yesterday's daily completion leaked into today")
        }))

        tests.append(("editing pace preserves today's work and affects tomorrow's selection", {
            let (store, clock, _) = try makeStore(catalog: catalog, now: baseline)
            store.finishOnboarding(profile: profile, goal: 2)
            try practise([ids[0]], in: store)
            let originalIDs = store.data.currentWordIds
            let originalDraft = store.draft(for: ids[0])
            store.finishOnboarding(profile: profile, name: "Finance learner", goal: 3)
            try pathRequire(store.dailyGoal == 3 && store.data.currentWordIds == originalIDs, "Pace edit replaced the in-progress daily plan")
            try pathRequire(store.data.completedWordIdsToday == [ids[0]] && store.draft(for: ids[0]) == originalDraft, "Pace edit discarded a completed attempt")
            clock.now = day(1); store.refreshDay()
            try pathRequire(store.data.currentWordIds == Array(ids[1..<4]), "Tomorrow failed to apply the new pace to remaining path words")
        }))

        tests.append(("same-day pre-path plans survive upgrade without reordering or losing completion", {
            var initial = LearnerData()
            initial.profile = profile; initial.dailyWordGoal = 2
            initial.currentLessonDate = baseline.lucidStartOfDay
            initial.lessonDayKey = nil // The earlier app stored only currentLessonDate.
            initial.currentWordIds = [ids[6], ids[5]]
            initial.completedWordIdsToday = [ids[6]]
            initial.introducedWordIds = [ids[6]]
            initial.progressByWordId[ids[6]] = WordProgress(introducedOn: baseline, nextReviewOn: day(1))
            initial.practiceDrafts = [ids[6]: "Keep my completed legacy finance explanation."]
            let (store, clock, _) = try makeStore(catalog: catalog, now: baseline, initial: initial)
            store.prepareToday()
            try pathRequire(store.data.currentWordIds == initial.currentWordIds && store.data.completedWordIdsToday == [ids[6]], "Path activation reordered today's existing plan")
            try pathRequire(store.draft(for: ids[6]) == initial.practiceDrafts?[ids[6]], "Path activation discarded the current draft")
            clock.now = day(1); store.refreshDay()
            try pathRequire(store.data.currentWordIds == Array(ids.prefix(2)), "The next calendar day did not enter the remaining ordered path")
            try pathRequire(store.pathCompletedWordCount == 1, "Legacy practice was not counted toward the path")
        }))

        tests.append(("path progress and the next unfinished lesson survive a relaunch", {
            let (store, clock, persistence) = try makeStore(catalog: catalog, now: baseline)
            store.finishOnboarding(profile: profile, goal: 3)
            try practise(Array(ids.prefix(2)), in: store)
            let restored = LearningStore(catalog: catalog, persistence: persistence, now: { clock.now }, accountService: nil)
            restored.prepareToday()
            try pathRequire(restored.data.currentWordIds == store.data.currentWordIds, "Relaunch replaced the current path plan")
            try pathRequire(restored.pathCompletedWordCount == 2 && abs(restored.pathProgress - 2.0 / 7.0) < 0.000_001, "Relaunch lost completed-word progress")
            try pathRequire(restored.nextPathLesson?.id == lessonIDs[1], "Relaunch repeated the finished first scenario")
            try pathRequire(restored.totalXP == 20 && restored.data.sessions.isEmpty, "Path progress granted an unearned daily-completion reward")
        }))

        tests.append(("finishing the course means practising every path word, not premature mastery", {
            let (store, clock, _) = try makeStore(catalog: catalog, now: baseline)
            store.finishOnboarding(profile: profile, goal: 3)
            var seen: [String] = []
            for offset in 0..<3 {
                clock.now = day(offset); store.refreshDay()
                let todays = store.data.currentWordIds
                try pathRequire(todays.count == (offset == 2 ? 1 : 3), "The final short day was not playable")
                seen += todays
                try practise(todays, in: store)
                try pathRequire(store.completeToday(), "The final short lesson could not be completed")
            }
            try pathRequire(seen == ids, "Course repeated, omitted, or reordered a word")
            try pathRequire(store.pathCompletedWordCount == 7 && store.pathProgress == 1 && store.nextPathLesson == nil, "Practising the last word did not finish the roadmap")
            try pathRequire(store.masteredCount == 0 && store.data.progressByWordId.values.allSatisfy { !$0.mastered && $0.successfulReviewDates.isEmpty }, "Course completion falsely awarded retained mastery")
            try pathRequire(store.totalXP == 130 && store.data.sessions.count == 3, "Seven words and three completed days earned incorrect rewards")
        }))

        tests.append(("exhausted paths stop new lessons while scheduled reviews remain usable", {
            var initial = LearnerData(); initial.profile = profile
            initial.introducedWordIds = ids
            for id in ids {
                initial.progressByWordId[id] = WordProgress(introducedOn: day(-7), nextReviewOn: baseline)
            }
            let (store, clock, persistence) = try makeStore(catalog: catalog, now: baseline, initial: initial)
            store.prepareToday()
            try pathRequire(store.todayWords.isEmpty && store.nextPathLesson == nil && store.pathProgress == 1, "Exhaustion restarted the course or selected unrelated vocabulary")
            try pathRequire(Set(store.dueWords.map(\.id)) == Set(ids), "Exhaustion hid or removed due reviews")
            try pathRequire(!store.completeToday() && store.totalXP == 0, "An empty course day earned completion or XP")
            store.revealReview(wordId: ids[0], usingHint: true)
            try pathRequire(store.review(wordId: ids[0], quality: .again, productive: false), "Reviewing a completed-path word became impossible")
            try pathRequire(store.pathProgress == 1 && store.pathCompletedWordCount == 7, "A forgotten review incorrectly erased practised course progress")
            let restored = LearningStore(catalog: catalog, persistence: persistence, now: { clock.now }, accountService: nil)
            restored.prepareToday()
            try pathRequire(restored.todayWords.isEmpty && restored.pathProgress == 1, "Relaunch restarted an exhausted path")
        }))

        tests.append(("roles without a path retain their existing relevance selection and progress", {
            let (withFinancePath, _, _) = try makeStore(catalog: catalog, now: baseline)
            let (withoutPaths, _, _) = try makeStore(catalog: oldCatalog, now: baseline)
            withFinancePath.finishOnboarding(profile: otherProfile, goal: 3)
            withoutPaths.finishOnboarding(profile: otherProfile, goal: 3)
            try pathRequire(withFinancePath.learningPath == nil && withFinancePath.nextPathLesson == nil, "A non-Finance learner received the Finance curriculum")
            try pathRequire(withFinancePath.data.currentWordIds == withoutPaths.data.currentWordIds, "Adding Finance changed another role's relevance ranking")
            try pathRequire(withFinancePath.todayWords.allSatisfy { $0.roles.contains(other.id) }, "Fallback selection leaked unrelated-role words")
            try pathRequire(withFinancePath.pathCompletedWordCount == 0 && withFinancePath.pathProgress == 0, "An absent path reported phantom progress")
            try pathRequire(!withFinancePath.todayWords.isEmpty, "A role without a course can no longer learn")
        }))

        var failures: [String] = []
        for (name, test) in tests {
            do { try test(); print("PASS: \(name)") }
            catch { failures.append(name); print("FAIL: \(name) — \(error)") }
        }
        print("\(tests.count - failures.count)/\(tests.count) Finance path behavior tests passed")
        if !failures.isEmpty { throw PathTestFailure(description: "Failed tests: " + failures.joined(separator: "; ")) }
    }
}
